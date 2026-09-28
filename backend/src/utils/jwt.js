const jwt = require('jsonwebtoken');
const env = require('../config/env');

const generateAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN || env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

const verifyAccessToken = (token) => {
  const unverified = jwt.decode(token);
  if (unverified && unverified.type === 'mfa_challenge') {
    const err = new Error('MFA challenge token cannot be used to access protected APIs');
    err.statusCode = 401;
    throw err;
  }
  if (unverified && unverified.type === 'refresh') {
    const err = new Error('Refresh token cannot be used to access protected APIs');
    err.statusCode = 401;
    throw err;
  }
  if (unverified && unverified.type && unverified.type !== 'access') {
    const err = new Error('Invalid authentication token type');
    err.statusCode = 401;
    throw err;
  }

  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (decoded.type && decoded.type !== 'access') {
    const err = new Error('Invalid authentication token type');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
};

const verifyRefreshToken = (token) => {
  const unverified = jwt.decode(token);
  if (unverified && unverified.type === 'mfa_challenge') {
    const err = new Error('MFA challenge token cannot be used to refresh access tokens');
    err.statusCode = 401;
    throw err;
  }
  if (unverified && unverified.type === 'access') {
    const err = new Error('Access token cannot be used as a refresh token');
    err.statusCode = 401;
    throw err;
  }
  if (unverified && unverified.type && unverified.type !== 'refresh') {
    const err = new Error('Invalid token type for refresh');
    err.statusCode = 401;
    throw err;
  }

  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (decoded.type && decoded.type !== 'refresh') {
    const err = new Error('Invalid token type for refresh');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
};

const generateMfaChallengeToken = ({ userId, challengeId }) => {
  return jwt.sign(
    {
      sub: String(userId),
      type: 'mfa_challenge',
      jti: challengeId,
    },
    env.MFA_CHALLENGE_SECRET,
    { expiresIn: env.MFA_CHALLENGE_EXPIRES_IN || '5m' }
  );
};

const verifyMfaChallengeToken = (token) => {
  const unverified = jwt.decode(token);
  if (unverified && unverified.type === 'access') {
    const err = new Error('Access token cannot be used as an MFA challenge token');
    err.statusCode = 401;
    throw err;
  }
  if (unverified && unverified.type === 'refresh') {
    const err = new Error('Refresh token cannot be used as an MFA challenge token');
    err.statusCode = 401;
    throw err;
  }
  if (unverified && unverified.type && unverified.type !== 'mfa_challenge') {
    const err = new Error('Invalid MFA challenge token type');
    err.statusCode = 401;
    throw err;
  }

  const decoded = jwt.verify(token, env.MFA_CHALLENGE_SECRET);
  if (decoded.type !== 'mfa_challenge') {
    const err = new Error('Invalid MFA challenge token type');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
};
