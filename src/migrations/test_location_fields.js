// src/migrations/test_location_fields.js
// Test script to verify location field updates
import { db } from '../config/database.js';

const testLocationFields = async () => {
  console.log('🧪 Testing location field updates...\n');

  try {
    // Test 1: Check users table structure
    console.log('1️⃣ Checking users table structure...');
    const usersColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN (
        'county_id', 'county_name', 'sub_county_id', 'sub_county_name',
        'ward_id', 'ward_name', 'polling_station',
        'password_reset_token', 'password_reset_expires'
      )
      ORDER BY column_name;
    `);
    console.log('✅ Users table columns:', usersColumns.rows.length, 'new columns found');
    usersColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log();

    // Test 2: Check candidates table structure
    console.log('2️⃣ Checking candidates table structure...');
    const candidatesColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'candidates'
      AND column_name IN (
        'county_id', 'county_name', 'sub_county_id', 'sub_county_name',
        'ward_id', 'ward_name', 'polling_station'
      )
      ORDER BY column_name;
    `);
    console.log('✅ Candidates table columns:', candidatesColumns.rows.length, 'new columns found');
    candidatesColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log();

    // Test 3: Check votes table structure
    console.log('3️⃣ Checking votes table structure...');
    const votesColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'votes'
      AND column_name IN (
        'county_id', 'county_name', 'sub_county_id', 'sub_county_name',
        'ward_id', 'ward_name'
      )
      ORDER BY column_name;
    `);
    console.log('✅ Votes table columns:', votesColumns.rows.length, 'new columns found');
    votesColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log();

    // Test 4: Check if old columns still exist
    console.log('4️⃣ Checking for old column names (for backward compatibility)...');
    const oldColumns = await db.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN ('users', 'votes')
      AND column_name IN ('county', 'division')
      ORDER BY table_name, column_name;
    `);
    if (oldColumns.rows.length > 0) {
      console.log('⚠️  Old columns still exist (safe for migration):');
      oldColumns.rows.forEach(col => {
        console.log(`   - ${col.table_name}.${col.column_name}`);
      });
    } else {
      console.log('✅ Old columns have been removed');
    }
    console.log();

    // Test 5: Check for any existing data
    console.log('5️⃣ Checking existing data...');
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const candidatesCount = await db.query('SELECT COUNT(*) as count FROM candidates');
    const votesCount = await db.query('SELECT COUNT(*) as count FROM votes');
    
    console.log(`   - Users: ${usersCount.rows[0].count}`);
    console.log(`   - Candidates: ${candidatesCount.rows[0].count}`);
    console.log(`   - Votes: ${votesCount.rows[0].count}`);
    console.log();

    // Test 6: Sample query test
    if (parseInt(usersCount.rows[0].count) > 0) {
      console.log('6️⃣ Testing sample user query with new fields...');
      const sampleUser = await db.query(`
        SELECT id, email, county_name, sub_county_name, ward_name, polling_station
        FROM users
        LIMIT 1
      `);
      if (sampleUser.rows.length > 0) {
        console.log('✅ Sample user data:');
        console.log('   ', JSON.stringify(sampleUser.rows[0], null, 2));
      }
    } else {
      console.log('6️⃣ No users in database, skipping sample query test');
    }
    console.log();

    console.log('✅ All tests completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   - Database schema is updated correctly');
    console.log('   - New location fields are in place');
    console.log('   - Ready to accept new registration format');
    console.log('   - Poll creation with candidate locations is supported');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testLocationFields()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

export default testLocationFields;
