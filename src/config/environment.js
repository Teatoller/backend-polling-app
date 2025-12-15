// src/config/environment.js
export const environment = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000'),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'polling_app',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  email: {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const validateTwilioConfig = () => {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'TWILIO_PHONE_NUMBER'
  ];
  
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Missing Twilio configuration: ${missing.join(', ')}`);
    console.warn('SMS services will use mock implementation');
    return false;
  }
  
  return true;
};

export const validateEmailConfig = () => {
  const required = [
    'EMAIL_SERVICE',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];
  
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Missing Email configuration: ${missing.join(', ')}`);
    console.warn('Email services will use mock implementation');
    return false;
  }
  
  return true;
};

export const getConfig = () => environment;