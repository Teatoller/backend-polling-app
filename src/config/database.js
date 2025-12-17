// src/config/database.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this.pool = this.createPool();
    this.setupEventListeners();
  }

  createPool() {
    // Heroku provides DATABASE_URL, local uses separate vars
    const connectionString = process.env.DATABASE_URL;
    
    if (connectionString) {
      // Production (Heroku)
      console.log('📊 Using DATABASE_URL for production connection');
      return new Pool({
        connectionString: connectionString,
        ssl: {
          rejectUnauthorized: false  // REQUIRED for Heroku Postgres
        }
      });
    } else {
      // Development (local)
      console.log('📊 Using local database configuration');
      return new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'polling_app',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: false
      });
    }
  }

  setupEventListeners() {
    this.pool.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });
  }

  async query(text, params) {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }
}

export const db = new Database();
export default db;