// routes/surveys.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateSurveyVote } from '../middleware/validation.js';

const router = express.Router();
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { scope, is_active, county_id } = req.query;
    const userId = req.user.userId;
    const userCountyId = req.user.countyId;
    const userSubCountyId = req.user.subCountyId;
    const userWardId = req.user.wardId;

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
        COUNT(DISTINCT sv.id) AS "totalVotes",
        EXISTS(
          SELECT 1 FROM survey_votes sv2 
          WHERE sv2.survey_id = s.id AND sv2.user_id = $1
        ) AS "hasVoted"
      FROM surveys s
      LEFT JOIN survey_votes sv ON s.id = sv.survey_id
      WHERE 1=1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filter by scope
    if (scope) {
      query += ` AND s.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }

    // Filter by active status
    if (is_active !== undefined) {
      query += ` AND s.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    // Filter by county
    if (county_id) {
      query += ` AND s.county_id = $${paramIndex}`;
      params.push(county_id);
      paramIndex++;
    }

    // Filter by user's location based on scope
    query += ` AND (
      s.scope = 'GENERAL' OR
      s.scope = 'NATIONAL' OR
      (s.scope = 'COUNTY' AND s.county_id = $${paramIndex}) OR
      (s.scope = 'SUB_COUNTY' AND s.sub_county_id = $${paramIndex + 1}) OR
      (s.scope = 'WARD' AND s.ward_id = $${paramIndex + 2})
    )`;
    params.push(userCountyId, userSubCountyId, userWardId);

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
          ORDER BY id`,
          [survey.id]
        );

        return {
          ...survey,
          totalVotes: parseInt(survey.totalVotes) || 0,
          hasVoted: survey.hasVoted || false,
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

// Get survey by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const surveyResult = await db.query(
      `SELECT 
        s.id,
        s.question,
        s.description,
        s.start_date AS "startDate",
        s.end_date AS "endDate",
        s.is_active,
        s.scope,
        s.county_id AS "countyId",
        c.name AS "countyName",
        s.sub_county_id AS "subCountyId",
        sc.name AS "subCountyName",
        s.ward_id AS "wardId",
        w.name AS "wardName",
        s.created_at AS "createdAt",
        EXISTS(
          SELECT 1 FROM survey_votes sv 
          WHERE sv.survey_id = s.id AND sv.user_id = $2
        ) AS "hasVoted"
      FROM surveys s
      LEFT JOIN counties c ON s.county_id = c.id
      LEFT JOIN sub_counties sc ON s.sub_county_id = sc.id
      LEFT JOIN wards w ON s.ward_id = w.id
      WHERE s.id = $1`,
      [id, userId]
    );

    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Fetch options
    const optionsResult = await db.query(
      `SELECT 
        id, 
        option_text AS "optionText",
        vote_count AS "voteCount"
      FROM survey_options 
      WHERE survey_id = $1 
      ORDER BY id`,
      [id]
    );

    const survey = {
      ...surveyResult.rows[0],
      hasVoted: surveyResult.rows[0].hasVoted || false,
      options: optionsResult.rows
    };

    res.json(survey);
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: 'Failed to fetch survey' });
  }
});

// Check vote status for a survey
router.get('/:id/vote-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT option_id AS "optionId" 
       FROM survey_votes 
       WHERE survey_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length > 0) {
      res.json({ hasVoted: true, optionId: result.rows[0].optionId });
    } else {
      res.json({ hasVoted: false });
    }
  } catch (error) {
    console.error('Error checking vote status:', error);
    res.status(500).json({ error: 'Failed to check vote status' });
  }
});

// Submit survey vote
router.post('/vote', authenticateToken, validateSurveyVote, async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { surveyId, optionId } = req.body;
    const userId = req.user.userId;

    // Check if survey exists and is active
    const surveyResult = await client.query(
      'SELECT id, is_active, end_date FROM surveys WHERE id = $1',
      [surveyId]
    );

    if (surveyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Survey not found' });
    }

    const survey = surveyResult.rows[0];
    if (!survey.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Survey is not active' });
    }

    if (new Date(survey.end_date) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Survey has ended' });
    }

    // Check if option exists
    const optionResult = await client.query(
      'SELECT id FROM survey_options WHERE id = $1 AND survey_id = $2',
      [optionId, surveyId]
    );

    if (optionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Option not found' });
    }

    // Check if user already voted
    const voteCheck = await client.query(
      'SELECT id FROM survey_votes WHERE survey_id = $1 AND user_id = $2',
      [surveyId, userId]
    );

    if (voteCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already voted in this survey' });
    }

    // Insert vote
    const voteResult = await client.query(
      `INSERT INTO survey_votes (survey_id, option_id, user_id, voted_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, voted_at AS "votedAt"`,
      [surveyId, optionId, userId]
    );

    // Update option vote count
    await client.query(
      `UPDATE survey_options 
       SET vote_count = vote_count + 1
       WHERE id = $1`,
      [optionId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Vote submitted successfully',
      vote: voteResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  } finally {
    client.release();
  }
});

// Get survey results
router.get('/:id/results', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get survey info
    const surveyResult = await db.query(
      `SELECT 
        s.id,
        s.question,
        s.description,
        s.start_date AS "startDate",
        s.end_date AS "endDate",
        s.is_active,
        s.scope,
        s.county_id AS "countyId",
        NULL::text AS "countyName",
        s.sub_county_id AS "subCountyId",
        NULL::text AS "subCountyName",
        s.ward_id AS "wardId",
        NULL::text AS "wardName",
        s.created_at AS "createdAt"
      FROM surveys s
      WHERE s.id = $1`,
      [id]
    );

    if (surveyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const survey = surveyResult.rows[0];

    // Get options with vote counts and percentages
    const optionsResult = await db.query(
      `SELECT 
        id, 
        option_text AS "optionText",
        vote_count AS "voteCount"
      FROM survey_options 
      WHERE survey_id = $1 
      ORDER BY vote_count DESC, id`,
      [id]
    );

    // Calculate total votes
    const totalVotes = optionsResult.rows.reduce((sum, opt) => sum + parseInt(opt.voteCount || 0), 0);

    // Add percentages
    const options = optionsResult.rows.map(option => ({
      ...option,
      voteCount: parseInt(option.voteCount) || 0,
      percentage: totalVotes > 0 ? ((parseInt(option.voteCount) || 0) / totalVotes) * 100 : 0
    }));

    res.json({
      survey,
      options,
      totalVotes
    });
  } catch (error) {
    console.error('Error fetching survey results:', error);
    res.status(500).json({ error: 'Failed to fetch survey results' });
  }
});

export default router;
