// Cryptographic module managing AES-256-GCM encryption for session recovery tokens
const crypto = require('crypto');
const env = require('../config/env');

// Default fallback key (32 bytes hex) for development/test environments
const DEV_FALLBACK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Cached key configuration to avoid parsing on every operation while remaining dynamic
let cachedRawKey = null;
let cachedActiveVersionEnv = null;
let cachedRegistry = null;
let cachedActiveVersion = null;

/**
 * Validates that a key string is exactly 64 hexadecimal characters (32 bytes).
 * @param {string} keyHex - Key string to validate
 * @param {string} [identifier='Key'] - Label for error messages
 * @returns {Buffer} 32-byte key buffer
 */
function validateHexKey(keyHex, identifier = 'Key') {
  if (typeof keyHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(keyHex.trim())) {
    throw new Error(`FATAL: ${identifier} must be a valid 64-character (32-byte) hexadecimal string`);
  }
  return Buffer.from(keyHex.trim(), 'hex');
}

/**
 * Parses and validates encryption key configuration from raw input and active version.
 * @param {string} rawKey - Raw hex key or JSON dictionary string
 * @param {string} [activeVersionEnv] - Explicit active version override
 * @returns {{ registry: Object.<string, Buffer>, activeVersion: string }}
 */
function parseKeyConfig(rawKey, activeVersionEnv) {
  let effectiveRawKey = rawKey;
  if (!effectiveRawKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY environment variable is required in production');
    }
    effectiveRawKey = DEV_FALLBACK_KEY;
  }

  const trimmed = effectiveRawKey.trim();
  const registry = {};

  if (trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('FATAL: Malformed JSON in SESSION_ENCRYPTION_KEY');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY JSON must be an object of key versions');
    }

    const versionKeys = Object.keys(parsed);
    if (versionKeys.length === 0) {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY JSON dictionary must contain at least one key');
    }

    for (const [ver, hexVal] of Object.entries(parsed)) {
      const cleanVer = typeof ver === 'string' ? ver.trim() : '';
      if (!cleanVer) {
        throw new Error('FATAL: Key version identifier must be a non-empty string');
      }
      registry[cleanVer] = validateHexKey(hexVal, `Key for version "${cleanVer}"`);
    }

    let activeVersion;
    if (activeVersionEnv && typeof activeVersionEnv === 'string' && activeVersionEnv.trim()) {
      activeVersion = activeVersionEnv.trim();
      if (!registry[activeVersion]) {
        throw new Error(
          `FATAL: Configured active key version "${activeVersion}" does not exist in SESSION_ENCRYPTION_KEY registry`
        );
      }
    } else {
      if (versionKeys.length === 1 && versionKeys[0] === 'v1') {
        activeVersion = 'v1';
      } else {
        throw new Error(
          'FATAL: SESSION_ENCRYPTION_ACTIVE_VERSION must be explicitly specified when multiple encryption keys are configured'
        );
      }
    }

    return { registry, activeVersion };
  }

  // Single raw 64-character hexadecimal key configuration
  const singleBuf = validateHexKey(trimmed, 'SESSION_ENCRYPTION_KEY');
  registry['v1'] = singleBuf;

  let activeVersion = 'v1';
  if (activeVersionEnv && typeof activeVersionEnv === 'string' && activeVersionEnv.trim()) {
    const requested = activeVersionEnv.trim();
    if (requested !== 'v1') {
      throw new Error(
        `FATAL: Configured active key version "${requested}" does not exist in single-key registry`
      );
    }
    activeVersion = requested;
  }

  return { registry, activeVersion };
}

/**
 * Retrieves the current registry and active key version, reloading on environment changes.
 * @returns {{ registry: Object.<string, Buffer>, activeVersion: string }}
 */
function getKeyConfig() {
  const rawKey = process.env.SESSION_ENCRYPTION_KEY || env.SESSION_ENCRYPTION_KEY;
  const activeVersionEnv =
    process.env.SESSION_ENCRYPTION_ACTIVE_VERSION || env.SESSION_ENCRYPTION_ACTIVE_VERSION;

  if (
    cachedRegistry &&
    rawKey === cachedRawKey &&
    activeVersionEnv === cachedActiveVersionEnv
  ) {
    return { registry: cachedRegistry, activeVersion: cachedActiveVersion };
  }

  const { registry, activeVersion } = parseKeyConfig(rawKey, activeVersionEnv);
  cachedRawKey = rawKey;
  cachedActiveVersionEnv = activeVersionEnv;
  cachedRegistry = registry;
  cachedActiveVersion = activeVersion;
  return { registry: cachedRegistry, activeVersion: cachedActiveVersion };
}

/**
 * Resets the in-memory key cache for isolation during automated tests.
 */
function resetKeyRegistry() {
  cachedRawKey = null;
  cachedActiveVersionEnv = null;
  cachedRegistry = null;
  cachedActiveVersion = null;
}

/**
 * Retrieves the configured active key version.
 * @returns {string}
 */
function getActiveKeyVersion() {
  return getKeyConfig().activeVersion;
}

/**
 * Validates and retrieves the 256-bit encryption key for a given version.
 * Defaults to the active key version if unspecified.
 * @param {string} [version] - Key version string (e.g. 'v1', 'v2')
 * @returns {Buffer} 32-byte key buffer
 */
function getKey(version = null) {
  const { registry, activeVersion } = getKeyConfig();
  const targetVersion = version || activeVersion;
  if (!registry[targetVersion]) {
    throw new Error(`Cryptographic key for version "${targetVersion}" not found in registry`);
  }
  return registry[targetVersion];
}

/**
 * Encrypts a temporary replacement refresh token with AES-256-GCM and AAD binding.
 * Uses the configured active key version unless explicitly overridden.
 * @param {string} token - Plaintext refresh token string
 * @param {Object} context - AAD context object { familyId, userId, parentTokenHash }
 * @param {string} [version] - Key version to encrypt with (defaults to active key version)
 * @returns {string} Serialized envelope: "<version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
function encryptRecoveryToken(token, { familyId, userId, parentTokenHash }, version = null) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token string is required for encryption');
  }
  if (!familyId || !userId || !parentTokenHash) {
    throw new Error('familyId, userId, and parentTokenHash are mandatory for cryptographic AAD binding');
  }

  const activeVer = version || getActiveKeyVersion();
  const key = getKey(activeVer);
  const iv = crypto.randomBytes(12); // Standard 96-bit GCM IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Bind cryptographic context to prevent ciphertext transplantation
  const aad = Buffer.from(`${familyId}:${userId}:${parentTokenHash}`, 'utf8');
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${activeVer}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a serialized recovery envelope, verifying AAD and GCM authentication tag.
 * Looks up the key corresponding to the envelope's version prefix for backward compatibility.
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
 * Validates session encryption key configuration on server boot.
 * Enforces production environment requirements and validates all configured keys.
 */
function validateSessionEncryptionKey() {
  if (process.env.NODE_ENV === 'production') {
    const rawKey = process.env.SESSION_ENCRYPTION_KEY || env.SESSION_ENCRYPTION_KEY;
    if (!rawKey) {
      throw new Error('FATAL: SESSION_ENCRYPTION_KEY environment variable is required in production');
    }
  }
  // Validate configuration structure and active version
  getKeyConfig();
}

module.exports = {
  getKey,
  getActiveKeyVersion,
  encryptRecoveryToken,
  decryptRecoveryToken,
  hashToken,
  validateSessionEncryptionKey,
  resetKeyRegistry,
};
