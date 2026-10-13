// CSRF and Origin validation middleware for cookie-authenticated state-changing operations
const env = require('../config/env');
const { validateCsrfToken } = require('../utils/cookie');
const { errorResponse } = require('../utils/response');

// Parse allowed client origins
const allowedOrigins = (env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

/**
 * Middleware enforcing exact Origin validation and CSRF token verification
 * on cookie-authenticated requests.
 */
function csrfProtection(req, res, next) {
  // Safe HTTP methods (GET, HEAD, OPTIONS) are exempt from CSRF checks
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Exact Origin / Referer validation if present
  let originHeader = req.headers.origin;
  if (!originHeader && req.headers.referer) {
    try {
      originHeader = new URL(req.headers.referer).origin;
    } catch {
      originHeader = null;
    }
  }

  if (originHeader) {
    const normalizedOrigin = originHeader.replace(/\/+$/, '');
    const isAllowed =
      allowedOrigins.includes(normalizedOrigin) ||
      (env.NODE_ENV !== 'production' && normalizedOrigin.includes('localhost'));
    if (!isAllowed) {
      return errorResponse(res, `CSRF origin validation failed: origin not permitted`, 403);
    }
  }

  // If request is authenticated via the HttpOnly refresh cookie, enforce CSRF token verification
  if (req.cookies && req.cookies.uap_refresh) {
    const csrfCookie = req.cookies.uap_csrf;
    const csrfHeader = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

    if (!csrfCookie || !csrfHeader || !validateCsrfToken(csrfCookie, csrfHeader)) {
      return errorResponse(res, 'Invalid or missing CSRF token', 403);
    }
  }

  // Request passed validation
  next();
}

module.exports = {
  csrfProtection,
};
