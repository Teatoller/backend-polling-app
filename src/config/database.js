// src/config/database.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

class Database {
  constructor() {
    this.pool = new Pool(config);
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      console.error('Database connection error:', err);
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