import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function dropAllTables() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Dropping all tables...');
    
    await client.query('BEGIN');

    // Drop tables in correct order (respecting foreign keys)
    await client.query('DROP TABLE IF EXISTS votes CASCADE');
    await client.query('DROP TABLE IF EXISTS candidates CASCADE');
    await client.query('DROP TABLE IF EXISTS polls CASCADE');
    await client.query('DROP TABLE IF EXISTS system_settings CASCADE');
    await client.query('DROP TABLE IF EXISTS admin_users CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    // Drop lookup tables if they exist
    await client.query('DROP TABLE IF EXISTS wards CASCADE');
    await client.query('DROP TABLE IF EXISTS sub_counties CASCADE');
    await client.query('DROP TABLE IF EXISTS constituencies CASCADE');
    await client.query('DROP TABLE IF EXISTS counties CASCADE');
    
    await client.query('COMMIT');
    
    console.log('✅ All tables dropped successfully');
    console.log('📝 You can now run: node src/migrations/migrate.js');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

dropAllTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Drop failed:', error);
    process.exit(1);
  });
