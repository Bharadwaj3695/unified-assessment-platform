const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Constant-time comparison to prevent timing side-channel attacks on API key verification.
 */
function timingSafeCompare(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const bufProvided = Buffer.from(provided);
  const bufExpected = Buffer.from(expected);
  if (bufProvided.length !== bufExpected.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Middleware ensuring incoming requests supply the authoritative internal API key.
 * This guarantees the execution service can only be invoked by internal trusted services (uap-backend).
 */
const requireInternalAuth = (req, res, next) => {
  const apiKey = req.headers['x-internal-api-key'];

  if (!apiKey || !timingSafeCompare(apiKey, env.INTERNAL_API_KEY)) {
    logger.warn('Unauthorized execution attempt blocked', {
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing internal execution API key.',
    });
  }

  next();
};

module.exports = {
  requireInternalAuth,
};
