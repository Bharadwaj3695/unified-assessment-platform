// Node.js native crypto module for cryptographic hashing, key derivation, and authenticated encryption
const crypto = require('crypto');
// Otplib library providing TOTP generation, verification, and otpauth URI standard formatting
const { generateSecret, generateURI, verifySync, generateSync } = require('otplib');
// QRCode library to generate Data URL images of otpauth URIs for scanning into authenticator apps
const QRCode = require('qrcode');
// Platform environment variables containing master MFA encryption key and fallback salt
const env = require('../config/env');

// Authenticated symmetric encryption algorithm providing confidentiality and integrity
const ALGORITHM = 'aes-256-gcm';
// 12-byte (96-bit) initialization vector length recommended by NIST for GCM mode
const IV_LENGTH = 12; // 96-bit recommended for GCM

/**
 * Derives a 32-byte key for AES-256-GCM from the configured MFA_ENCRYPTION_KEY.
 * Cryptographic hash (SHA-256) guarantees exact 256-bit key length required for AES-256.
 */
function getEncryptionKey() {
  // Retrieve the configured master encryption key, falling back to secret defaults in local dev
  const masterKey = env.MFA_ENCRYPTION_KEY || env.JWT_SECRET || 'uap_mfa_default_aes256_encryption_key_32bytes!!';
  // Compute SHA-256 hash digest of the master key string to produce a fixed 32-byte binary key
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Encrypts a plaintext TOTP secret using AES-256-GCM before persisting to the database.
 * Output format: ivHex:authTagHex:encryptedHex
 * NOTE: The TOTP secret is persistent and sensitive; the 6-digit code is ephemeral and calculated on-the-fly.
 */
function encryptSecret(plaintext) {
  // Return null immediately if plaintext secret is not provided
  if (!plaintext) return null;
  // Generate a cryptographically random 12-byte initialization vector unique to this ciphertext
  const iv = crypto.randomBytes(IV_LENGTH);
  // Create cipher instance with AES-256-GCM algorithm, derived 32-byte key, and unique IV
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  // Encrypt the UTF-8 plaintext string into hexadecimal ciphertext representation
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  // Finalize encryption process and append trailing ciphertext hex
  encrypted += cipher.final('hex');
  // Retrieve the 16-byte authentication tag ensuring ciphertext has not been tampered with
  const authTag = cipher.getAuthTag();
  // Assemble compound storage format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted secret payload stored in the database.
 * Verifies authenticity tag to prevent tampering or ciphertext substitution attacks.
 */
function decryptSecret(encryptedPayload) {
  // Return null if encrypted payload string is empty or absent
  if (!encryptedPayload) return null;
  // Split the compound payload into IV, authentication tag, and ciphertext components
  const parts = encryptedPayload.split(':');
  // Validate that all three expected colon-delimited components are present
  if (parts.length !== 3) {
    // Throw error if the encrypted payload structure is malformed
    throw new Error('Malformed encrypted MFA secret payload');
  }
  // Destructure hex representations of IV, authentication tag, and encrypted secret
  const [ivHex, authTagHex, encryptedHex] = parts;
  // Reconstruct IV binary buffer from hex string
  const iv = Buffer.from(ivHex, 'hex');
  // Reconstruct authentication tag binary buffer from hex string
  const authTag = Buffer.from(authTagHex, 'hex');
  // Initialize decipher with AES-256-GCM algorithm, derived key, and reconstructed IV
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  // Supply the expected authentication tag to the decipher for cryptographic verification
  decipher.setAuthTag(authTag);
  // Decrypt hex ciphertext back to UTF-8 plaintext representation
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  // Finalize decryption and verify authentication tag integrity
  decrypted += decipher.final('utf8');
  // Return recovered plaintext Base32 TOTP secret string
  return decrypted;
}

/**
 * Generates a standard cryptographically random Base32 TOTP secret key.
 * This persistent secret is shared only between the platform server and the student/faculty authenticator app.
 */
function generateTotpSecret() {
  // Generate random Base32 string using otplib default entropy
  return generateSecret();
}

/**
 * Generates a standard otpauth:// URI compliant with Google Authenticator and RFC 6238.
 * Format: otpauth://totp/Issuer:user@domain?secret=...&issuer=Issuer
 */
function generateTotpUri(userEmail, secret, issuer = 'Unified Assessment Platform') {
  // Construct standard URI incorporating platform issuer, user email, and Base32 secret
  return generateURI({
    issuer,
    label: userEmail,
    secret,
  });
}

/**
 * Generates a base64 QR Code Data URL image from an otpauth:// URI for interactive browser scanning.
 */
async function generateQrCode(otpauthUri) {
  // Render QR code to base64 PNG data URL with medium error correction and 4x scaling
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 4,
  });
}

