const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/unified_assessment',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  JWT_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_unified_assessment_platform',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  MFA_CHALLENGE_SECRET: process.env.MFA_CHALLENGE_SECRET || 'dev_mfa_challenge_secret_unified_assessment_platform',
  MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY || 'uap_mfa_default_aes256_encryption_key_32bytes!!',
  MFA_CHALLENGE_EXPIRES_IN: process.env.MFA_CHALLENGE_EXPIRES_IN || '5m',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ADMIN_REGISTRATION_KEY: process.env.ADMIN_REGISTRATION_KEY || 'ADMIN-UAP-2025',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5173/auth/google/callback',
  GOOGLE_ALLOWED_DOMAINS: process.env.GOOGLE_ALLOWED_DOMAINS || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.EMAIL_FROM || '"Unified Assessment Platform" <no-reply@uap.edu>',
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_FROM || '"Unified Assessment Platform" <no-reply@uap.edu>',
};
