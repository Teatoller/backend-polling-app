// backend src/routes/admin.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateAdmin } from '../middleware/auth.js';
import { authorizeAdmin, VALID_ROLES } from '../middleware/authorization.js';
import { db } from '../config/database.js';

const router = express.Router();

// ========== EXISTING ENDPOINTS (MODIFIED FOR ENHANCEMENTS) ==========

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
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
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

// ===== Admin Management (RBAC) =====
// Create a new admin (superadmin only)
router.post('/admins', authenticateAdmin, authorizeAdmin('manageAdmins'), async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await db.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Admin with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO admin_users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email, passwordHash, role]
    );

    res.status(201).json({
      message: 'Admin created successfully',
      admin: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List admins (superadmin only)
router.get('/admins', authenticateAdmin, authorizeAdmin('manageAdmins'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, role, created_at FROM admin_users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing admins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin (role/email/password) - superadmin only
router.put('/admins/:id', authenticateAdmin, authorizeAdmin('manageAdmins'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, role } = req.body;

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent self-demotion deletion via update path (optional checks)
    // if (req.admin.adminId === Number(id) && role && role !== 'superadmin') {
    //   return res.status(400).json({ error: 'Cannot change your own role' });
    // }

    const fields = [];
    const values = [];
    let idx = 1;
    if (email) { fields.push(`email = $${idx++}`); values.push(email); }
    if (role) { fields.push(`role = $${idx++}`); values.push(role); }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      fields.push(`password_hash = $${idx++}`);
      values.push(passwordHash);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE admin_users SET ${fields.join(', ')}, created_at = created_at
       WHERE id = $${idx}
       RETURNING id, email, role, created_at`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json({ message: 'Admin updated successfully', admin: result.rows[0] });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete admin (superadmin only)
router.delete('/admins/:id', authenticateAdmin, authorizeAdmin('manageAdmins'), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.admin.adminId === Number(id)) {
      return res.status(400).json({ error: "You can't delete your own admin account" });
    }
    const result = await db.query(
      `DELETE FROM admin_users WHERE id = $1 RETURNING id, email, role`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json({ message: 'Admin deleted successfully', admin: result.rows[0] });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create poll (Admin only)
router.post('/polls', authenticateAdmin, authorizeAdmin('managePolls'), async (req, res) => {
  try {
    const { officeName, description, startDate, endDate, candidates, scope,
      countyId, countyName, subCountyId, subCountyName, wardId, wardName, pollingStation } = req.body;
    const adminId = req.admin.adminId;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Create poll
      const pollResult = await client.query(
        `INSERT INTO polls (
           office_name, description, start_date, end_date, is_active,
           scope, county_id, county_name, sub_county_id, sub_county_name,
           ward_id, ward_name, polling_station, created_by
         ) VALUES (
           $1, $2, $3, $4, TRUE,
           COALESCE($5, 'GENERAL'), $6, $7, $8, $9,
           $10, $11, $12, $13
         ) RETURNING id`,
        [officeName, description, startDate, endDate,
         scope,
         countyId || null, countyName || null, subCountyId || null, subCountyName || null,
         wardId || null, wardName || null, pollingStation || null,
         adminId]
      );

      const pollId = pollResult.rows[0].id;

      // Add candidates
      for (const candidate of candidates) {
        await client.query(
          `INSERT INTO candidates (
            poll_id, name, party, photo_url, description,
            county_id, county_name, sub_county_id, sub_county_name,
            ward_id, ward_name, polling_station
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            pollId, 
            candidate.name, 
            candidate.party, 
            candidate.photoUrl, 
            candidate.description,
            candidate.countyId || null,
            candidate.countyName || null,
            candidate.subCountyId || null,
            candidate.subCountyName || null,
            candidate.wardId || null,
            candidate.wardName || null,
            candidate.pollingStation || null
          ]
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

// Get all polls with results (Admin only) - ENHANCED VERSION
router.get('/polls', authenticateAdmin, authorizeAdmin('viewPolls'), async (req, res) => {
  try {
    const { detailed = 'false' } = req.query;

    if (detailed === 'true') {
      // Detailed version with candidate results
      const result = await db.query(
        `SELECT p.*, 
                COUNT(DISTINCT v.id) as total_votes,
                json_agg(
                  DISTINCT jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'party', c.party,
                    'vote_count', COUNT(DISTINCT v2.id)
                  )
                ) as candidate_results
         FROM polls p
         LEFT JOIN candidates c ON p.id = c.poll_id
         LEFT JOIN votes v ON p.id = v.poll_id
         LEFT JOIN votes v2 ON c.id = v2.candidate_id
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      );
      res.json(result.rows);
    } else {
      // Simplified version for admin dashboard
      const result = await db.query(
        `SELECT p.*, 
                COUNT(DISTINCT c.id) as candidate_count,
                COUNT(DISTINCT v.id) as total_votes
         FROM polls p
         LEFT JOIN candidates c ON p.id = c.poll_id
         LEFT JOIN votes v ON p.id = v.poll_id
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      );
      
      // Format response to camelCase
      const formattedPolls = result.rows.map(poll => ({
        id: poll.id,
        officeName: poll.office_name,
        description: poll.description,
        startDate: poll.start_date,
        endDate: poll.end_date,
        is_active: poll.is_active,
        createdBy: poll.created_by,
        createdAt: poll.created_at,
        updatedAt: poll.updated_at,
        candidateCount: poll.candidate_count,
        totalVotes: poll.total_votes
      }));
      
      res.json(formattedPolls);
    }
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add this endpoint to your admin.js routes
router.get('/statistics', authenticateAdmin, authorizeAdmin('viewAnalytics'), async (req, res) => {
  try {
    // Get total users
    const usersResult = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE is_email_verified = true'
    );

    // Get active polls
    const pollsResult = await db.query(
      `SELECT COUNT(*) as count FROM polls 
       WHERE is_active = true 
       AND start_date <= NOW() 
       AND end_date >= NOW()`
    );

    // Get total votes
    const votesResult = await db.query(
      'SELECT COUNT(*) as count FROM votes'
    );

    // Get unique voters
    const votersResult = await db.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM votes'
    );

    // Get recent activity
    const activityResult = await db.query(`
      SELECT 
        'vote' as type,
        'New vote submitted in ' || p.office_name as description,
        v.created_at as timestamp
      FROM votes v
      JOIN polls p ON v.poll_id = p.id
      UNION ALL
      SELECT 
        'registration' as type,
        'New user registered: ' || u.email as description,
        u.created_at as timestamp
      FROM users u
      WHERE u.is_email_verified = true
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    res.json({
      total_users: parseInt(usersResult.rows[0].count),
      active_polls: parseInt(pollsResult.rows[0].count),
      total_votes: parseInt(votesResult.rows[0].count),
      unique_voters: parseInt(votersResult.rows[0].count),
      recent_activity: activityResult.rows
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add endpoint for recent users
router.get('/users/recent', authenticateAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await db.query(
      `SELECT id, email, created_at 
       FROM users 
       WHERE is_email_verified = true
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle poll active status
router.patch('/polls/:id/toggle', authenticateAdmin, authorizeAdmin('managePolls'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE polls SET is_active = NOT is_active WHERE id = $1 RETURNING id, office_name, is_active',
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

// Add this NEW endpoint before the existing /polls/:id/results endpoint
// Get single poll with candidates for editing
router.get('/polls/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get poll details
    const pollResult = await db.query(
      `SELECT 
        p.id,
        p.office_name,
        p.description,
        p.start_date,
        p.end_date,
        p.scope,
        p.county_id,
        p.county_name,
        p.sub_county_id,
        p.sub_county_name,
        p.ward_id,
        p.ward_name,
        p.polling_station,
        p.is_active,
        p.created_at,
        COUNT(DISTINCT v.id) as total_votes
       FROM polls p
       LEFT JOIN votes v ON p.id = v.poll_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Get candidates for this poll
    const candidatesResult = await db.query(
      `SELECT 
        id,
        name,
        party,
        photo_url,
        description
       FROM candidates
       WHERE poll_id = $1
       ORDER BY id`,
      [id]
    );

    const poll = pollResult.rows[0];
    
    res.json({
      id: poll.id,
      officeName: poll.office_name,
      description: poll.description,
      startDate: poll.start_date,
      endDate: poll.end_date,
      scope: poll.scope,
      countyId: poll.county_id,
      countyName: poll.county_name,
      subCountyId: poll.sub_county_id,
      subCountyName: poll.sub_county_name,
      wardId: poll.ward_id,
      wardName: poll.ward_name,
      pollingStation: poll.polling_station,
      is_active: poll.is_active,
      totalVotes: parseInt(poll.total_votes) || 0,
      candidates: candidatesResult.rows.map(c => ({
        id: c.id,
        name: c.name,
        party: c.party,
        photoUrl: c.photo_url,
        description: c.description
      })),
      createdAt: poll.created_at
    });

  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update the existing PUT /polls/:id endpoint to handle candidate updates
router.put('/polls/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { officeName, description, startDate, endDate, is_active, candidates, scope,
      countyId, countyName, subCountyId, subCountyName, wardId, wardName, pollingStation } = req.body;

    console.log('Updating poll:', id);
    console.log('Received data:', { officeName, description, startDate, endDate, is_active, candidatesCount: candidates?.length });

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Update poll details
      const pollResult = await client.query(
        `UPDATE polls 
         SET office_name = COALESCE($1, office_name),
             description = COALESCE($2, description),
             start_date = COALESCE($3, start_date),
             end_date = COALESCE($4, end_date),
             is_active = COALESCE($5, is_active),
             scope = COALESCE($6, scope),
             county_id = COALESCE($7, county_id),
             county_name = COALESCE($8, county_name),
             sub_county_id = COALESCE($9, sub_county_id),
             sub_county_name = COALESCE($10, sub_county_name),
             ward_id = COALESCE($11, ward_id),
             ward_name = COALESCE($12, ward_name),
             polling_station = COALESCE($13, polling_station),
             updated_at = NOW()
         WHERE id = $14
         RETURNING *`,
        [officeName, description, startDate, endDate, is_active,
         scope || null, countyId || null, countyName || null,
         subCountyId || null, subCountyName || null,
         wardId || null, wardName || null, pollingStation || null,
         id]
      );

      if (pollResult.rows.length === 0) {
        throw new Error('Poll not found');
      }

      // Handle candidates if provided
      if (candidates && Array.isArray(candidates)) {
        // Get existing candidates
        const existingCandidates = await client.query(
          'SELECT id FROM candidates WHERE poll_id = $1',
          [id]
        );
        const existingIds = existingCandidates.rows.map(c => c.id);
        const incomingIds = candidates.filter(c => c.id).map(c => c.id);

        // Delete candidates that are no longer in the list
        const toDelete = existingIds.filter(id => !incomingIds.includes(id));
        if (toDelete.length > 0) {
          await client.query(
            'DELETE FROM candidates WHERE id = ANY($1) AND poll_id = $2',
            [toDelete, id]
          );
        }

        // Update or insert candidates
        for (const candidate of candidates) {
          if (candidate.id) {
            // Update existing candidate
            await client.query(
              `UPDATE candidates 
               SET name = $1, 
                   party = $2, 
                   photo_url = $3, 
                   description = $4,
                   county_id = $5,
                   county_name = $6,
                   sub_county_id = $7,
                   sub_county_name = $8,
                   ward_id = $9,
                   ward_name = $10,
                   polling_station = $11
               WHERE id = $12 AND poll_id = $13`,
              [
                candidate.name,
                candidate.party,
                candidate.photoUrl || null,
                candidate.description || null,
                candidate.countyId || null,
                candidate.countyName || null,
                candidate.subCountyId || null,
                candidate.subCountyName || null,
                candidate.wardId || null,
                candidate.wardName || null,
                candidate.pollingStation || null,
                candidate.id,
                id
              ]
            );
          } else {
            // Insert new candidate
            await client.query(
              `INSERT INTO candidates (
                poll_id, name, party, photo_url, description,
                county_id, county_name, sub_county_id, sub_county_name,
                ward_id, ward_name, polling_station
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                id,
                candidate.name,
                candidate.party,
                candidate.photoUrl || null,
                candidate.description || null,
                candidate.countyId || null,
                candidate.countyName || null,
                candidate.subCountyId || null,
                candidate.subCountyName || null,
                candidate.wardId || null,
                candidate.wardName || null,
                candidate.pollingStation || null
              ]
            );
          }
        }
      }

      await client.query('COMMIT');

      console.log('Poll updated successfully:', id);

      res.json({
        message: 'Poll updated successfully',
        pollId: id
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating poll:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ========== NEW ENHANCED ENDPOINTS ==========

// Get poll results details
router.get('/polls/:id/results', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const pollResult = await db.query(
      `SELECT p.* FROM polls p WHERE p.id = $1`,
      [id]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const candidateResults = await db.query(
      `SELECT c.*, COUNT(v.id) as vote_count
       FROM candidates c
       LEFT JOIN votes v ON c.id = v.candidate_id
       WHERE c.poll_id = $1
       GROUP BY c.id
       ORDER BY vote_count DESC`,
      [id]
    );

    const voteBreakdown = await db.query(
      `SELECT 
         v.county,
         COUNT(*) as votes,
         COUNT(DISTINCT v.user_id) as unique_voters
       FROM votes v
       WHERE v.poll_id = $1
       GROUP BY v.county
       ORDER BY votes DESC`,
      [id]
    );

    res.json({
      poll: pollResult.rows[0],
      candidates: candidateResults.rows,
      breakdown: voteBreakdown.rows
    });

  } catch (error) {
    console.error('Error fetching poll results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users for admin dashboard (NEW)
// Replace the existing /users endpoint with this updated version
router.get('/users', authenticateAdmin, authorizeAdmin('viewUsers'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        u.id,
        u.email,
        u.phone,
        u.county_id,
        u.county_name,
        u.sub_county_id,
        u.sub_county_name,
        u.ward_id,
        u.ward_name,
        u.polling_station,
        u.is_email_verified,
        u.is_phone_verified,
        u.created_at,
        COUNT(v.id) as vote_count,
        MAX(v.created_at) as last_vote_date
      FROM users u
      LEFT JOIN votes v ON u.id = v.user_id
    `;

    const params = [];

    if (search) {
      query += ` WHERE u.email ILIKE $1 
                OR u.county_name ILIKE $1
                OR u.sub_county_name ILIKE $1
                OR u.ward_name ILIKE $1
                OR u.polling_station ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination
    const countQuery = search
      ? `SELECT COUNT(*) as total FROM users WHERE email ILIKE $1 OR county_name ILIKE $1 OR sub_county_name ILIKE $1 OR ward_name ILIKE $1 OR polling_station ILIKE $1`
      : `SELECT COUNT(*) as total FROM users`;

    const countParams = search ? [`%${search}%`] : [];
    const countResult = await db.query(countQuery, countParams);

    // Transform the data to match frontend expectations
    const transformedUsers = result.rows.map(user => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      countyId: user.county_id,
      countyName: user.county_name,
      subCountyId: user.sub_county_id,
      subCountyName: user.sub_county_name,
      wardId: user.ward_id,
      wardName: user.ward_name,
      pollingStation: user.polling_station,
      isEmailVerified: user.is_email_verified,
      isPhoneVerified: user.is_phone_verified,
      createdAt: user.created_at,
      voteCount: parseInt(user.vote_count) || 0,
      lastVoteDate: user.last_vote_date
    }));

    res.json({
      users: transformedUsers,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add the other missing user management endpoints after the existing ones:

// Get user by ID
router.get('/users/:id', authenticateAdmin, authorizeAdmin('viewUsers'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        u.*,
        COUNT(v.id) as vote_count,
        JSON_AGG(DISTINCT jsonb_build_object(
          'poll_id', v.poll_id,
          'candidate_id', v.candidate_id,
          'voted_at', v.created_at
        )) as vote_history
       FROM users u
       LEFT JOIN votes v ON u.id = v.user_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      countyId: user.county_id,
      countyName: user.county_name,
      subCountyId: user.sub_county_id,
      subCountyName: user.sub_county_name,
      wardId: user.ward_id,
      wardName: user.ward_name,
      pollingStation: user.polling_station,
      isEmailVerified: user.is_email_verified,
      isPhoneVerified: user.is_phone_verified,
      createdAt: user.created_at,
      voteCount: parseInt(user.vote_count) || 0,
      voteHistory: user.vote_history || []
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/users/:id', authenticateAdmin, authorizeAdmin('manageUsers'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email,
      phone,
      countyId,
      countyName,
      subCountyId,
      subCountyName,
      wardId,
      wardName,
      pollingStation,
      isEmailVerified,
      isPhoneVerified
    } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET email = COALESCE($1, email),
           phone = COALESCE($2, phone),
           county_id = COALESCE($3, county_id),
           county_name = COALESCE($4, county_name),
           sub_county_id = COALESCE($5, sub_county_id),
           sub_county_name = COALESCE($6, sub_county_name),
           ward_id = COALESCE($7, ward_id),
           ward_name = COALESCE($8, ward_name),
           polling_station = COALESCE($9, polling_station),
           is_email_verified = COALESCE($10, is_email_verified),
           is_phone_verified = COALESCE($11, is_phone_verified),
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        email, phone, 
        countyId, countyName, 
        subCountyId, subCountyName,
        wardId, wardName,
        pollingStation, 
        isEmailVerified, isPhoneVerified, 
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      countyId: user.county_id,
      countyName: user.county_name,
      subCountyId: user.sub_county_id,
      subCountyName: user.sub_county_name,
      wardId: user.ward_id,
      wardName: user.ward_name,
      pollingStation: user.polling_station,
      isEmailVerified: user.is_email_verified,
      isPhoneVerified: user.is_phone_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk delete users
router.post('/users/bulk-delete', authenticateAdmin, authorizeAdmin('manageUsers'), async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No user IDs provided' });
    }

    // Check if any of the users have votes (prevent deletion of users with voting history)
    const votesResult = await db.query(
      'SELECT COUNT(*) as vote_count FROM votes WHERE user_id = ANY($1)',
      [userIds]
    );

    if (parseInt(votesResult.rows[0].vote_count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete users with voting history. Consider deactivating instead.'
      });
    }

    // Delete users
    await db.query(
      'DELETE FROM users WHERE id = ANY($1) AND NOT EXISTS (SELECT 1 FROM votes WHERE user_id = users.id)',
      [userIds]
    );

    res.json({
      message: `Successfully deleted ${userIds.length} user(s)`,
      deletedCount: userIds.length
    });

  } catch (error) {
    console.error('Error deleting users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete single user
router.delete('/users/:id', authenticateAdmin, authorizeAdmin('manageUsers'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has votes (prevent deletion of users with voting history)
    const votesResult = await db.query(
      'SELECT COUNT(*) as vote_count FROM votes WHERE user_id = $1',
      [id]
    );

    if (parseInt(votesResult.rows[0].vote_count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete user with voting history. Consider deactivating instead.'
      });
    }

    // Delete user
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete user (deactivate instead of delete)
router.patch('/users/:id/deactivate', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE users 
       SET is_active = false, 
           deactivated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, is_active, deactivated_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deactivated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics data (NEW)
router.get('/analytics', authenticateAdmin, authorizeAdmin('viewAnalytics'), async (req, res) => {
  try {
    const { range = '7d', pollId } = req.query;
    let dateFilter = '';
    let whereClauseFilter = '';

    switch (range) {
      case '7d': 
        dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'"; 
        whereClauseFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d': 
        dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'"; 
        whereClauseFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d': 
        dateFilter = "AND created_at >= NOW() - INTERVAL '90 days'"; 
        whereClauseFilter = "WHERE created_at >= NOW() - INTERVAL '90 days'";
        break;
      case '1y': 
        dateFilter = "AND created_at >= NOW() - INTERVAL '1 year'"; 
        whereClauseFilter = "WHERE created_at >= NOW() - INTERVAL '1 year'";
        break;
      default:
        dateFilter = '';
        whereClauseFilter = '';
    }

    // Daily votes
    const dailyVotes = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM votes 
       WHERE created_at IS NOT NULL ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // Poll participation
    const pollParticipation = await db.query(
      `SELECT p.id, p.office_name as poll_name,
              COUNT(DISTINCT v.user_id) as voter_count,
              (COUNT(DISTINCT v.user_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM users WHERE is_email_verified = true), 0)) as participation_rate
       FROM polls p
       LEFT JOIN votes v ON p.id = v.poll_id
       GROUP BY p.id, p.office_name
       ORDER BY participation_rate DESC`
    );

    // Location distribution
    const locationDistribution = await db.query(
      `SELECT county_name as county, COUNT(*) as votes, 
              COUNT(DISTINCT user_id) as unique_voters
       FROM votes 
       WHERE county_name IS NOT NULL ${dateFilter}
       GROUP BY county_name
       ORDER BY votes DESC`
    );

    // User activity by hour
    const userActivity = await db.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as activity
       FROM votes 
       WHERE created_at IS NOT NULL ${dateFilter}
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`
    );

    // Summary statistics
    const summary = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_email_verified = true) as total_verified_users,
        (SELECT COUNT(*) FROM polls WHERE is_active = true) as active_polls,
        (SELECT COUNT(*) FROM votes ${whereClauseFilter}) as recent_votes,
        (SELECT COUNT(DISTINCT user_id) FROM votes ${whereClauseFilter}) as recent_voters
    `);

    res.json({
      summary: summary.rows[0],
      dailyVotes: dailyVotes.rows,
      pollParticipation: pollParticipation.rows,
      locationDistribution: locationDistribution.rows,
      userActivity: userActivity.rows
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export data (NEW)
router.get('/export/:type', authenticateAdmin, authorizeAdmin('exportData'), async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'csv', pollId } = req.query;

    let query, filename;

    switch (type) {
      case 'users':
        query = `SELECT * FROM users ORDER BY created_at DESC`;
        filename = 'users-export';
        break;
      case 'votes':
        if (pollId) {
          query = `
               SELECT v.*, u.email,
                 u.county_id, u.county_name, u.sub_county_id, u.sub_county_name,
                 u.ward_id, u.ward_name, u.polling_station,
                 p.office_name, c.name as candidate_name, c.party
            FROM votes v
            JOIN users u ON v.user_id = u.id
            JOIN polls p ON v.poll_id = p.id
            JOIN candidates c ON v.candidate_id = c.id
            WHERE v.poll_id = $1
            ORDER BY v.created_at DESC
          `;
          filename = `votes-poll-${pollId}-export`;
        } else {
          query = `
                 SELECT v.*, u.email,
                   u.county_id, u.county_name, u.sub_county_id, u.sub_county_name,
                   u.ward_id, u.ward_name, u.polling_station,
                   p.office_name, c.name as candidate_name, c.party
            FROM votes v
            JOIN users u ON v.user_id = u.id
            JOIN polls p ON v.poll_id = p.id
            JOIN candidates c ON v.candidate_id = c.id
            ORDER BY v.created_at DESC
          `;
          filename = 'votes-export';
        }
        break;
      case 'polls':
        query = `
          SELECT p.*, 
                 COUNT(DISTINCT v.id) as total_votes,
                 COUNT(DISTINCT c.id) as candidate_count,
                 (SELECT COUNT(DISTINCT user_id) FROM votes WHERE poll_id = p.id) as unique_voters
          FROM polls p
          LEFT JOIN votes v ON p.id = v.poll_id
          LEFT JOIN candidates c ON p.id = c.poll_id
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `;
        filename = 'polls-export';
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    const params = pollId ? [pollId] : [];
    const result = await db.query(query, params);

    if (format === 'csv') {
      // Convert to CSV
      const headers = result.rows.length > 0
        ? Object.keys(result.rows[0]).map(header => `"${header}"`).join(',')
        : '';

      const csvRows = result.rows.map(row =>
        Object.values(row).map(val => {
          if (val === null || val === undefined) return '""';
          const stringVal = String(val);
          return `"${stringVal.replace(/"/g, '""')}"`;
        }).join(',')
      );

      const csvContent = headers + '\n' + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);

    } else if (format === 'json') {
      res.json(result.rows);
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or json' });
    }

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update poll details
// router.put('/polls/:id', authenticateAdmin, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { officeName, description, startDate, endDate, is_active } = req.body;

//     const result = await db.query(
//       `UPDATE polls 
//        SET office_name = COALESCE($1, office_name),
//            description = COALESCE($2, description),
//            start_date = COALESCE($3, start_date),
//            end_date = COALESCE($4, end_date),
//            is_active = COALESCE($5, is_active),
//            updated_at = NOW()
//        WHERE id = $6
//        RETURNING *`,
//       [officeName, description, startDate, endDate, is_active, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Poll not found' });
//     }

//     res.json({
//       message: 'Poll updated successfully',
//       poll: result.rows[0]
//     });

//   } catch (error) {
//     console.error('Error updating poll:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// ========== SURVEY MANAGEMENT ENDPOINTS ==========

// Create a new survey
router.post('/surveys', authenticateAdmin, authorizeAdmin('manageSurveys'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const {
      question,
      description,
      startDate,
      endDate,
      scope = 'GENERAL',
      countyId,
      subCountyId,
      wardId,
      options
    } = req.body;

    // Validation
    if (!question || !startDate || !endDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Question, start date, and end date are required' });
    }

    if (!options || options.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least 2 options are required' });
    }

    // Validate scope-specific requirements
    if (scope === 'COUNTY' && !countyId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'County ID required for COUNTY scope' });
    }
    if (scope === 'SUB_COUNTY' && (!countyId || !subCountyId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'County and Sub-County IDs required for SUB_COUNTY scope' });
    }
    if (scope === 'WARD' && (!countyId || !subCountyId || !wardId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'County, Sub-County, and Ward IDs required for WARD scope' });
    }

    // Create survey
    const surveyResult = await client.query(
      `INSERT INTO surveys 
        (question, description, start_date, end_date, is_active, scope, county_id, sub_county_id, ward_id, created_by)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9)
       RETURNING id, question, description, start_date AS "startDate", end_date AS "endDate", 
                 is_active, scope, county_id AS "countyId", sub_county_id AS "subCountyId", 
                 ward_id AS "wardId", created_at AS "createdAt"`,
      [question, description, startDate, endDate, scope, countyId || null, subCountyId || null, wardId || null, req.admin.adminId]
    );

    const survey = surveyResult.rows[0];

    // Create options
    const optionPromises = options.map((option, index) =>
      client.query(
        `INSERT INTO survey_options (survey_id, option_text, display_order)
         VALUES ($1, $2, $3)
         RETURNING id, option_text AS "optionText", vote_count AS "voteCount"`,
        [survey.id, option.optionText, index]
      )
    );

    const optionResults = await Promise.all(optionPromises);
    const createdOptions = optionResults.map(result => result.rows[0]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Survey created successfully',
      survey: {
        ...survey,
        options: createdOptions
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating survey:', error);
    res.status(500).json({ error: 'Failed to create survey' });
  } finally {
    client.release();
  }
});

// Get all surveys (admin view)
router.get('/surveys', authenticateAdmin, async (req, res) => {
  try {
    const { scope, is_active } = req.query;

    let query = `
      SELECT 
        s.id,
        s.question,
        s.description,
        s.start_date AS "startDate",
        s.end_date AS "endDate",
        s.is_active,
        s.scope,
        s.county_id AS "countyId",
        s.sub_county_id AS "subCountyId",
        s.ward_id AS "wardId",
        s.created_at AS "createdAt",
        COUNT(DISTINCT sv.id) AS "totalVotes"
      FROM surveys s
      LEFT JOIN survey_votes sv ON s.id = sv.survey_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (scope) {
      query += ` AND s.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND s.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const result = await db.query(query, params);

    // Fetch options for each survey
    const surveysWithOptions = await Promise.all(
      result.rows.map(async (survey) => {
        const optionsResult = await db.query(
          `SELECT 
            id, 
            option_text AS "optionText",
            vote_count AS "voteCount"
          FROM survey_options 
          WHERE survey_id = $1 
          ORDER BY display_order`,
          [survey.id]
        );

        return {
          ...survey,
          totalVotes: parseInt(survey.totalVotes) || 0,
          options: optionsResult.rows
        };
      })
    );

    res.json(surveysWithOptions);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

// Update survey
router.put('/surveys/:id', authenticateAdmin, authorizeAdmin('manageSurveys'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { question, description, startDate, endDate, scope, countyId, subCountyId, wardId, options } = req.body;

    // Update survey
    const surveyResult = await client.query(
      `UPDATE surveys 
       SET question = COALESCE($1, question),
           description = COALESCE($2, description),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           scope = COALESCE($5, scope),
           county_id = COALESCE($6, county_id),
           sub_county_id = COALESCE($7, sub_county_id),
           ward_id = COALESCE($8, ward_id)
       WHERE id = $9
       RETURNING *`,
      [question, description, startDate, endDate, scope, countyId, subCountyId, wardId, id]
    );

    if (surveyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Update options if provided
    if (options && Array.isArray(options)) {
      // Delete existing options
      await client.query('DELETE FROM survey_options WHERE survey_id = $1', [id]);

      // Create new options
      const optionPromises = options.map((option, index) =>
        client.query(
          `INSERT INTO survey_options (survey_id, option_text, display_order)
           VALUES ($1, $2, $3)
           RETURNING id, option_text AS "optionText", vote_count AS "voteCount"`,
          [id, option.optionText, index]
        )
      );

      await Promise.all(optionPromises);
    }

    await client.query('COMMIT');

    res.json({ message: 'Survey updated successfully', surveyId: id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating survey:', error);
    res.status(500).json({ error: 'Failed to update survey' });
  } finally {
    client.release();
  }
});

// Toggle survey status
router.patch('/surveys/:id/toggle', authenticateAdmin, authorizeAdmin('manageSurveys'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE surveys 
       SET is_active = NOT is_active
       WHERE id = $1
       RETURNING is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    res.json({
      message: 'Survey status toggled successfully',
      is_active: result.rows[0].is_active
    });
  } catch (error) {
    console.error('Error toggling survey status:', error);
    res.status(500).json({ error: 'Failed to toggle survey status' });
  }
});

// Delete survey
router.delete('/surveys/:id', authenticateAdmin, authorizeAdmin('manageSurveys'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Delete votes first
    await client.query('DELETE FROM survey_votes WHERE survey_id = $1', [id]);

    // Delete options
    await client.query('DELETE FROM survey_options WHERE survey_id = $1', [id]);

    // Delete survey
    const result = await client.query('DELETE FROM surveys WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Survey not found' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Survey deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting survey:', error);
    res.status(500).json({ error: 'Failed to delete survey' });
  } finally {
    client.release();
  }
});

export default router;