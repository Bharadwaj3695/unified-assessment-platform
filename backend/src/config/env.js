const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/unified_assessment',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_unified_assessment_platform',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ADMIN_REGISTRATION_KEY: process.env.ADMIN_REGISTRATION_KEY || 'ADMIN-UAP-2025',
};