/**
 * Verifies a dynamically generated 6-digit TOTP token against the user's decrypted TOTP secret.
 * Tolerance window [1, 1] permits codes from 30s past, current time step, and 30s future to absorb clock drift.
 * NOTE: The 6-digit code is never stored in the database; only the shared secret is stored (encrypted).
 */
function verifyTotp(token, secret) {
  // Return false if either token code or shared secret is missing
  if (!token || !secret) return false;
  // Trim any extraneous whitespace from candidate token string
  const cleanToken = String(token).trim();
  // Ensure token consists of exactly 6 numeric digits
  if (!/^\d{6}$/.test(cleanToken)) return false;
  // Begin verification try block to catch potential library parsing exceptions
  try {
    // Check code validity against secret within ±1 time-step window (±30 seconds)
    const result = verifySync({
      token: cleanToken,
      secret,
      window: [1, 1], // 30s past, current, 30s future
    });
    // Return boolean indicating whether verification succeeded
    return Boolean(result && result.valid);
  // Return false if token verification encounters an unexpected error
  } catch {
    return false;
  }
}

/**
 * Synchronously computes current 6-digit TOTP code for a secret (used during automated integration tests).
 */
function generateTotpCode(secret) {
  // Generate current valid time-based 6-digit code from secret
  return generateSync({ secret });
}

/**
 * Normalizes and hashes a one-time recovery code using HMAC-SHA256.
 * Recovery codes are stripped of dashes/spaces and hashed before database persistence.
 */
function hashRecoveryCode(code) {
  // Return empty string if input code is absent
  if (!code) return '';
  // Normalize code by stripping dashes and whitespace, converting to uppercase
  const normalized = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // Retrieve salt for HMAC hash derivation
  const salt = env.JWT_SECRET || 'uap_recovery_salt';
  // Compute HMAC-SHA256 hex digest of normalized recovery code
  return crypto.createHmac('sha256', salt).update(normalized).digest('hex');
}

/**
 * Generates an array of cryptographically secure one-time backup recovery codes.
 * Formatted as 10 alphanumeric characters separated by a hyphen (e.g. A1B2C-D3E4F).
 */
function generateRecoveryCodes(count = 8) {
  // Initialize accumulator array for generated recovery codes
  const codes = [];
  // Loop count times to generate requested number of recovery codes
  for (let i = 0; i < count; i++) {
    // Generate 5 random bytes and encode as 10-character uppercase hexadecimal string
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    // Format code with middle hyphen for human readability
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    // Append formatted code to results array
    codes.push(formatted);
  }
  // Return array of plaintext recovery codes to present once to the user
  return codes;
}

/**
 * Verifies a candidate recovery code against a stored HMAC-SHA256 hash using constant-time comparison.
 * Constant-time comparison prevents timing attacks that could reveal hash characters.
 */
function verifyRecoveryCode(inputCode, storedHash) {
  // Return false if candidate code or stored hash is missing
  if (!inputCode || !storedHash) return false;
  // Compute HMAC-SHA256 hash of normalized candidate code
  const inputHash = hashRecoveryCode(inputCode);
  // Convert computed hash hex string into binary buffer
  const bufA = Buffer.from(inputHash, 'hex');
  // Convert stored hash hex string into binary buffer
  const bufB = Buffer.from(storedHash, 'hex');
  // If buffer lengths differ, comparison cannot match
  if (bufA.length !== bufB.length) return false;
  // Execute constant-time buffer comparison to prevent side-channel timing attacks
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Normalizes and hashes an intermediate MFA challenge identifier using SHA-256.
 * Guarantees that raw challenge tokens/identifiers are never persisted in plaintext in MongoDB.
 */
function hashMfaChallenge(challenge) {
  // Return empty string if input challenge identifier is absent
  if (!challenge) return '';
  // Compute SHA-256 hex digest of trimmed challenge string
  return crypto.createHash('sha256').update(String(challenge).trim()).digest('hex');
}

// Export MFA utility functions for encryption, TOTP processing, and recovery codes
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
  hashMfaChallenge,
};

