const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./routes/execution.routes');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: false })); // Deny direct browser CORS; accessible only via internal service network

// Body parsing with strict size ceiling
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/health' && req.path !== '/health/live') {
    logger.info(`Incoming ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
  next();
});

// Mount routes
app.use('/', routes);

// Central error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled execution service error', { error: err.message, stack: err.stack });
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Execution Service Error',
  });
});

module.exports = app;
