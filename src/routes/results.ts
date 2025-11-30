// backend/routes/results.ts
import express from 'express';
// import { query } from '../config/database.js';
import { db } from '../config/database.js';

const router = express.Router();

// Get results for a specific poll
router.get('/poll/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;

    const result = await db.query(
      `SELECT 
        p.office_name,
        p.description,
        c.name as candidate_name,
        c.party as candidate_party,
        COUNT(v.id) as vote_count,
        COUNT(v.id) * 100.0 / NULLIF((
          SELECT COUNT(*) FROM votes WHERE poll_id = $1
        ), 0) as percentage
       FROM polls p
       LEFT JOIN candidates c ON p.id = c.poll_id
       LEFT JOIN votes v ON c.id = v.candidate_id
       WHERE p.id = $1
       GROUP BY p.id, c.id, c.name, c.party
       ORDER BY vote_count DESC`,
      [pollId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const totalVotes = result.rows.reduce((sum, row) => sum + parseInt(row.vote_count), 0);
    
    const results = {
      officeName: result.rows[0].office_name,
      description: result.rows[0].description,
      totalVotes,
      candidates: result.rows.map(row => ({
        name: row.candidate_name,
        party: row.candidate_party,
        voteCount: parseInt(row.vote_count),
        percentage: parseFloat(row.percentage) || 0
      }))
    };

    res.json(results);
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