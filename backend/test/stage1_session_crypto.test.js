const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Session, User } = require('../src/models');
const {
  getKey,
  encryptRecoveryToken,
  decryptRecoveryToken,
  hashToken,
} = require('../src/utils/sessionCrypto');

describe('Stage 1: Session Model & Cryptography Verification', () => {
  before(async () => {
    await connectDB();
    await Session.init();
  });

  after(async () => {
    await disconnectDB();
  });

  describe('1. AES-256-GCM Session Token Cryptography', () => {
    const context = {
      familyId: 'fam_test_123',
      userId: new mongoose.Types.ObjectId().toString(),
      parentTokenHash: hashToken('parent_refresh_token_string'),
    };
    const sampleToken = 'uap_sample_refresh_token_jwt_secret_value_12345';

    it('1.1 should correctly encrypt and decrypt recovery token with AAD context', () => {
      const envelope = encryptRecoveryToken(sampleToken, context);
      assert.ok(envelope, 'Envelope should be non-empty string');
      assert.strictEqual(envelope.startsWith('v1:'), true, 'Should use v1 version prefix');

      const parts = envelope.split(':');
      assert.strictEqual(parts.length, 4, 'Envelope must contain exactly 4 parts (version:iv:tag:ciphertext)');

      const decrypted = decryptRecoveryToken(envelope, context);
      assert.strictEqual(decrypted, sampleToken, 'Decrypted token must exactly match original plaintext');
    });

    it('1.2 should fail decryption if ciphertext or authTag is tampered with', () => {
      const envelope = encryptRecoveryToken(sampleToken, context);
      const [version, ivHex, authTagHex, ciphertextHex] = envelope.split(':');

      // Tamper with ciphertext
      const tamperedCipher = ciphertextHex.slice(0, -2) + (ciphertextHex.endsWith('aa') ? 'bb' : 'aa');
      const tamperedEnvelope = `${version}:${ivHex}:${authTagHex}:${tamperedCipher}`;

      assert.throws(
        () => decryptRecoveryToken(tamperedEnvelope, context),
        /Cryptographic verification failed/,
        'Tampered ciphertext must fail authentication tag verification'
      );
    });

    it('1.3 should fail decryption if AAD context does not match', () => {
      const envelope = encryptRecoveryToken(sampleToken, context);

      // Wrong familyId
      assert.throws(
        () => decryptRecoveryToken(envelope, { ...context, familyId: 'wrong_fam' }),
        /Cryptographic verification failed/,
        'Mismatched familyId in AAD must reject decryption'
      );

      // Wrong userId
      assert.throws(
        () => decryptRecoveryToken(envelope, { ...context, userId: new mongoose.Types.ObjectId().toString() }),
        /Cryptographic verification failed/,
        'Mismatched userId in AAD must reject decryption'
      );

      // Wrong parentTokenHash
      assert.throws(
        () => decryptRecoveryToken(envelope, { ...context, parentTokenHash: hashToken('other_token') }),
        /Cryptographic verification failed/,
        'Mismatched parentTokenHash in AAD must reject decryption'
      );
    });

    it('1.4 should compute deterministic SHA-256 token hash', () => {
      const token = 'my_test_token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      assert.strictEqual(hash1, hash2, 'Hash must be deterministic');
      assert.strictEqual(hash1.length, 64, 'SHA-256 hex must be 64 characters');
    });
  });

  describe('2. Session Model Persistence & Indexes', () => {
    it('2.1 should create and persist a valid Session document', async () => {
      const testUserId = new mongoose.Types.ObjectId();
      const token = 'token_abc_123';
      const session = await Session.create({
        familyId: `fam_${Date.now()}`,
        userId: testUserId,
        currentTokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      assert.ok(session._id, 'Session must have MongoDB _id');
      assert.strictEqual(session.status, 'active');
      assert.strictEqual(session.version, 0);
      assert.deepStrictEqual(session.recentRotations, []);

      // Verify toJSON transform strips sensitive fields
      const json = session.toJSON();
      assert.strictEqual(json.currentTokenHash, undefined, 'currentTokenHash must be stripped from toJSON');
    });

    it('2.2 should enforce unique index on familyId', async () => {
      const duplicateFamily = `duplicate_fam_${Date.now()}`;
      const userId = new mongoose.Types.ObjectId();

      await Session.create({
        familyId: duplicateFamily,
        userId,
        currentTokenHash: hashToken('token_1'),
        expiresAt: new Date(Date.now() + 10000),
      });

      await assert.rejects(
        async () => {
          await Session.create({
            familyId: duplicateFamily,
            userId,
            currentTokenHash: hashToken('token_2'),
            expiresAt: new Date(Date.now() + 10000),
          });
        },
        /E11000.*duplicate key error/,
        'Duplicate familyId must be rejected by unique index'
      );
    });

    it('2.3 should support appending to recentRotations ring buffer', async () => {
      const userId = new mongoose.Types.ObjectId();
      const familyId = `fam_rot_${Date.now()}`;
      const session = await Session.create({
        familyId,
        userId,
        currentTokenHash: hashToken('initial_token'),
        expiresAt: new Date(Date.now() + 10000),
      });

      const encryptedT2 = encryptRecoveryToken('t2_token', {
        familyId,
        userId: userId.toString(),
        parentTokenHash: hashToken('initial_token'),
      });

      session.recentRotations.push({
        tokenHash: hashToken('initial_token'),
        replacedByTokenHash: hashToken('t2_token'),
        rotatedAt: new Date(),
        graceExpiresAt: new Date(Date.now() + 30000),
        encryptedReplacementToken: encryptedT2,
      });
      session.currentTokenHash = hashToken('t2_token');
      session.version += 1;
      await session.save();

      const fetched = await Session.findOne({ familyId });
      assert.strictEqual(fetched.recentRotations.length, 1);
      assert.strictEqual(fetched.recentRotations[0].tokenHash, hashToken('initial_token'));
      assert.strictEqual(fetched.version, 1);
    });
  });
});
