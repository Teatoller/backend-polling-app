// backend/routes/auth.ts
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateRegistration, validateLogin } from '../middleware/validation.js';
import { db } from '../config/database.js';
import { generateSMSCode, getSMSService } from '../services/smsService.js';
import { generateEmailToken, sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

// Register endpoint
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { nationalId, email, phone, password, county, division, pollingStation } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE national_id = $1 OR email = $2',
      [nationalId, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'User with this National ID or email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification tokens
    const emailVerificationToken = generateEmailToken();
    const phoneVerificationCode = generateSMSCode();

    // Insert user
    const result = await db.query(
      `INSERT INTO users (
        national_id, email, phone, password_hash, county, division, polling_station,
        email_verification_token, phone_verification_code, phone_verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '10 minutes')
      RETURNING id, email, phone, county, division, polling_station`,
      [
        nationalId, email, phone, passwordHash, county, division, pollingStation,
        emailVerificationToken, phoneVerificationCode
      ]
    );

    const user = result.rows[0];

    // Send verification emails and SMS
    await sendVerificationEmail(email, emailVerificationToken);
    
    // Send SMS verification if phone is provided
    if (phone) {
      const smsService = getSMSService();
      await smsService.sendVerificationSMS(phone, phoneVerificationCode);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Registration successful. Please verify your email and phone.',
      user: {
        id: user.id,
        email: user.email,
        county: user.county,
        division: user.division,
        pollingStation: user.polling_station
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      `SELECT id, email, password_hash, is_email_verified, 
              county, division, polling_station 
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.is_email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        county: user.county,
        division: user.division,
        pollingStation: user.polling_station,
        isEmailVerified: user.is_email_verified
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Email endpoint
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      'UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL WHERE email_verification_token = $1 RETURNING id',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Phone endpoint
router.post('/verify-phone', async (req, res) => {
  try {
    const { phone, code } = req.body;

    const result = await db.query(
      `UPDATE users SET is_phone_verified = TRUE, 
       phone_verification_code = NULL, phone_verification_expires = NULL 
       WHERE phone = $1 AND phone_verification_code = $2 
       AND phone_verification_expires > NOW() 
       RETURNING id`,
      [phone, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    res.json({ message: 'Phone verified successfully' });

  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;