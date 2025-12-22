// backend/routes/auth.js
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
    const { 
      nationalId, 
      email, 
      phone, 
      password, 
      confirmPassword, 
      countyId,
      countyName,
      subCountyId,
      subCountyName,
      wardId,
      wardName,
      pollingStation 
    } = req.body;

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
        national_id, email, phone, password_hash, 
        county_id, county_name, sub_county_id, sub_county_name, 
        ward_id, ward_name, polling_station,
        email_verification_token, phone_verification_code, phone_verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() + INTERVAL '10 minutes')
      RETURNING id, email, phone, county_name, sub_county_name, ward_name, polling_station`,
      [
        nationalId, email, phone, passwordHash, 
        countyId, countyName, subCountyId, subCountyName,
        wardId, wardName, pollingStation,
        emailVerificationToken, phoneVerificationCode
      ]
    );

    const user = result.rows[0];

    // Send verification emails and SMS (non-blocking in development)
    try {
      await sendVerificationEmail(email, emailVerificationToken);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Email sending failed (non-blocking):', emailError.message);
      // Continue with registration even if email fails
    }
    
    // Send SMS verification if phone is provided
    if (phone) {
      try {
        const smsService = getSMSService();
        await smsService.sendVerificationSMS(phone, phoneVerificationCode);
        console.log('SMS verification sent successfully');
      } catch (smsError) {
        console.error('SMS sending failed (non-blocking):', smsError.message);
        // Continue with registration even if SMS fails
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Registration successful. Please verify your email and phone.',
      user: {
        id: user.id,
        email: user.email,
        countyName: user.county_name,
        subCountyName: user.sub_county_name,
        wardName: user.ward_name,
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
              county_id, county_name, sub_county_id, sub_county_name,
              ward_id, ward_name, polling_station 
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
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        countyId: user.county_id,
        countyName: user.county_name,
        subCountyId: user.sub_county_id,
        subCountyName: user.sub_county_name,
        wardId: user.ward_id,
        wardName: user.ward_name,
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

// Forgot Password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const result = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists or not
      return res.json({ 
        message: 'If your email exists in our system, you will receive a reset link' 
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: result.rows[0].id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // Store reset token in database
    await db.query(
      `UPDATE users SET password_reset_token = $1, 
       password_reset_expires = NOW() + INTERVAL '1 hour' 
       WHERE id = $2`,
      [resetToken, result.rows[0].id]
    );

    // Send reset email (you'll need to implement sendPasswordResetEmail)
    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    await sendPasswordResetEmail(email, resetToken);

    res.json({ 
      message: 'Password reset instructions sent to your email' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Password endpoint
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if token exists and hasn't expired in database
    const userResult = await db.query(
      `SELECT id FROM users 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW()`,
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await db.query(
      `UPDATE users 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL 
       WHERE id = $2`,
      [passwordHash, userResult.rows[0].id]
    );

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;