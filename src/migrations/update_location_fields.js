// Migration script to update location fields in existing database
// This script helps transition from old location fields to new ones
import { db } from '../config/database.js';

const updateLocationFields = async () => {
  const client = await db.getClient();
  
  try {
    console.log('Starting location fields migration...');
    
    await client.query('BEGIN');

    // Add new columns to users table if they don't exist
    console.log('Adding new location columns to users table...');
    await client.query(`
      DO $$ 
      BEGIN
        -- Add new location fields
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='county_id') THEN
          ALTER TABLE users ADD COLUMN county_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='county_name') THEN
          ALTER TABLE users ADD COLUMN county_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='sub_county_id') THEN
          ALTER TABLE users ADD COLUMN sub_county_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='sub_county_name') THEN
          ALTER TABLE users ADD COLUMN sub_county_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='ward_id') THEN
          ALTER TABLE users ADD COLUMN ward_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='ward_name') THEN
          ALTER TABLE users ADD COLUMN ward_name VARCHAR(100);
        END IF;

        -- Add password reset fields if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='password_reset_token') THEN
          ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='password_reset_expires') THEN
          ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMP;
        END IF;
      END $$;
    `);

    // Migrate existing data from old fields to new fields for users (only if old columns exist)
    console.log('Migrating existing user data...');
    
    // Check if old columns exist before migrating
    const oldColumnsExist = await client.query(`
      SELECT 
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='county') as has_county,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='division') as has_division
    `);
    
    if (oldColumnsExist.rows[0].has_county || oldColumnsExist.rows[0].has_division) {
      // Only run migration if old columns exist
      await client.query(`
        UPDATE users 
        SET 
          county_name = COALESCE(county, county_name, 'Unknown'),
          sub_county_name = COALESCE(division, sub_county_name, 'Unknown')
        WHERE county_name IS NULL OR sub_county_name IS NULL;
      `);
      console.log('Migrated data from old columns to new columns');
    } else {
      console.log('Old columns do not exist, skipping data migration');
    }

    // Add new columns to candidates table if they don't exist
    console.log('Adding new location columns to candidates table...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='county_id') THEN
          ALTER TABLE candidates ADD COLUMN county_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='county_name') THEN
          ALTER TABLE candidates ADD COLUMN county_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='sub_county_id') THEN
          ALTER TABLE candidates ADD COLUMN sub_county_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='sub_county_name') THEN
          ALTER TABLE candidates ADD COLUMN sub_county_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='ward_id') THEN
          ALTER TABLE candidates ADD COLUMN ward_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='ward_name') THEN
          ALTER TABLE candidates ADD COLUMN ward_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='candidates' AND column_name='polling_station') THEN
          ALTER TABLE candidates ADD COLUMN polling_station VARCHAR(100);
        END IF;
      END $$;
    `);

    // Add new columns to votes table if they don't exist
    console.log('Adding new location columns to votes table...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='votes' AND column_name='county_id') THEN
          ALTER TABLE votes ADD COLUMN county_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='votes' AND column_name='county_name') THEN
          ALTER TABLE votes ADD COLUMN county_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='votes' AND column_name='sub_county_id') THEN
          ALTER TABLE votes ADD COLUMN sub_county_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='votes' AND column_name='sub_county_name') THEN
          ALTER TABLE votes ADD COLUMN sub_county_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='votes' AND column_name='ward_id') THEN
          ALTER TABLE votes ADD COLUMN ward_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='votes' AND column_name='ward_name') THEN
          ALTER TABLE votes ADD COLUMN ward_name VARCHAR(100);
        END IF;
      END $$;
    `);

    // Migrate existing data from old fields to new fields for votes
    console.log('Migrating existing votes data...');
    await client.query(`
      UPDATE votes 
      SET 
        county_name = COALESCE(county, 'Unknown'),
        sub_county_name = COALESCE(division, 'Unknown')
      WHERE county_name IS NULL OR sub_county_name IS NULL;
    `);

    // Make the new fields NOT NULL after migration
    console.log('Setting constraints on new fields...');
    await client.query(`
      ALTER TABLE users 
        ALTER COLUMN county_name SET NOT NULL,
        ALTER COLUMN sub_county_name SET NOT NULL,
        ALTER COLUMN ward_name SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE votes 
        ALTER COLUMN county_name SET NOT NULL,
        ALTER COLUMN sub_county_name SET NOT NULL,
        ALTER COLUMN ward_name SET NOT NULL;
    `);

    // Optional: Drop old columns if you're sure you don't need them
    // Uncomment these lines after verifying the migration works
    /*
    console.log('Dropping old location columns...');
    await client.query(`
      ALTER TABLE users 
        DROP COLUMN IF EXISTS county,
        DROP COLUMN IF EXISTS division;
      
      ALTER TABLE votes 
        DROP COLUMN IF EXISTS county,
        DROP COLUMN IF EXISTS division;
    `);
    */

    await client.query('COMMIT');
    console.log('✅ Location fields migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  updateLocationFields()
    .then(() => {
      console.log('Migration completed. You can now use the new location fields.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default updateLocationFields;
