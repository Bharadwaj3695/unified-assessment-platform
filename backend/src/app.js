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
const { apiRateLimiter, authRateLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

// Trust reverse proxy for accurate client IP detection in production
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Unified Assessment Platform API',
  });
});

// API Routes
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
