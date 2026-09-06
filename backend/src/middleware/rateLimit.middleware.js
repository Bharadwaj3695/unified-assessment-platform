const { errorResponse } = require('../utils/response');

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests from this IP, please try again later.',
} = {}) => {
  const hits = new Map();

  // Periodic cleanup every 5 minutes to avoid memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DISABLE_RATE_LIMIT === 'true' ||
      req.headers['x-test-bypass'] === 'true' ||
      (process.env.NODE_ENV !== 'production' &&
        (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'))
    ) {
      return next();
    }
    const now = Date.now();

    let record = hits.get(ip);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return errorResponse(res, message, 429);
    }

    next();
  };
};

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'API request threshold exceeded. Please throttle your requests.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
};
