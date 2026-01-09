// src/migrations/add_poll_scope_fields.js
import { db } from '../config/database.js';

async function addColumns() {
  try {
    console.log('Adding scope and location columns to polls table (if missing)...');

    await db.query(`
      ALTER TABLE polls
        ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'GENERAL',
        ADD COLUMN IF NOT EXISTS county_id INTEGER,
        ADD COLUMN IF NOT EXISTS county_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS sub_county_id INTEGER,
        ADD COLUMN IF NOT EXISTS sub_county_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS ward_id INTEGER,
        ADD COLUMN IF NOT EXISTS ward_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS polling_station VARCHAR(100);
    `);

    console.log('Polls table updated successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to update polls table:', error);
    process.exit(1);
  }
}

addColumns();
