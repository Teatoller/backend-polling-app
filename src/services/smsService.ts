// backend/services/smsService.ts
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Common interface for SMS services
interface SMSService {
  sendVerificationSMS(phone: string, code: string): Promise<void>;
  sendLoginNotificationSMS(phone: string): Promise<void>;
}

// Real Twilio SMS service
class TwilioSMSService implements SMSService {
  private client: twilio.Twilio;

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendVerificationSMS(phone: string, code: string): Promise<void> {
    try {
      if (!process.env.TWILIO_PHONE_NUMBER) {
        throw new Error('Twilio phone number not configured');
      }

      const message = await this.client.messages.create({
        body: `Your polling app verification code is: ${code}. This code expires in 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      console.log(`SMS sent to ${phone}, SID: ${message.sid}`);
    } catch (error) {
      console.error('Error sending SMS:', error);
      
      // Provide more specific error messages based on Twilio error codes
      if (error instanceof Error) {
        if ('code' in error && error.code === 21211) {
          throw new Error('Invalid phone number format');
        } else if ('code' in error && error.code === 21408) {
          throw new Error('Twilio account not authorized to send to this region');
        } else if ('code' in error && error.code === 21610) {
          throw new Error('Phone number is blacklisted');
        } else if ('code' in error && error.code === 20003) {
          throw new Error('Twilio authentication failed - check your credentials');
        }
      }
      
      throw new Error('Failed to send verification SMS');
    }
  }

  async sendLoginNotificationSMS(phone: string): Promise<void> {
    try {
      if (!process.env.TWILIO_PHONE_NUMBER) {
        console.warn('Twilio phone number not configured - skipping login notification');
        return;
      }

      const message = await this.client.messages.create({
        body: 'Successful login detected on your polling app account. If this was not you, please contact support immediately.',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      console.log(`Login notification SMS sent to ${phone}, SID: ${message.sid}`);
    } catch (error) {
      console.error('Error sending login notification SMS:', error);
      // Don't throw error for login notifications as they're non-critical
    }
  }
}

// Mock SMS service for development
class MockSMSService implements SMSService {
  async sendVerificationSMS(phone: string, code: string): Promise<void> {
    console.log(`📱 [MOCK SMS] Verification code for ${phone}: ${code}`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async sendLoginNotificationSMS(phone: string): Promise<void> {
    console.log(`📱 [MOCK SMS] Login notification sent to ${phone}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export const generateSMSCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Factory function to get the appropriate SMS service
export const getSMSService = (): SMSService => {
  const hasTwilioConfig = process.env.TWILIO_ACCOUNT_SID && 
                          process.env.TWILIO_AUTH_TOKEN && 
                          process.env.TWILIO_PHONE_NUMBER;
  
  if (hasTwilioConfig) {
    try {
      console.log('📱 Using Twilio SMS service');
      return new TwilioSMSService();
    } catch (error) {
      console.warn('Failed to initialize Twilio, falling back to mock service:', error);
      return new MockSMSService();
    }
  } else {
    console.log('📱 Using mock SMS service - Twilio credentials not configured');
    return new MockSMSService();
  }
};

// Direct function exports for backward compatibility
export const sendVerificationSMS = async (phone: string, code: string): Promise<void> => {
  const smsService = getSMSService();
  await smsService.sendVerificationSMS(phone, code);
};

export const sendLoginNotificationSMS = async (phone: string): Promise<void> => {
  const smsService = getSMSService();
  await smsService.sendLoginNotificationSMS(phone);
};