// Import standardized JSON error response utility for returning HTTP 429 rate limit responses
const { errorResponse } = require('../utils/response');

// Factory creating in-memory token-bucket style rate limiting middleware per client IP address
const createRateLimiter = ({
  // Default tracking window duration: 15 minutes (in milliseconds)
  windowMs = 15 * 60 * 1000,
  // Maximum requests permitted within the tracking window
  max = 100,
  // User-facing warning message returned when threshold is breached
  message = 'Too many requests from this IP, please try again later.',
} = {}) => {
  // In-memory key-value map tracking request counts and reset timestamps keyed by client IP
  const hits = new Map();

  // Periodic cleanup interval running every 5 minutes to purge expired IP buckets and prevent memory leaks
  const cleanupInterval = setInterval(() => {
    // Current UNIX epoch timestamp in milliseconds
    const now = Date.now();
    // Iterate over all active IP rate limit tracking records
    for (const [key, record] of hits.entries()) {
      // Check if the record window reset timestamp has elapsed
      if (now > record.resetTime) {
        // Delete expired IP record from memory
        hits.delete(key);
      }
    }
  // Schedule cleanup every 5 minutes (300,000 milliseconds)
  }, 5 * 60 * 1000);

  // Unreference timer from Node event loop so it does not prevent application shutdown
  if (cleanupInterval.unref) {
    // Unref timer
    cleanupInterval.unref();
  }

  // Return Express middleware function to evaluate each incoming HTTP request
  return (req, res, next) => {
    // Identify client IP address using Express req.ip, socket remote address, or fallback
    const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
    // Bypass rate limiting in test runs, explicit disable flags, bypass headers, or local loopback in dev
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DISABLE_RATE_LIMIT === 'true' ||
      req.headers['x-test-bypass'] === 'true' ||
      (process.env.NODE_ENV !== 'production' &&
        (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'))
    ) {
      // Skip rate limit accounting and proceed immediately to next handler
      return next();
    }
    // Record current timestamp in milliseconds
    const now = Date.now();

    // Retrieve existing tracking record for client IP
    let record = hits.get(ip);
    // If no record exists or previous window has expired, initialize a fresh tracking window
    if (!record || now > record.resetTime) {
      // Create new record with count 1 and reset timestamp set to now + window duration
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      // Store new record in hits map
      hits.set(ip, record);
    // Increment hit counter within active window
    } else {
      // Increment request count by 1
      record.count += 1;
    }

    // Calculate remaining request quota within the active window, bounding at 0
    const remaining = Math.max(0, max - record.count);
    // Set standard rate limit headers reporting maximum permitted requests
    res.setHeader('X-RateLimit-Limit', max);
    // Set standard rate limit headers reporting remaining requests allowed
    res.setHeader('X-RateLimit-Remaining', remaining);
    // Set standard rate limit headers reporting window reset epoch in seconds
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    // Check if the client IP has exceeded the maximum permitted request threshold
    if (record.count > max) {
      // Set Retry-After header specifying seconds until rate limit resets
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      // Return HTTP 429 Too Many Requests response blocking further request processing
      return errorResponse(res, message, 429);
    }

    // Request is within permitted thresholds; pass control to next handler
    next();
  };
};

// Specialized rate limiter for authentication routes (login, register, MFA) allowing up to 60 requests per 15 minutes
const authRateLimiter = createRateLimiter({
  // 15-minute sliding window
  windowMs: 15 * 60 * 1000,
  // Limit to 60 requests per 15 minutes to deter credential stuffing and brute-force guessing
  max: 60,
  // Throttling warning message
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

// General rate limiter for general API routes allowing up to 1000 requests per 15 minutes
const apiRateLimiter = createRateLimiter({
  // 15-minute sliding window
  windowMs: 15 * 60 * 1000,
  // High threshold accommodating standard application browsing and auto-saving
  max: 1000,
  // Throttling warning message
  message: 'API request threshold exceeded. Please throttle your requests.',
});

// Export rate limiting factories and configured middleware instances
module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
};
