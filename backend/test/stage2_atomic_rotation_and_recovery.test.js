const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Session, AuditLog } = require('../src/models');
const authService = require('../src/services/auth.service');
const {
  hashToken,
  getKey,
  getActiveKeyVersion,
  encryptRecoveryToken,
  decryptRecoveryToken,
  validateSessionEncryptionKey,
  resetKeyRegistry,
} = require('../src/utils/sessionCrypto');
const { verifyAccessToken } = require('../src/utils/jwt');

describe('Stage 2: Atomic CAS Rotation, Multi-Rotation Recovery & Production Safety', () => {
  let studentUser;

  before(async () => {
    await connectDB();
    await seedDatabase();
    studentUser = await User.findOne({ email: 'student@uap.edu' });
  });

  after(async () => {
    await disconnectDB();
  });

  describe('1. Atomic Rotation & Multi-Rotation Recovery Chain (T1 -> T2 -> T3)', () => {
    it('1.1 should rotate T1 to T2, recording T1 in recentRotations with 30s grace window', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });

      assert.ok(loginRes.refreshToken, 'Login must yield refresh token');
      const t1 = loginRes.refreshToken;
      const t1Hash = hashToken(t1);

      // Verify Session record was created on login
      const initialSession = await Session.findOne({ currentTokenHash: t1Hash });
      assert.ok(initialSession, 'Session document must exist for T1');
      assert.strictEqual(initialSession.status, 'active');

      // Rotate T1 -> T2
      const refreshRes = await authService.refreshAccessToken({
        refreshToken: t1,
        ipAddress: '127.0.0.1',
      });

      assert.ok(refreshRes.refreshToken, 'Must yield T2');
      const t2 = refreshRes.refreshToken;
      assert.notStrictEqual(t1, t2, 'T2 must be different from T1');

      // Inspect Session document in MongoDB
      const updatedSession = await Session.findOne({ _id: initialSession._id });
      assert.strictEqual(updatedSession.currentTokenHash, hashToken(t2));
      assert.strictEqual(updatedSession.recentRotations.length, 1);
      assert.strictEqual(updatedSession.recentRotations[0].tokenHash, t1Hash);
      assert.strictEqual(updatedSession.recentRotations[0].replacedByTokenHash, hashToken(t2));
      assert.ok(updatedSession.recentRotations[0].graceExpiresAt > new Date());
    });

    it('1.2 should recover T2 when T1 is retried within the 30-second grace window (Lost Response Recovery)', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // Rotate T1 -> T2
      const firstRefresh = await authService.refreshAccessToken({
        refreshToken: t1,
        ipAddress: '127.0.0.1',
      });
      const t2 = firstRefresh.refreshToken;

      // Simulate lost response: Client retries with T1
      const retryRefresh = await authService.refreshAccessToken({
        refreshToken: t1,
        ipAddress: '127.0.0.1',
      });

      assert.ok(retryRefresh.accessToken, 'Lost-response retry must issue access token');
      assert.strictEqual(retryRefresh.refreshToken, t2, 'Retry of T1 must return the identical T2');
    });

    it('1.3 Multi-Rotation: should preserve T1 recovery even after T2 rotates to T3 (T1 -> T2 -> T3)', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // 1st rotation: T1 -> T2
      const res1 = await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
      const t2 = res1.refreshToken;

      // 2nd rotation: T2 -> T3 (happens before T1 grace window expires)
      const res2 = await authService.refreshAccessToken({ refreshToken: t2, ipAddress: '127.0.0.1' });
      const t3 = res2.refreshToken;

      // Verify Session has both T1 and T2 in recentRotations
      const session = await Session.findOne({ currentTokenHash: hashToken(t3) });
      assert.strictEqual(session.recentRotations.length, 2, 'recentRotations must preserve both T1 and T2');

      // Now a delayed in-flight request presents T1:
      const retryT1 = await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
      assert.ok(retryT1.accessToken, 'Delayed retry of T1 must succeed');
      assert.strictEqual(retryT1.refreshToken, t2, 'T1 recovery must recover its linked replacement');
    });

    it('1.4 Replay beyond grace window: should detect token reuse, revoke family, and return 401', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // Rotate T1 -> T2
      const res1 = await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
      const t2 = res1.refreshToken;

      // Manually artificially expire T1's grace window in DB
      const session = await Session.findOne({ currentTokenHash: hashToken(t2) });
      session.recentRotations[0].graceExpiresAt = new Date(Date.now() - 5000); // 5 seconds in past
      await session.save();

      // Attempt to present T1 outside its grace window
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /token reuse detected/i);
          return true;
        },
        'Replay outside grace window must be rejected with 401'
      );

      // Verify session was marked compromised
      const compromisedSession = await Session.findById(session._id);
      assert.strictEqual(compromisedSession.status, 'compromised');

      // Subsequent attempt with T2 must also fail because family is compromised
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: t2, ipAddress: '127.0.0.1' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /Session has been revoked/i);
          return true;
        }
      );
    });
  });

  describe('2. Single Revocation & Reactivation Security Invariance', () => {
    it('2.1 Admin single revocation must bump tokenVersion and revoke active sessions', async () => {
      const initialVersion = studentUser.tokenVersion || 0;
      studentUser.status = 'active';
      studentUser.isActive = true;
      await studentUser.save();

      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const validToken = loginRes.accessToken;

      // Mock admin controller revokeUser call
      const adminController = require('../src/controllers/admin.controller');
      const req = {
        params: { id: studentUser._id.toString() },
        user: { _id: new mongoose.Types.ObjectId() },
        body: { reason: 'Policy violation' },
        ip: '127.0.0.1',
      };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.data = data; return this; },
      };

      await adminController.revokeUser(req, res, (err) => { if (err) throw err; });

      const updatedUser = await User.findById(studentUser._id);
      assert.strictEqual(updatedUser.status, 'revoked');
      assert.strictEqual(updatedUser.isActive, false);
      assert.strictEqual(updatedUser.tokenVersion, initialVersion + 1, 'tokenVersion MUST be incremented on single revocation');

      // Now restore user
      await adminController.restoreUser(req, res, (err) => { if (err) throw err; });
      const restoredUser = await User.findById(studentUser._id);
      assert.strictEqual(restoredUser.status, 'active');
      assert.strictEqual(restoredUser.tokenVersion, initialVersion + 2, 'tokenVersion MUST be incremented on restore');
    });
  });

  describe('3. Logout & Multi-Device Isolation', () => {
    it('3.1 Single logout revokes only the target session family', async () => {
      // Device A login
      const loginA = await authService.login({ email: 'student@uap.edu', password: 'Student@123' });
      // Device B login
      const loginB = await authService.login({ email: 'student@uap.edu', password: 'Student@123' });

      assert.notStrictEqual(loginA.refreshToken, loginB.refreshToken);

      // Logout Device A
      await authService.logout({ refreshToken: loginA.refreshToken, userId: studentUser._id });

      // Device A refresh should fail
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: loginA.refreshToken });
        },
        /Session has been revoked/i
      );

      // Device B refresh MUST STILL SUCCEED! (Multi-Device Isolation)
      const refreshB = await authService.refreshAccessToken({ refreshToken: loginB.refreshToken });
      assert.ok(refreshB.accessToken, 'Device B must remain active and isolated from Device A logout');
    });
  });

  describe('4. Critical Concurrency & Race Condition Verification', () => {
    it('4.1 Two simultaneous refresh requests using the same token both succeed via CAS & recovery', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // Dispatch two simultaneous refresh requests using identical token T1
      const [resA, resB] = await Promise.all([
        authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' }),
        authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' }),
      ]);

      // Both requests must succeed and return valid access tokens
      assert.ok(resA.accessToken, 'Request A must yield access token');
      assert.ok(resB.accessToken, 'Request B must yield access token');

      // Both requests must yield the exact same replacement refresh token
      assert.strictEqual(resA.refreshToken, resB.refreshToken, 'Both simultaneous requests must resolve to the same replacement token');

      // Session document must reflect exactly 1 rotation (no split-brain or double consumption)
      const session = await Session.findOne({ currentTokenHash: hashToken(resA.refreshToken) });
      assert.ok(session, 'Session document must exist for replacement token');
      assert.strictEqual(session.recentRotations.length, 1, 'Only one rotation entry must be recorded');
      assert.strictEqual(session.version, 1, 'Session version must be exactly incremented by 1');
    });

    it('4.2 Logout racing with refresh request ensures revoked session cannot be refreshed', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // Execute logout followed immediately by refresh
      await authService.logout({ refreshToken: t1, userId: studentUser._id });

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
        },
        /Session has been revoked/i
      );
    });

    it('4.3 LogoutAll revokes all active sessions across multiple devices and increments tokenVersion', async () => {
      const initialVersion = (await User.findById(studentUser._id)).tokenVersion || 0;

      // Log in on Device 1 and Device 2
      const dev1 = await authService.login({ email: 'student@uap.edu', password: 'Student@123' });
      const dev2 = await authService.login({ email: 'student@uap.edu', password: 'Student@123' });

      // Call logoutAll
      await authService.logoutAll(studentUser._id);

      // Verify user tokenVersion was incremented
      const updatedUser = await User.findById(studentUser._id);
      assert.strictEqual(updatedUser.tokenVersion, initialVersion + 1);

      // Both devices must be rejected on refresh
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: dev1.refreshToken });
        },
        /Session has expired or been invalidated|Session has been revoked/i
      );

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: dev2.refreshToken });
        },
        /Session has expired or been invalidated|Session has been revoked/i
      );
    });
  });

  describe('5. Encryption Key Registry & Versioning Matrix', () => {
    const originalEnvKey = process.env.SESSION_ENCRYPTION_KEY;
    const originalEnvVer = process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
    const originalNodeEnv = process.env.NODE_ENV;

    const KEY_V1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const KEY_V2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

    after(() => {
      if (originalEnvKey !== undefined) process.env.SESSION_ENCRYPTION_KEY = originalEnvKey;
      else delete process.env.SESSION_ENCRYPTION_KEY;

      if (originalEnvVer !== undefined) process.env.SESSION_ENCRYPTION_ACTIVE_VERSION = originalEnvVer;
      else delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;

      if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
      else delete process.env.NODE_ENV;

      resetKeyRegistry();
    });

    it('5.1 should support single 64-character hex key configuration with default v1', () => {
      process.env.SESSION_ENCRYPTION_KEY = KEY_V1;
      delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
      resetKeyRegistry();

      assert.strictEqual(getActiveKeyVersion(), 'v1');
      const keyBuf = getKey();
      assert.strictEqual(keyBuf.length, 32);

      const context = {
        familyId: 'fam_single',
        userId: new mongoose.Types.ObjectId().toString(),
        parentTokenHash: hashToken('parent'),
      };
      const envelope = encryptRecoveryToken('sample_token', context);
      assert.ok(envelope.startsWith('v1:'));
      const decrypted = decryptRecoveryToken(envelope, context);
      assert.strictEqual(decrypted, 'sample_token');
    });

    it('5.2 should support valid multi-key JSON configuration with explicit active version', () => {
      process.env.SESSION_ENCRYPTION_KEY = JSON.stringify({ v1: KEY_V1, v2: KEY_V2 });
      process.env.SESSION_ENCRYPTION_ACTIVE_VERSION = 'v2';
      resetKeyRegistry();

      assert.strictEqual(getActiveKeyVersion(), 'v2');
      const v2Key = getKey('v2');
      assert.strictEqual(v2Key.length, 32);

      const context = {
        familyId: 'fam_multi',
        userId: new mongoose.Types.ObjectId().toString(),
        parentTokenHash: hashToken('parent_multi'),
      };
      const envelope = encryptRecoveryToken('sample_token_v2', context);
      assert.ok(envelope.startsWith('v2:'));
      const decrypted = decryptRecoveryToken(envelope, context);
      assert.strictEqual(decrypted, 'sample_token_v2');
    });

    it('5.3 should reject invalid key length and malformed key values', () => {
      // Invalid hex length (too short)
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef';
      delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
      resetKeyRegistry();
      assert.throws(() => getKey(), /must be a valid 64-character/);

      // Non-hex character
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789zzzzzz';
      resetKeyRegistry();
      assert.throws(() => getKey(), /must be a valid 64-character/);

      // Malformed JSON syntax
      process.env.SESSION_ENCRYPTION_KEY = '{ v1: "missing_quotes" }';
      resetKeyRegistry();
      assert.throws(() => getKey(), /Malformed JSON/);

      // Invalid key inside JSON
      process.env.SESSION_ENCRYPTION_KEY = JSON.stringify({ v1: 'short_key' });
      process.env.SESSION_ENCRYPTION_ACTIVE_VERSION = 'v1';
      resetKeyRegistry();
      assert.throws(() => getKey(), /must be a valid 64-character/);
    });

    it('5.4 should support active v2 encryption with v1 backward decryption', () => {
      const context = {
        familyId: 'fam_compat',
        userId: new mongoose.Types.ObjectId().toString(),
        parentTokenHash: hashToken('parent_compat'),
      };

      // 1. Initially on v1: encrypt recovery token
      process.env.SESSION_ENCRYPTION_KEY = KEY_V1;
      delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
      resetKeyRegistry();
      const v1Envelope = encryptRecoveryToken('token_from_v1_era', context);
      assert.ok(v1Envelope.startsWith('v1:'));

      // 2. Rotate to multi-key JSON with active v2
      process.env.SESSION_ENCRYPTION_KEY = JSON.stringify({ v1: KEY_V1, v2: KEY_V2 });
      process.env.SESSION_ENCRYPTION_ACTIVE_VERSION = 'v2';
      resetKeyRegistry();

      // New token must encrypt with v2
      const v2Envelope = encryptRecoveryToken('token_from_v2_era', context);
      assert.ok(v2Envelope.startsWith('v2:'));

      // Both envelopes must decrypt successfully
      const decryptedV2 = decryptRecoveryToken(v2Envelope, context);
      assert.strictEqual(decryptedV2, 'token_from_v2_era');

      const decryptedV1 = decryptRecoveryToken(v1Envelope, context);
      assert.strictEqual(decryptedV1, 'token_from_v1_era', 'v1 envelope must remain decodable under multi-key v2 configuration');
    });

    it('5.5 should fail clearly when active key version is missing or nonexistent', () => {
      // Multi-key without active version specified
      process.env.SESSION_ENCRYPTION_KEY = JSON.stringify({ v1: KEY_V1, v2: KEY_V2 });
      delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
      resetKeyRegistry();
      assert.throws(
        () => getKey(),
        /SESSION_ENCRYPTION_ACTIVE_VERSION must be explicitly specified when multiple encryption keys are configured/
      );

      // Nonexistent active version
      process.env.SESSION_ENCRYPTION_ACTIVE_VERSION = 'v99';
      resetKeyRegistry();
      assert.throws(
        () => getKey(),
        /Configured active key version "v99" does not exist in SESSION_ENCRYPTION_KEY registry/
      );
    });

    it('5.6 should perform strict production startup validation', () => {
      process.env.NODE_ENV = 'production';

      // Missing in production
      delete process.env.SESSION_ENCRYPTION_KEY;
      delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
      resetKeyRegistry();
      assert.throws(() => validateSessionEncryptionKey(), /SESSION_ENCRYPTION_KEY environment variable is required in production/);

      // Valid single key in production
      process.env.SESSION_ENCRYPTION_KEY = KEY_V1;
      resetKeyRegistry();
      assert.doesNotThrow(() => validateSessionEncryptionKey());

      // Valid multi-key in production
      process.env.SESSION_ENCRYPTION_KEY = JSON.stringify({ v1: KEY_V1, v2: KEY_V2 });
      process.env.SESSION_ENCRYPTION_ACTIVE_VERSION = 'v2';
      resetKeyRegistry();
      assert.doesNotThrow(() => validateSessionEncryptionKey());

      // Multi-key in production with missing active version
      delete process.env.SESSION_ENCRYPTION_ACTIVE_VERSION;
      resetKeyRegistry();
      assert.throws(() => validateSessionEncryptionKey(), /SESSION_ENCRYPTION_ACTIVE_VERSION must be explicitly specified/);
    });
  });

  describe('6. Session Expiration & Concurrent Expiry Invariance', () => {
    it('6.1 Expired session refresh must be rejected and marked revoked', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // Artificially expire the session in MongoDB
      const session = await Session.findOne({ currentTokenHash: hashToken(t1) });
      session.expiresAt = new Date(Date.now() - 5000); // 5 seconds in past
      await session.save();

      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /Session has expired/i);
          return true;
        },
        'Expired session must be rejected with HTTP 401'
      );

      // Verify status transitioned to revoked
      const updated = await Session.findById(session._id);
      assert.strictEqual(updated.status, 'revoked');
      assert.strictEqual(updated.revocationReason, 'session_expired');
    });

    it('6.2 Concurrent refresh after session expiry must reject all requests with 401', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;

      // Artificially expire the session in MongoDB
      const session = await Session.findOne({ currentTokenHash: hashToken(t1) });
      session.expiresAt = new Date(Date.now() - 5000);
      await session.save();

      // Dispatch two simultaneous refresh requests against expired session
      const [p1, p2] = await Promise.allSettled([
        authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' }),
        authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' }),
      ]);

      assert.strictEqual(p1.status, 'rejected');
      assert.strictEqual(p2.status, 'rejected');
      assert.strictEqual(p1.reason.statusCode, 401);
      assert.strictEqual(p2.reason.statusCode, 401);
      assert.match(p1.reason.message, /Session has expired|Session has been revoked/i);
      assert.match(p2.reason.message, /Session has expired|Session has been revoked/i);
    });
  });

  describe('7. Replay Behaviour After History-Buffer Eviction', () => {
    it('7.1 Eviction investigation: demonstrates lifecycle when token is evicted from recentRotations and historicalRevokedHashes', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
        ipAddress: '127.0.0.1',
      });
      const t1 = loginRes.refreshToken;
      const t1Hash = hashToken(t1);

      const initialSession = await Session.findOne({ currentTokenHash: t1Hash });
      const originalFamilyId = initialSession.familyId;

      // Perform 26 sequential rotations to exceed recentRotations (5) + historicalRevokedHashes (20)
      let currentToken = t1;
      for (let i = 1; i <= 26; i++) {
        const res = await authService.refreshAccessToken({ refreshToken: currentToken, ipAddress: '127.0.0.1' });
        currentToken = res.refreshToken;
      }

      // Verify T1 has been evicted from the original session document
      const sessionAfterRotations = await Session.findById(initialSession._id);
      assert.strictEqual(sessionAfterRotations.familyId, originalFamilyId);
      assert.strictEqual(sessionAfterRotations.recentRotations.some((r) => r.tokenHash === t1Hash), false, 'T1 must be evicted from recentRotations');
      assert.strictEqual(sessionAfterRotations.historicalRevokedHashes.includes(t1Hash), false, 'T1 must be evicted from historicalRevokedHashes');

      // Investigation observation:
      // When T1 is presented now, Session.findOne matching t1Hash returns null.
      // Because of legacy migration fallback (if (!session)), presenting T1 establishes a new session family.
      const replayRes = await authService.refreshAccessToken({ refreshToken: t1, ipAddress: '127.0.0.1' });
      assert.ok(replayRes.accessToken, 'Demonstrates legacy fallback creates session when hash is completely evicted');
      assert.notStrictEqual(replayRes.refreshToken, currentToken);

      // Verify that the newly established session has a different familyId from originalFamilyId
      const newSession = await Session.findOne({ currentTokenHash: hashToken(replayRes.refreshToken) });
      assert.ok(newSession, 'New session exists for evicted token');
      assert.notStrictEqual(newSession.familyId, originalFamilyId, 'Evicted token replay creates new isolated family, leaving original family untouched');
    });
  });
});

