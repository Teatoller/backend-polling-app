// src/migrations/migrate.js
import { db } from '../config/database.js';
import bcrypt from 'bcryptjs';

const createTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        national_id VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        county_id INTEGER,
        county_name VARCHAR(100) NOT NULL,
        sub_county_id INTEGER,
        sub_county_name VARCHAR(100) NOT NULL,
        ward_id INTEGER,
        ward_name VARCHAR(100) NOT NULL,
        polling_station VARCHAR(100) NOT NULL,
        is_email_verified BOOLEAN DEFAULT FALSE,
        is_phone_verified BOOLEAN DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        phone_verification_code VARCHAR(6),
        phone_verification_expires TIMESTAMP,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        office_name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        party VARCHAR(255) NOT NULL,
        photo_url VARCHAR(500),
        description TEXT,
        county_id INTEGER,
        county_name VARCHAR(100),
        sub_county_id INTEGER,
        sub_county_name VARCHAR(100),
        ward_id INTEGER,
        ward_name VARCHAR(100),
        polling_station VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        polling_station VARCHAR(100) NOT NULL,
        county_id INTEGER,
        county_name VARCHAR(100) NOT NULL,
        sub_county_id INTEGER,
        sub_county_name VARCHAR(100) NOT NULL,
        ward_id INTEGER,
        ward_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, poll_id)
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row_check CHECK (id = 1)
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_votes_user_poll ON votes(user_id, poll_id);
      CREATE INDEX IF NOT EXISTS idx_votes_poll_candidate ON votes(poll_id, candidate_id);
      CREATE INDEX IF NOT EXISTS idx_polls_active ON polls(is_active, end_date);
    `);

    console.log('Tables created successfully');
    
    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    await db.query(
      `INSERT INTO admin_users (email, password_hash) 
       VALUES ($1, $2) 
       ON CONFLICT (email) DO NOTHING`,
      ['admin@pollingapp.com', adminPassword]
    );
    
    console.log('Default admin user created: admin@pollingapp.com / admin123');
    
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
};

createTables().then(() => {
  console.log('Migration completed');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});