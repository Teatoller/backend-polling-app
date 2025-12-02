// backend/routes/results.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get results for a specific poll
// Update the /:pollId route in results.js
router.get('/:pollId', authenticateToken, async (req, res) => {
  try {
    const { pollId } = req.params;

    // Get complete poll details
    const pollResult = await db.query(
      `SELECT p.*, 
              COUNT(v.id) as total_votes
       FROM polls p
       LEFT JOIN votes v ON p.id = v.poll_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [pollId]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const poll = pollResult.rows[0];

    // Get candidate results with IDs
    const candidatesResult = await db.query(
      `SELECT c.*, 
              COUNT(v.id) as vote_count
       FROM candidates c
       LEFT JOIN votes v ON c.id = v.candidate_id
       WHERE c.poll_id = $1
       GROUP BY c.id
       ORDER BY vote_count DESC`,
      [pollId]
    );

    // Get location breakdown
    const locationResult = await db.query(
      `SELECT county, division, polling_station, 
              COUNT(*) as votes_per_station
       FROM votes 
       WHERE poll_id = $1
       GROUP BY county, division, polling_station
       ORDER BY county, division, polling_station`,
      [pollId]
    );

    const totalVotes = parseInt(poll.total_votes) || 0;

    res.json({
      poll: {
        id: poll.id,
        officeName: poll.office_name,
        description: poll.description,
        startDate: poll.start_date,
        endDate: poll.end_date,
        is_active: poll.is_active,
        totalVotes: totalVotes,
        createdBy: 'Admin' // You could join with users table to get actual creator
      },
      candidates: candidatesResult.rows.map(candidate => ({
        id: candidate.id,
        name: candidate.name,
        party: candidate.party,
        photoUrl: candidate.photo_url,
        description: candidate.description,
        voteCount: parseInt(candidate.vote_count) || 0,
        percentage: totalVotes > 0
          ? ((parseInt(candidate.vote_count) || 0) / totalVotes) * 100
          : 0
      })),
      locationBreakdown: locationResult.rows,
      summary: {
        totalVotes: totalVotes,
        totalCandidates: candidatesResult.rows.length,
        votingStations: locationResult.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get results by polling station
router.get('/polling-station/:pollingStation', async (req, res) => {
  try {
    const { pollingStation } = req.params;

    const result = await db.query(
      `SELECT 
        p.office_name,
        c.name as candidate_name,
        c.party as candidate_party,
        COUNT(v.id) as vote_count
       FROM votes v
       JOIN polls p ON v.poll_id = p.id
       JOIN candidates c ON v.candidate_id = c.id
       WHERE v.polling_station = $1
       GROUP BY p.office_name, c.name, c.party
       ORDER BY p.office_name, vote_count DESC`,
      [pollingStation]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching polling station results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get overall statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM polls WHERE is_active = true) as active_polls,
        (SELECT COUNT(*) FROM votes) as total_votes,
        (SELECT COUNT(DISTINCT user_id) FROM votes) as unique_voters
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;