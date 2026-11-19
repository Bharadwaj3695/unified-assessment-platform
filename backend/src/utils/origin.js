// Centralized Origin Normalization and Validation Helper
const env = require('../config/env');

/**
 * Normalizes an origin or referer URL string to an exact origin (scheme + host + port).
 * Returns null if the URL string is invalid or malformed.
 * @param {string} originStr 
 * @returns {string|null}
 */
function normalizeOrigin(originStr) {
  if (!originStr || typeof originStr !== 'string') return null;
  try {
    const parsed = new URL(originStr.trim());
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Parses and returns the list of explicitly configured allowed origins.
 * Sourced from CLIENT_URL, CLOUDFLARE_TUNNEL_URL, and ALLOWED_ORIGINS.
 * Supports comma-separated entries in any of these variables.
 * @returns {string[]}
 */
function getConfiguredAllowedOrigins() {
  const origins = [];

  const rawSources = [
    env.CLIENT_URL,
    process.env.CLIENT_URL,
    env.CLOUDFLARE_TUNNEL_URL,
    process.env.CLOUDFLARE_TUNNEL_URL,
    process.env.CLOUDFLARE_URL,
    env.ALLOWED_ORIGINS,
    process.env.ALLOWED_ORIGINS,
  ];

  for (const source of rawSources) {
    if (!source || typeof source !== 'string') continue;
    const parts = source.split(',');
    for (const part of parts) {
      const normalized = normalizeOrigin(part);
      if (normalized && !origins.includes(normalized)) {
        origins.push(normalized);
      }
    }
  }

  // Fallback to standard default client URL if none configured
  if (origins.length === 0) {
    origins.push('http://localhost:5173');
  }

  return origins;
}

/**
 * Checks if an origin is a valid localhost development origin (localhost or 127.0.0.1).
 * Never permits localhost exceptions in production mode.
 * Uses exact URL hostname comparison instead of substring matching.
 * @param {string} normalizedOrigin 
 * @param {string} nodeEnv 
 * @returns {boolean}
 */
function isDevLocalhostOrigin(normalizedOrigin, nodeEnv) {
  if (nodeEnv === 'production') {
    return false;
  }
  if (!normalizedOrigin || typeof normalizedOrigin !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(normalizedOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Authoritative origin validation function used consistently by both CORS and CSRF middleware.
 * Rejects unapproved, malformed, or wildcard origins.
 * @param {string} origin 
 * @param {string} [nodeEnv] 
 * @returns {boolean}
 */
function isOriginAllowed(origin, nodeEnv = env.NODE_ENV || process.env.NODE_ENV || 'development') {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const allowedOrigins = getConfiguredAllowedOrigins();
  if (allowedOrigins.includes(normalized)) {
    return true;
  }

  if (isDevLocalhostOrigin(normalized, nodeEnv)) {
    return true;
  }

  return false;
}

module.exports = {
  normalizeOrigin,
  getConfiguredAllowedOrigins,
  isDevLocalhostOrigin,
  isOriginAllowed,
};
