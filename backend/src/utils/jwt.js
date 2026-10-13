// Import jsonwebtoken library for creating, signing, decoding, and verifying JSON Web Tokens
const jwt = require('jsonwebtoken');
// Import crypto module for unique token identifiers
const crypto = require('crypto');
// Import platform environment variables for cryptographic secrets and expiration window configurations
const env = require('../config/env');

// Generates a short-lived access JWT carrying authenticated user claims and an explicit 'access' type indicator
const generateAccessToken = (payload) => {
  // Sign the JWT incorporating payload claims, explicit token type, secret key, and configurable expiration
  return jwt.sign(
    // Embed user attributes and tag token type as 'access' to prevent token substitution attacks
    { ...payload, type: 'access' },
    // Use the primary JWT secret key for signature creation
    env.JWT_SECRET,
    // Set token expiration from environment variables, defaulting to 15 minutes
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN || env.JWT_EXPIRES_IN || '15m' }
  );
};

// Generates a persistent refresh JWT signed with a distinct secret, enabling seamless session renewal
const generateRefreshToken = (payload) => {
  // Sign the refresh token with designated refresh secret and longer expiration window
  return jwt.sign(
    // Embed payload attributes, unique jti nonce, and tag token type explicitly as 'refresh'
    { ...payload, type: 'refresh', jti: payload.jti || crypto.randomUUID() },
    // Sign using isolated refresh secret to ensure compromise of access secret does not compromise refresh
    env.JWT_REFRESH_SECRET,
    // Set refresh token expiration window, defaulting to 30 days
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

// Validates and decodes an access token, enforcing strict type separation to prevent challenge or refresh token abuse
const verifyAccessToken = (token) => {
  // Decode token without cryptographic signature verification first to inspect payload claims
  const unverified = jwt.decode(token);
  // Block any attempt to use a temporary MFA challenge token to access protected application endpoints
  if (unverified && unverified.type === 'mfa_challenge') {
    // Construct descriptive authorization error
    const err = new Error('MFA challenge token cannot be used to access protected APIs');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject unauthorized request
    throw err;
  }
  // Prevent long-lived refresh tokens from being passed directly as bearer access tokens
  if (unverified && unverified.type === 'refresh') {
    // Construct descriptive authorization error
    const err = new Error('Refresh token cannot be used to access protected APIs');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject unauthorized request
    throw err;
  }
  // Validate that if a type claim is present, it must strictly match 'access'
  if (unverified && unverified.type && unverified.type !== 'access') {
    // Construct descriptive invalid token type error
    const err = new Error('Invalid authentication token type');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject unauthorized request
    throw err;
  }

  // Cryptographically verify signature and token expiration using the access secret key
  const decoded = jwt.verify(token, env.JWT_SECRET);
  // Double-check verified payload type to guarantee token integrity
  if (decoded.type && decoded.type !== 'access') {
    // Construct descriptive invalid token type error
    const err = new Error('Invalid authentication token type');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject unauthorized request
    throw err;
  }
  // Return verified and decoded token claims payload to caller
  return decoded;
};

// Validates and decodes a refresh token using the dedicated refresh secret key
const verifyRefreshToken = (token) => {
  // Decode token header and payload to inspect claims prior to signature verification
  const unverified = jwt.decode(token);
  // Reject MFA challenge tokens submitted to token renewal endpoints
  if (unverified && unverified.type === 'mfa_challenge') {
    // Construct descriptive authorization error
    const err = new Error('MFA challenge token cannot be used to refresh access tokens');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject invalid token usage
    throw err;
  }
  // Reject access tokens mistakenly submitted to the refresh endpoint
  if (unverified && unverified.type === 'access') {
    // Construct descriptive authorization error
    const err = new Error('Access token cannot be used as a refresh token');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject invalid token usage
    throw err;
  }
  // Enforce that refresh tokens must have their type explicitly set to 'refresh'
  if (unverified && unverified.type && unverified.type !== 'refresh') {
    // Construct descriptive invalid token type error
    const err = new Error('Invalid token type for refresh');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject invalid token usage
    throw err;
  }

  // Cryptographically verify signature and expiration using the isolated refresh secret
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  // Verify that the decoded token type matches 'refresh' after signature confirmation
  if (decoded.type && decoded.type !== 'refresh') {
    // Construct descriptive invalid token type error
    const err = new Error('Invalid token type for refresh');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to reject invalid token usage
    throw err;
  }
  // Return verified payload containing subject user ID and token claims
  return decoded;
};

// Generates an ephemeral challenge token during two-factor login, valid only for completing MFA verification
const generateMfaChallengeToken = ({ userId, challengeId }) => {
  // Sign the challenge token with a separate MFA challenge secret and short expiration window
  return jwt.sign(
    // Embed user subject ID, explicit 'mfa_challenge' type, and unique challenge identifier JTI
    {
      // Subject user ID representing the user currently attempting login
      sub: String(userId),
      // Explicit token type indicator
      type: 'mfa_challenge',
      // JTI claim linking directly to the stored MfaChallenge MongoDB record
      jti: challengeId,
    },
    // Cryptographic secret specific to MFA challenges
    env.MFA_CHALLENGE_SECRET,
    // Short expiration duration (typically 5 minutes)
    { expiresIn: env.MFA_CHALLENGE_EXPIRES_IN || '5m' }
  );
};

// Validates an MFA challenge token submitted with a TOTP or recovery code
const verifyMfaChallengeToken = (token) => {
  // Decode token claims prior to verification to check token purpose
  const unverified = jwt.decode(token);
  // Ensure access tokens cannot bypass the two-factor authentication gate
  if (unverified && unverified.type === 'access') {
    // Construct descriptive authorization error
    const err = new Error('Access token cannot be used as an MFA challenge token');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to prevent misuse
    throw err;
  }
  // Ensure refresh tokens cannot be used to fulfill an MFA challenge
  if (unverified && unverified.type === 'refresh') {
    // Construct descriptive authorization error
    const err = new Error('Refresh token cannot be used as an MFA challenge token');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to prevent misuse
    throw err;
  }
  // Enforce that only tokens with type 'mfa_challenge' are processed
  if (unverified && unverified.type && unverified.type !== 'mfa_challenge') {
    // Construct descriptive invalid token type error
    const err = new Error('Invalid MFA challenge token type');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to prevent misuse
    throw err;
  }

  // Cryptographically verify signature and validity against the MFA challenge secret
  const decoded = jwt.verify(token, env.MFA_CHALLENGE_SECRET);
  // Confirm that verified token type is strictly 'mfa_challenge'
  if (decoded.type !== 'mfa_challenge') {
    // Construct descriptive invalid token type error
    const err = new Error('Invalid MFA challenge token type');
    // Set HTTP 401 Unauthorized status code
    err.statusCode = 401;
    // Throw error to prevent misuse
    throw err;
  }
  // Return decoded challenge payload including subject ID and challenge JTI
  return decoded;
};

// Export JWT token generation and verification utility functions
module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
};
