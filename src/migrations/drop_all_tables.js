// src/migrations/drop_all_tables.js
import dotenv from 'dotenv';
import { db } from '../config/database.js';

dotenv.config();

async function dropAllTables() {
  try {
    console.log('🗑️  Dropping all tables...');
    
    await db.query(`
      DROP TABLE IF EXISTS votes CASCADE;
      DROP TABLE IF EXISTS candidates CASCADE;
      DROP TABLE IF EXISTS polls CASCADE;
      DROP TABLE IF EXISTS system_settings CASCADE;
      DROP TABLE IF EXISTS admin_users CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS wards CASCADE;
      DROP TABLE IF EXISTS sub_counties CASCADE;
      DROP TABLE IF EXISTS constituencies CASCADE;
      DROP TABLE IF EXISTS counties CASCADE;
    `);
    
    console.log('✅ All tables dropped successfully');
    console.log('📝 You can now run: npm run migrate');
    
  } catch (error) {
    console.error('❌ Error dropping tables:', error);
    throw error;
  }
}

dropAllTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Drop failed:', error);
    process.exit(1);
  });