// backend/routes/admin.ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateAdmin } from '../middleware/auth.js';
import { db } from '../config/database.js';

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT id, email, password_hash, role FROM admin_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful',
      admin: { id: admin.id, email: admin.email, role: admin.role },
      token
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create poll (Admin only)
router.post('/polls', authenticateAdmin, async (req, res) => {
  try {
    const { officeName, description, startDate, endDate, candidates } = req.body;
    const adminId = (req as any).admin.adminId;

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Create poll
      const pollResult = await client.query(
        `INSERT INTO polls (office_name, description, start_date, end_date, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [officeName, description, startDate, endDate, adminId]
      );

      const pollId = pollResult.rows[0].id;

      // Add candidates
      for (const candidate of candidates) {
        await client.query(
          `INSERT INTO candidates (poll_id, name, party, photo_url, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [pollId, candidate.name, candidate.party, candidate.photoUrl, candidate.description]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({ 
        message: 'Poll created successfully', 
        pollId 
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all polls with results (Admin only)
router.get('/polls', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, 
              COUNT(v.id) as total_votes,
              json_agg(
                json_build_object(
                  'id', c.id,
                  'name', c.name,
                  'party', c.party,
                  'vote_count', COUNT(v2.id)
                )
              ) as candidate_results
       FROM polls p
       LEFT JOIN candidates c ON p.id = c.poll_id
       LEFT JOIN votes v ON p.id = v.poll_id
       LEFT JOIN votes v2 ON c.id = v2.candidate_id
       GROUP BY p.id, c.id
       ORDER BY p.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle poll active status
router.patch('/polls/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE polls SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    res.json({ 
      message: 'Poll status updated', 
      poll: result.rows[0] 
    });

  } catch (error) {
    console.error('Error toggling poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;