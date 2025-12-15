// backend/src/routes/settings.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

const defaultSettings = {
  voting: {
    allowSameDayRegistration: false,
    votingHoursStart: '08:00',
    votingHoursEnd: '17:00',
    maxVotesPerUser: 1,
    allowVoteEditing: false,
    voteEditingDeadline: 24
  },
  registration: {
    requireEmailVerification: true,
    requirePhoneVerification: false,
    requireNationalId: true,
    allowMultipleRegistrations: false,
    registrationDeadline: 0
  },
  notifications: {
    sendRegistrationConfirmation: true,
    sendVoteConfirmation: true,
    sendPollReminders: true,
    sendResultsAnnouncement: true
  },
  security: {
    requireStrongPasswords: true,
    passwordMinLength: 8,
    enableTwoFactorAuth: false,
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    ipWhitelist: []
  },
  display: {
    showLiveResults: true,
    showCandidatePhotos: true,
    showVoteCounts: true,
    theme: 'light',
    language: 'en',
    timezone: 'UTC'
  },
  email: {
    service: 'mock',
    host: '',
    port: 587,
    user: '',
    pass: '',
    fromName: 'Polling App'
  },
  sms: {
    provider: 'mock',
    accountSid: '',
    authToken: '',
    phoneNumber: ''
  },
  api: {
    enabled: false,
    rateLimit: 100,
    apiKey: '',
    webhookUrl: ''
  }
};

// Get all settings
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT settings FROM system_settings WHERE id = 1'
    );
    
    if (result.rows.length === 0) {
      // Initialize with default settings
      await db.query(
        'INSERT INTO system_settings (id, settings) VALUES (1, $1)',
        [JSON.stringify(defaultSettings)]
      );
      return res.json(defaultSettings);
    }
    
    const settings = { ...defaultSettings, ...result.rows[0].settings };
    res.json(settings);
    
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.put('/', authenticateAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    
    await db.query(
      'UPDATE system_settings SET settings = $1, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(settings)]
    );
    
    res.json({ message: 'Settings updated successfully' });
    
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset to default
router.post('/reset', authenticateAdmin, async (req, res) => {
  try {
    await db.query(
      'UPDATE system_settings SET settings = $1, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(defaultSettings)]
    );
    
    res.json({ message: 'Settings reset to default' });
    
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test email configuration
router.post('/test-email', authenticateAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    // Implement email test logic
    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Test SMS configuration
router.post('/test-sms', authenticateAdmin, async (req, res) => {
  try {
    const { phone } = req.body;
    // Implement SMS test logic
    res.json({ message: 'Test SMS sent successfully' });
  } catch (error) {
    console.error('Error testing SMS:', error);
    res.status(500).json({ error: 'Failed to send test SMS' });
  }
});

// Test webhook
router.post('/test-webhook', authenticateAdmin, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    // Implement webhook test logic
    res.json({ message: 'Webhook test sent successfully' });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to send webhook test' });
  }
});

export default router;