// backend/routes/polls.ts
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get active polls
router.get('/active', async (req, res) => {
  try {
    // Load user's location to filter polls by scope
    const userId = req.user?.userId;
    let userLoc = null;
    if (userId) {
      const ures = await db.query(
        `SELECT county_id, sub_county_id, ward_id FROM users WHERE id = $1`,
        [userId]
      );
      userLoc = ures.rows[0] || null;
    }

    const result = await db.query(
      `SELECT p.*, 
              json_agg(
                json_build_object(
                  'id', c.id,
                  'name', c.name,
                  'party', c.party,
                  'photo_url', c.photo_url,
                  'description', c.description
                )
              ) as candidates
       FROM polls p
       LEFT JOIN candidates c ON p.id = c.poll_id
       WHERE p.is_active = TRUE 
         AND p.end_date > NOW()
         AND (
           p.scope = 'NATIONAL'
           OR (
             p.scope = 'GENERAL' AND p.county_id IS NULL AND p.sub_county_id IS NULL AND p.ward_id IS NULL
           )
           OR (
             $1::INT IS NOT NULL AND p.scope = 'COUNTY' AND p.county_id = $1
           )
           OR (
             $2::INT IS NOT NULL AND p.scope = 'SUB_COUNTY' AND p.sub_county_id = $2
           )
           OR (
             $3::INT IS NOT NULL AND p.scope = 'WARD' AND p.ward_id = $3
           )
           OR (
             -- Restricted general polls with specific location values
             (p.scope = 'GENERAL') AND (
               ($1::INT IS NOT NULL AND p.county_id = $1) OR
               ($2::INT IS NOT NULL AND p.sub_county_id = $2) OR
               ($3::INT IS NOT NULL AND p.ward_id = $3)
             )
           )
         )
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [userLoc?.county_id || null, userLoc?.sub_county_id || null, userLoc?.ward_id || null]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit vote
router.post('/vote', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    const userId = req.user.userId;
    const { pollId, candidateId } = req.body;

    // Check if user has already voted in this poll
    const existingVote = await client.query(
      'SELECT id FROM votes WHERE user_id = $1 AND poll_id = $2',
      [userId, pollId]
    );

    if (existingVote.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }

    // Get user details for polling station info
    const userResult = await client.query(
      `SELECT county_id, county_name, sub_county_id, sub_county_name, 
              ward_id, ward_name, polling_station 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Record the vote
    await client.query(
      `INSERT INTO votes (
        user_id, poll_id, candidate_id, 
        county_id, county_name, sub_county_id, sub_county_name,
        ward_id, ward_name, polling_station
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId, pollId, candidateId, 
        user.county_id, user.county_name, 
        user.sub_county_id, user.sub_county_name,
        user.ward_id, user.ward_name, 
        user.polling_station
      ]
    );

    await client.query('COMMIT');

    // Emit real-time update via Socket.io
    req.app.get('io').emit('voteUpdate', { pollId, candidateId });

    res.json({ message: 'Vote submitted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Check if user has voted
router.get('/has-voted/:pollId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pollId } = req.params;

    const result = await db.query(
      'SELECT id FROM votes WHERE user_id = $1 AND poll_id = $2',
      [userId, pollId]
    );

    res.json({ hasVoted: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking vote status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;