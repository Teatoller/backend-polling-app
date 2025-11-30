// backend/routes/polls.ts
import express from 'express';
// import { query, getClient } from '../config/database.js';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get active polls
router.get('/active', async (req, res) => {
  try {
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
       WHERE p.is_active = TRUE AND p.end_date > NOW()
       GROUP BY p.id
       ORDER BY p.created_at DESC`
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
    const userId = (req as any).user.userId;
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
      'SELECT county, division, polling_station FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Record the vote
    await client.query(
      `INSERT INTO votes (user_id, poll_id, candidate_id, county, division, polling_station)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, pollId, candidateId, user.county, user.division, user.polling_station]
    );

    await client.query('COMMIT');

    // Emit real-time update via Socket.io
    (req as any).app.get('io').emit('voteUpdate', { pollId, candidateId });

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
    const userId = (req as any).user.userId;
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