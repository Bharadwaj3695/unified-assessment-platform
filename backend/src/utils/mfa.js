const crypto = require('crypto');
const { generateSecret, generateURI, verifySync, generateSync } = require('otplib');
const QRCode = require('qrcode');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit recommended for GCM

/**
 * Derives a 32-byte key for AES-256-GCM from the configured MFA_ENCRYPTION_KEY.
 */
function getEncryptionKey() {
  const masterKey = env.MFA_ENCRYPTION_KEY || env.JWT_SECRET || 'uap_mfa_default_aes256_encryption_key_32bytes!!';
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Output format: ivHex:authTagHex:encryptedHex
 */
function encryptSecret(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted secret.
 */
function decryptSecret(encryptedPayload) {
  if (!encryptedPayload) return null;
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted MFA secret payload');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a standard Base32 TOTP secret.
 */
function generateTotpSecret() {
  return generateSecret();
}

/**
 * Generates an otpauth:// URI for authenticator applications.
 */
function generateTotpUri(userEmail, secret, issuer = 'Unified Assessment Platform') {
  return generateURI({
    issuer,
    label: userEmail,
    secret,
  });
}

/**
 * Generates a base64 QR Code Data URL from an otpauth:// URI.
 */
async function generateQrCode(otpauthUri) {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 4,
  });
}

/**
 * Verifies a 6-digit TOTP token against a secret with window tolerance [1, 1] (±30s).
 */
function verifyTotp(token, secret) {
  if (!token || !secret) return false;
  const cleanToken = String(token).trim();
  if (!/^\d{6}$/.test(cleanToken)) return false;
  try {
    const result = verifySync({
      token: cleanToken,
      secret,
      window: [1, 1], // 30s past, current, 30s future
    });
    return Boolean(result && result.valid);
  } catch {
    return false;
  }
}

/**
 * Generates a TOTP code synchronously (used for automated testing and simulation).
 */
function generateTotpCode(secret) {
  return generateSync({ secret });
}

/**
 * Normalizes and hashes a recovery code with HMAC-SHA256.
 */
function hashRecoveryCode(code) {
  if (!code) return '';
  const normalized = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const salt = env.JWT_SECRET || 'uap_recovery_salt';
  return crypto.createHmac('sha256', salt).update(normalized).digest('hex');
}

/**
 * Generates 8 cryptographically secure one-time recovery codes in XXXXX-XXXXX format.
 */
function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    codes.push(formatted);
  }
  return codes;
}

/**
 * Validates whether an input recovery code matches a stored hash safely.
 */
function verifyRecoveryCode(inputCode, storedHash) {
  if (!inputCode || !storedHash) return false;
  const inputHash = hashRecoveryCode(inputCode);
  const bufA = Buffer.from(inputHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  generateTotpUri,
  generateQrCode,
  verifyTotp,
  generateTotpCode,
  hashRecoveryCode,
  generateRecoveryCodes,
  verifyRecoveryCode,
};
