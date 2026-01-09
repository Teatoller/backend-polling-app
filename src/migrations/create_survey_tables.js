// migrations/create_survey_tables.js
import { db } from '../config/database.js';

async function createSurveyTables() {
  const client = await db.getClient();

  try {
    console.log('Starting survey tables migration...');
    await client.query('BEGIN');

    // Create surveys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        question VARCHAR(500) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        scope VARCHAR(20) DEFAULT 'GENERAL' CHECK (scope IN ('GENERAL', 'NATIONAL', 'COUNTY', 'SUB_COUNTY', 'WARD')),
        county_id INTEGER,
        sub_county_id INTEGER,
        ward_id INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Surveys table created');

    // Create survey_options table
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_options (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        option_text VARCHAR(300) NOT NULL,
        vote_count INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Survey options table created');

    // Create survey_votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_votes (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES survey_options(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(survey_id, user_id)
      )
    `);
    console.log('✓ Survey votes table created');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_surveys_active ON surveys(is_active);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_surveys_scope ON surveys(scope);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_surveys_county ON surveys(county_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_survey_options_survey ON survey_options(survey_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_survey_votes_survey ON survey_votes(survey_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_survey_votes_user ON survey_votes(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_survey_votes_option ON survey_votes(option_id);
    `);
    console.log('✓ Indexes created');

    await client.query('COMMIT');
    console.log('✅ Survey tables migration completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating survey tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSurveyTables()
    .then(() => {
      console.log('Migration finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default createSurveyTables;
