// Cryptographic module managing AES-256-GCM encryption for session recovery tokens
const crypto = require('crypto');
const env = require('../config/env');

// Default fallback key (32 bytes hex) for development/test environments
const DEV_FALLBACK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Active key registry supporting zero-downtime key rotation
const KEY_REGISTRY = {};

/**
 * Validates and retrieves the 256-bit encryption key for a given version.
 * @param {string} version - Key version string (e.g. 'v1')
 * @returns {Buffer} 32-byte key buffer
 */
function getKey(version = 'v1') {
  if (KEY_REGISTRY[version]) {
    return KEY_REGISTRY[version];
  }

  // Retrieve raw key string from environment or dev fallback
  let rawKey = process.env.SESSION_ENCRYPTION_KEY || env.SESSION_ENCRYPTION_KEY;
  if (!rawKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY environment variable is required in production');
    }
    rawKey = DEV_FALLBACK_KEY;
  }

  // Support JSON dictionary of keys for rotation: e.g. {"v1": "hex...", "v2": "hex..."}
  if (rawKey.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawKey);
      for (const [v, hexKey] of Object.entries(parsed)) {
        const buf = Buffer.from(hexKey, 'hex');
        if (buf.length === 32) {
          KEY_REGISTRY[v] = buf;
        }
      }
      if (KEY_REGISTRY[version]) {
        return KEY_REGISTRY[version];
      }
    } catch {
      // Fall through to single hex key parsing
    }
  }

  const keyBuf = Buffer.from(rawKey, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error('FATAL: SESSION_ENCRYPTION_KEY must be a valid 64-character (32-byte) hex string');
  }

  KEY_REGISTRY['v1'] = keyBuf;
  return keyBuf;
}

/**
 * Encrypts a temporary replacement refresh token with AES-256-GCM and AAD binding.
 * @param {string} token - Plaintext refresh token string
 * @param {Object} context - AAD context object { familyId, userId, parentTokenHash }
 * @param {string} [version='v1'] - Key version to encrypt with
 * @returns {string} Serialized envelope: "<version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
function encryptRecoveryToken(token, { familyId, userId, parentTokenHash }, version = 'v1') {
  if (!token || typeof token !== 'string') {
    throw new Error('Token string is required for encryption');
  }
  if (!familyId || !userId || !parentTokenHash) {
    throw new Error('familyId, userId, and parentTokenHash are mandatory for cryptographic AAD binding');
  }

  const key = getKey(version);
  const iv = crypto.randomBytes(12); // Standard 96-bit GCM IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Bind cryptographic context to prevent ciphertext transplantation
  const aad = Buffer.from(`${familyId}:${userId}:${parentTokenHash}`, 'utf8');
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a serialized recovery envelope, verifying AAD and GCM authentication tag.
 * @param {string} envelope - Serialized envelope: "<version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * @param {Object} context - AAD context object { familyId, userId, parentTokenHash }
 * @returns {string} Decrypted plaintext token
 */
function decryptRecoveryToken(envelope, { familyId, userId, parentTokenHash }) {
  if (!envelope || typeof envelope !== 'string') {
    throw new Error('Recovery envelope is missing or invalid');
  }
  if (!familyId || !userId || !parentTokenHash) {
    throw new Error('familyId, userId, and parentTokenHash are mandatory for cryptographic AAD verification');
  }

  const parts = envelope.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed recovery envelope format');
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;
  const key = getKey(version);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Invalid IV or authentication tag length in recovery envelope');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const aad = Buffer.from(`${familyId}:${userId}:${parentTokenHash}`, 'utf8');
  decipher.setAAD(aad);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    const error = new Error('Cryptographic verification failed: ciphertext tampered or invalid context');
    error.statusCode = 401;
    throw error;
  }
}

/**
 * Helper to compute SHA-256 hash of a token string.
 * @param {string} token 
 * @returns {string} 64-character hex hash
 */
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validates session encryption key on server boot.
 */
function validateSessionEncryptionKey() {
  if (process.env.NODE_ENV === 'production') {
    const rawKey = process.env.SESSION_ENCRYPTION_KEY || env.SESSION_ENCRYPTION_KEY;
    if (!rawKey) {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY environment variable is required in production');
    }
    const keyBuf = Buffer.from(rawKey, 'hex');
    if (keyBuf.length !== 32) {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
    }
  }
}

module.exports = {
  getKey,
  encryptRecoveryToken,
  decryptRecoveryToken,
  hashToken,
  validateSessionEncryptionKey,
};
