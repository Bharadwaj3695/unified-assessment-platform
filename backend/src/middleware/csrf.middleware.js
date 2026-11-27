// CSRF and Origin validation middleware for cookie-authenticated state-changing operations
const env = require('../config/env');
const { validateCsrfToken } = require('../utils/cookie');
const { errorResponse } = require('../utils/response');
const { isOriginAllowed, normalizeOrigin } = require('../utils/origin');

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
    originHeader = normalizeOrigin(req.headers.referer);
  }

  if (originHeader) {
    const isAllowed = isOriginAllowed(originHeader, env.NODE_ENV);
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
