// src/migrations/remove_national_id.js
import { db } from '../config/database.js';

/**
 * Migration to remove national_id column from users table
 * This removes the national ID field that is no longer required for registration
 */
const removeNationalId = async () => {
  try {
    console.log('Starting migration: Removing national_id column from users table...');

    // Drop the unique constraint on national_id if it exists
    await db.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_national_id_key;
    `);
    console.log('✓ Dropped unique constraint on national_id');

    // Drop any indexes on national_id
    await db.query(`
      DROP INDEX IF EXISTS idx_users_national_id;
    `);
    console.log('✓ Dropped index on national_id');

    // Drop the national_id column
    await db.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS national_id;
    `);
    console.log('✓ Dropped national_id column from users table');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Rollback function to restore national_id column (if needed)
 * Note: This will add back the column but won't restore any data
 */
const rollback = async () => {
  try {
    console.log('Rolling back: Adding national_id column back to users table...');

    // Add the national_id column back (nullable since we can't restore data)
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS national_id VARCHAR(20);
    `);
    console.log('✓ Added national_id column back to users table');

    // Add unique constraint
    await db.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_national_id_key UNIQUE (national_id);
    `);
    console.log('✓ Added unique constraint on national_id');

    console.log('Rollback completed successfully!');
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
};

// Run migration
const runMigration = async () => {
  try {
    await removeNationalId();
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    try { await db.close(); } catch {}
    process.exit(1);
  }
};

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { removeNationalId, rollback };
