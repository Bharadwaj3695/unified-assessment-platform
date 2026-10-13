// Utility helpers for setting and clearing secure HttpOnly session cookies
const env = require('../config/env');

const crypto = require('crypto');

const COOKIE_NAME = 'uap_refresh';
const CSRF_COOKIE_NAME = 'uap_csrf';
const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

/**
 * Sets the HttpOnly refresh token cookie on the outgoing HTTP response.
 * @param {Object} res - Express response object
 * @param {string} token - Plaintext refresh token string
 */
function setRefreshCookie(res, token) {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAME_SITE || 'Lax';
  const cookieParts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api/auth',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${THIRTY_DAYS_SEC}`,
  ];
  if (isProduction || sameSite.toLowerCase() === 'none') {
    cookieParts.push('Secure');
  }
  appendSetCookieHeader(res, cookieParts.join('; '));
}

/**
 * Sets a companion non-HttpOnly CSRF token cookie readable by client-side JavaScript.
 * @param {Object} res - Express response object
 * @param {string} csrfToken - Cryptographic CSRF token string
 */
function setCsrfCookie(res, csrfToken) {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAME_SITE || 'Lax';
  const cookieParts = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}`,
    'Path=/',
    `SameSite=${sameSite}`,
    `Max-Age=${THIRTY_DAYS_SEC}`,
  ];
  if (isProduction || sameSite.toLowerCase() === 'none') {
    cookieParts.push('Secure');
  }
  appendSetCookieHeader(res, cookieParts.join('; '));
}

/**
 * Clears the refresh token cookie and CSRF cookie across supported paths.
 * @param {Object} res - Express response object
 */
function clearAuthCookies(res) {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAME_SITE || 'Lax';
  const clearRefreshApi = [
    `${COOKIE_NAME}=`,
    'Path=/api/auth',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  const clearRefreshRoot = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  const clearCsrf = [
    `${CSRF_COOKIE_NAME}=`,
    'Path=/',
    `SameSite=${sameSite}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isProduction || sameSite.toLowerCase() === 'none') {
    clearRefreshApi.push('Secure');
    clearRefreshRoot.push('Secure');
    clearCsrf.push('Secure');
  }
  appendSetCookieHeader(res, clearRefreshApi.join('; '));
  appendSetCookieHeader(res, clearRefreshRoot.join('; '));
  appendSetCookieHeader(res, clearCsrf.join('; '));
}

/**
 * Generates a cryptographically strong 32-byte hexadecimal CSRF token.
 * @returns {string} 64-character hex string
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates a CSRF token using constant-time buffer comparison.
 * @param {string} cookieToken 
 * @param {string} headerToken 
 * @returns {boolean}
 */
function validateCsrfToken(cookieToken, headerToken) {
  if (!cookieToken || !headerToken || typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
    return false;
  }
  const bufA = Buffer.from(cookieToken, 'utf8');
  const bufB = Buffer.from(headerToken, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Helper to safely append multiple Set-Cookie headers in Express.
 */
function appendSetCookieHeader(res, cookieString) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }
  const existing = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : null;
  if (!existing) {
    res.setHeader('Set-Cookie', cookieString);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieString]);
  } else {
    res.setHeader('Set-Cookie', [existing, cookieString]);
  }
}

/**
 * Lightweight parser for the HTTP Cookie header without external dependencies.
 * @param {string} cookieHeader - Raw Cookie header string
 * @returns {Object} Key-value map of parsed cookies
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

module.exports = {
  COOKIE_NAME,
  CSRF_COOKIE_NAME,
  setRefreshCookie,
  setCsrfCookie,
  clearAuthCookies,
  generateCsrfToken,
  validateCsrfToken,
  parseCookies,
};
