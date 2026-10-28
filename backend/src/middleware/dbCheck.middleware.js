// Middleware to verify database readiness before processing stateful API requests
const mongoose = require('mongoose');
const { errorResponse } = require('../utils/response');

/**
 * Ensures MongoDB is connected (readyState === 1) before allowing requests to proceed.
 * If disconnected, returns HTTP 503 Service Unavailable immediately, preventing
 * query buffering timeouts, unhandled ECONNREFUSED errors, and misleading authentication failures.
 */
const checkDbReady = (req, res, next) => {
  // readyState values: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return errorResponse(
      res,
      'Database service is currently unavailable. Please verify database connectivity.',
      503
    );
  }
  next();
};

module.exports = {
  checkDbReady,
};
