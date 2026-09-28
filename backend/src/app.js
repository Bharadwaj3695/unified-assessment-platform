const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { errorHandler } = require('./middleware/error.middleware');

// Routes
const authRoutes = require('./routes/auth.routes');
const assessmentRoutes = require('./routes/assessment.routes');
const submissionRoutes = require('./routes/submission.routes');
const evaluationRoutes = require('./routes/evaluation.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const proctoringRoutes = require('./routes/proctoring.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const questionBankRoutes = require('./routes/questionBank.routes');
const questionImportRoutes = require('./routes/questionImport.routes');
const { apiRateLimiter, authRateLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

// Trust reverse proxy for accurate client IP detection in production
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production' && normalizedOrigin.includes('localhost')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global API rate limiting
app.use('/api', apiRateLimiter);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static folder for file uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Root landing
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Unified Assessment Platform Backend API is running.',
    frontendUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    healthCheck: '/api/health',
    endpoints: {
      auth: '/api/auth',
      assessments: '/api/assessments',
      submissions: '/api/submissions',
      evaluations: '/api/evaluations',
      users: '/api/users',
      admin: '/api/admin',
      analytics: '/api/analytics',
      questionBank: '/api/question-bank',
      questionImport: '/api/question-import',
      notifications: '/api/notifications',
      proctoring: '/api/proctoring',
    },
  });
});

// Health Check (supports both /api/health and /health for deployment health checks)
const handleHealthCheck = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Unified Assessment Platform API',
  });
};
app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

// API Routes
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/question-import', questionImportRoutes);

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
