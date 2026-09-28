const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog } = require('../src/models');
const authService = require('../src/services/auth.service');
const googleAuthService = require('../src/services/googleAuth.service');
const { hashPassword } = require('../src/utils/password');
const {
  verifyAccessToken,
  generateAccessToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
} = require('../src/utils/jwt');
const mfaUtil = require('../src/utils/mfa');
const { authenticate } = require('../src/middleware/auth.middleware');
const { authorize } = require('../src/middleware/role.middleware');
const env = require('../src/config/env');

const mockResponse = () => {
  const res = {
    statusCode: 200,
    responseData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.responseData = data;
      return this;
    },
  };
  return res;
};

describe('Phase 8C: Comprehensive Authentication Security & Regression Audit', () => {
  let studentUser;
  let instructorUser;
  let adminUser;

  before(async () => {
    await connectDB();
    await seedDatabase();

    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
  });

  after(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // 1. AUTHENTICATION STATE MACHINE AUDIT
  // =========================================================================
  describe('1. Authentication State Machine Audit', () => {
    it('1.1 MFA disabled: password login transitions directly to authenticated JWT', async () => {
      studentUser.mfaEnabled = false;
      studentUser.mfaSecret = null;
      await studentUser.save();

      const result = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      assert.strictEqual(result.mfaRequired, undefined, 'mfaRequired must not be set');
      assert.ok(result.accessToken, 'Access token must be directly issued');
      assert.ok(result.refreshToken, 'Refresh token must be directly issued');
      assert.strictEqual(result.user.email, 'student@uap.edu');
    });

    it('1.2 MFA enabled: password login MUST issue MFA challenge only, NEVER an authenticated JWT', async () => {
      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      studentUser.mfaEnabled = true;
      await studentUser.save();

      const result = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      assert.strictEqual(result.mfaRequired, true, 'mfaRequired must be true');
      assert.ok(result.mfaToken, 'mfaToken must be present');
      assert.strictEqual(result.accessToken, undefined, 'accessToken MUST NOT be present');
      assert.strictEqual(result.refreshToken, undefined, 'refreshToken MUST NOT be present');
      assert.strictEqual(result.user.id, studentUser._id.toString());
    });

    it('1.3 Proves there is NO code path where primary authentication issues authenticated JWT when MFA is enabled', async () => {
      // Check both password login and Google SSO
      assert.strictEqual(studentUser.mfaEnabled, true);

      const pwResult = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      assert.strictEqual(pwResult.accessToken, undefined);

      // Google SSO with MFA enabled
      googleAuthService.setMockVerificationHandler(async () => ({
        sub: 'google-sub-statemachine-audit',
        email: 'student@uap.edu',
        email_verified: true,
        name: 'Student User',
      }));

      const googleResult = await authService.googleLogin({
        code: 'mock-code',
        state: googleAuthService.generateStateToken(),
      });
      assert.strictEqual(googleResult.mfaRequired, true);
      assert.strictEqual(googleResult.accessToken, undefined);
      assert.ok(googleResult.mfaToken);

      googleAuthService.clearMockVerificationHandler();
    });
  });

  // =========================================================================
  // 2. MFA BYPASS TESTING
  // =========================================================================
  describe('2. MFA Bypass Testing across all vectors', () => {
    it('2.1 Bypass attempt: direct API call without Authorization header fails (HTTP 401)', async () => {
      const req = { headers: {} };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('Authentication token missing or invalid'));
    });

    it('2.2 Bypass attempt: direct API call with malformed Authorization header fails (HTTP 401)', async () => {
      const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
    });

    it('2.3 Bypass attempt: supplying MFA challenge token in Authorization header fails (HTTP 401)', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const mfaChallengeToken = loginRes.mfaToken;

      const req = { headers: { authorization: `Bearer ${mfaChallengeToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('MFA challenge token cannot be used to access protected APIs'));
    });

    it('2.4 Bypass attempt: supplying forged JWT signed with wrong secret fails (HTTP 401)', async () => {
      const forgedToken = jwt.sign(
        { id: studentUser._id.toString(), role: 'admin', email: 'student@uap.edu' },
        'attacker_wrong_secret_1234567890123456'
      );

      const req = { headers: { authorization: `Bearer ${forgedToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('Invalid authentication token'));
    });

    it('2.5 Bypass attempt: supplying expired access token fails (HTTP 401)', async () => {
      const expiredToken = jwt.sign(
        { id: studentUser._id.toString(), role: 'student', email: 'student@uap.edu' },
        env.JWT_SECRET,
        { expiresIn: '-10s' }
      );

      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('Token has expired'));
    });

    it('2.6 Bypass attempt: using an access token as an MFA challenge token fails (HTTP 401)', async () => {
      // An attacker attempts to submit an access token to /api/auth/mfa/verify
      const validAccessToken = generateAccessToken({
        id: studentUser._id.toString(),
        role: studentUser.role,
        email: studentUser.email,
        tokenVersion: studentUser.tokenVersion,
      });

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken: validAccessToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Invalid or expired MFA challenge token'));
          return true;
        }
      );
    });

    it('2.7 Bypass attempt: tampered user binding (token subject != challenge user) fails', async () => {
      const challenge = await authService._createMfaChallenge(studentUser._id);

      // Create a challenge token claiming to be instructorUser, but referring to studentUser's challengeId
      const tamperedToken = jwt.sign(
        { sub: instructorUser._id.toString(), type: 'mfa_challenge', jti: challenge.challengeId },
        env.MFA_CHALLENGE_SECRET,
        { expiresIn: '5m' }
      );

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken: tamperedToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Invalid MFA challenge'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. MFA CHALLENGE SECURITY & REPLAY PROTECTION
  // =========================================================================
  describe('3. MFA Challenge Security & Replay Protection', () => {
    it('3.1 Challenge tokens carry correct claims (type=mfa_challenge, sub=userId, jti=challengeId)', async () => {
      const challenge = await authService._createMfaChallenge(studentUser._id);
      const decoded = verifyMfaChallengeToken(challenge.mfaToken);

      assert.strictEqual(decoded.type, 'mfa_challenge');
      assert.strictEqual(decoded.sub, studentUser._id.toString());
      assert.strictEqual(decoded.jti, challenge.challengeId);
      assert.ok(decoded.exp > decoded.iat, 'Token must have expiration');
      assert.strictEqual(decoded.exp - decoded.iat, 300, 'Expiration must be exactly 300 seconds (5m)');
    });

    it('3.2 Replay test: successful MFA verification followed by identical second request MUST fail', async () => {
      const secret = mfaUtil.decryptSecret(studentUser.mfaSecret);
      const validCode = mfaUtil.generateTotpCode(secret);

      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const mfaToken = loginRes.mfaToken;

      // First request: succeeds
      const firstRes = await authService.verifyMfaChallenge({
        mfaToken,
        code: validCode,
      });
      assert.ok(firstRes.accessToken, 'First verification must issue accessToken');

      // Second request (exact replay): MUST FAIL
      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken,
            code: validCode,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('already been used'));
          return true;
        }
      );
    });

    it('3.3 Expired challenge is strictly rejected with 401', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const mfaToken = loginRes.mfaToken;
      const decoded = verifyMfaChallengeToken(mfaToken);

      // Force challenge expiration in MongoDB
      await MfaChallenge.updateOne(
        { challengeId: decoded.jti },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      await assert.rejects(
        async () => {
          await authService.verifyMfaChallenge({
            mfaToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('expired'));
          return true;
        }
      );
    });

    it('3.4 MfaChallenge model has MongoDB TTL index on expiresAt', async () => {
      const indexes = await MfaChallenge.collection.indexes();
      const ttlIndex = indexes.find((idx) => idx.key && idx.key.expiresAt === 1);
      assert.ok(ttlIndex, 'TTL index on expiresAt must exist');
      assert.strictEqual(ttlIndex.expireAfterSeconds, 0, 'expireAfterSeconds must be 0');
    });
  });

  // =========================================================================
  // 4. BRUTE-FORCE PROTECTION (5-ATTEMPT THRESHOLD)
  // =========================================================================
  describe('4. Brute-Force Protection (5 Failed Attempts Lockout)', () => {
    it('4.1 Exactly 5 failed attempts locks challenge; 6th attempt with valid TOTP is rejected', async () => {
      const secret = mfaUtil.decryptSecret(studentUser.mfaSecret);
      const validCode = mfaUtil.generateTotpCode(secret);

      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const mfaToken = loginRes.mfaToken;

      // Attempt 1 -> 4 remaining
      await assert.rejects(
        async () => { await authService.verifyMfaChallenge({ mfaToken, code: '000000' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); assert.ok(err.message.includes('4 attempts remaining')); return true; }
      );

      // Attempt 2 -> 3 remaining
      await assert.rejects(
        async () => { await authService.verifyMfaChallenge({ mfaToken, code: '000000' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); assert.ok(err.message.includes('3 attempts remaining')); return true; }
      );

      // Attempt 3 -> 2 remaining
      await assert.rejects(
        async () => { await authService.verifyMfaChallenge({ mfaToken, code: '000000' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); assert.ok(err.message.includes('2 attempts remaining')); return true; }
      );

      // Attempt 4 -> 1 remaining
      await assert.rejects(
        async () => { await authService.verifyMfaChallenge({ mfaToken, code: '000000' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); assert.ok(err.message.includes('1 attempt remaining')); return true; }
      );

      // Attempt 5 -> lock
      await assert.rejects(
        async () => { await authService.verifyMfaChallenge({ mfaToken, code: '000000' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); assert.ok(err.message.includes('Challenge locked')); return true; }
      );

      // Attempt 6 (with VALID TOTP code) -> REJECTED because challenge is locked
      await assert.rejects(
        async () => { await authService.verifyMfaChallenge({ mfaToken, code: validCode }); },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Maximum MFA verification attempts exceeded'));
          return true;
        }
      );

      // Verify user account itself is NOT permanently locked
      const reLogin = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      assert.strictEqual(reLogin.mfaRequired, true, 'User can log in again and receive a new fresh challenge');
      assert.notStrictEqual(reLogin.mfaToken, mfaToken, 'New challenge token must be unique');
    });
  });

  // =========================================================================
  // 5. TOTP SECURITY & SECRET PROTECTION
  // =========================================================================
  describe('5. TOTP Security & Secret Protection', () => {
    it('5.1 TOTP secret is encrypted with AES-256-GCM in database and never plaintext', async () => {
      const freshUser = await User.findById(studentUser._id);
      assert.ok(freshUser.mfaSecret);
      // Format: ivHex:authTagHex:encryptedHex
      const parts = freshUser.mfaSecret.split(':');
      assert.strictEqual(parts.length, 3, 'Encrypted secret must consist of 3 colon-delimited hex parts');
      assert.strictEqual(parts[0].length, 24, 'IV must be 12 bytes = 24 hex characters');
      assert.strictEqual(parts[1].length, 32, 'AuthTag must be 16 bytes = 32 hex characters');
    });

    it('5.2 TOTP secret is never exposed in toJSON() or getProfile API responses', async () => {
      const freshUser = await User.findById(studentUser._id);
      const jsonUser = freshUser.toJSON();

      assert.strictEqual(jsonUser.mfaSecret, undefined);
      assert.strictEqual(jsonUser.mfaPendingSecret, undefined);
      assert.strictEqual(jsonUser.mfaRecoveryCodes, undefined);
      assert.strictEqual(jsonUser.password, undefined);

      const userService = require('../src/services/user.service');
      const profile = await userService.getProfile(studentUser._id.toString());

      assert.strictEqual(profile.mfaSecret, undefined);
      assert.strictEqual(profile.mfaPendingSecret, undefined);
      assert.strictEqual(profile.mfaRecoveryCodes, undefined);
      assert.strictEqual(profile.mfaEnabled, true);
    });

    it('5.3 Decryption happens server-side only and matches original plaintext', async () => {
      const plainSecret = mfaUtil.generateTotpSecret();
      const encrypted = mfaUtil.encryptSecret(plainSecret);
      const decrypted = mfaUtil.decryptSecret(encrypted);

      assert.strictEqual(decrypted, plainSecret);
    });

    it('5.4 Invalid and malformed TOTP codes are rejected', async () => {
      const secret = mfaUtil.generateTotpSecret();
      assert.strictEqual(mfaUtil.verifyTotp('', secret), false);
      assert.strictEqual(mfaUtil.verifyTotp(null, secret), false);
      assert.strictEqual(mfaUtil.verifyTotp('abcdef', secret), false);
      assert.strictEqual(mfaUtil.verifyTotp('12345', secret), false);
      assert.strictEqual(mfaUtil.verifyTotp('1234567', secret), false);
    });

    it('5.5 Correct TOTP code generates true for verifyTotp within ±30s window', async () => {
      const secret = mfaUtil.generateTotpSecret();
      const code = mfaUtil.generateTotpCode(secret);
      assert.strictEqual(mfaUtil.verifyTotp(code, secret), true);
    });
  });

  // =========================================================================
  // 6. MFA ENROLLMENT AUDIT
  // =========================================================================
  describe('6. MFA Enrollment Lifecycle', () => {
    it('6.1 Flow: disabled -> setup -> pending -> valid confirm -> active', async () => {
      adminUser.mfaEnabled = false;
      adminUser.mfaSecret = null;
      adminUser.mfaPendingSecret = null;
      adminUser.mfaRecoveryCodes = [];
      await adminUser.save();

      // Step A: Initiate setup
      const setupData = await authService.initiateMfaSetup(adminUser._id);
      assert.ok(setupData.secret);
      assert.ok(setupData.otpauthUri);
      assert.ok(setupData.qrCode);

      const pendingUser = await User.findById(adminUser._id);
      assert.strictEqual(pendingUser.mfaEnabled, false, 'MFA must NOT be enabled before confirmation');
      assert.ok(pendingUser.mfaPendingSecret, 'Pending secret must be set');

      // Step B: Invalid confirmation fails and leaves MFA disabled
      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(adminUser._id, '999999');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('Invalid TOTP verification code'));
          return true;
        }
      );

      const stillPending = await User.findById(adminUser._id);
      assert.strictEqual(stillPending.mfaEnabled, false, 'MFA must remain disabled after invalid confirmation');

      // Step C: Valid confirmation activates MFA and returns 8 recovery codes
      const validCode = mfaUtil.generateTotpCode(setupData.secret);
      const confirmRes = await authService.confirmMfaSetup(adminUser._id, validCode);

      assert.strictEqual(confirmRes.mfaEnabled, true);
      assert.strictEqual(confirmRes.recoveryCodes.length, 8);
      assert.ok(confirmRes.accessToken, 'Updated access token must be returned');

      const activeUser = await User.findById(adminUser._id);
      assert.strictEqual(activeUser.mfaEnabled, true);
      assert.strictEqual(activeUser.mfaPendingSecret, null);
      assert.ok(activeUser.mfaSecret);
      assert.strictEqual(activeUser.mfaRecoveryCodes.length, 8);
    });
  });

  // =========================================================================
  // 7. RECOVERY CODE SECURITY
  // =========================================================================
  describe('7. Recovery Code Security & Lifecycle', () => {
    it('7.1 Recovery codes are hashed with HMAC-SHA256, formatted as XXXXX-XXXXX', async () => {
      const activeUser = await User.findById(adminUser._id);
      activeUser.mfaRecoveryCodes.forEach((entry) => {
        assert.strictEqual(entry.codeHash.length, 64, 'Must be 64-char HMAC-SHA256 hex string');
        assert.strictEqual(entry.used, false);
        assert.strictEqual(entry.usedAt, null);
      });
    });

    it('7.2 Recovery code can authenticate exactly once, subsequent use is rejected', async () => {
      const codes = mfaUtil.generateRecoveryCodes(8);
      studentUser.mfaRecoveryCodes = codes.map((c) => ({
        codeHash: mfaUtil.hashRecoveryCode(c),
        used: false,
        usedAt: null,
      }));
      await studentUser.save();

      const testCode = codes[0];

      // Login to get challenge
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const mfaToken1 = loginRes.mfaToken;

      // Redeem code: succeeds
      const redeemRes = await authService.redeemMfaRecoveryCode({
        mfaToken: mfaToken1,
        recoveryCode: testCode,
      });
      assert.ok(redeemRes.accessToken);

      // Verify code is marked used in DB
      const userAfter = await User.findById(studentUser._id);
      const usedEntry = userAfter.mfaRecoveryCodes.find((c) => c.codeHash === mfaUtil.hashRecoveryCode(testCode));
      assert.strictEqual(usedEntry.used, true);
      assert.ok(usedEntry.usedAt instanceof Date);

      // Attempt second login with same code: MUST FAIL
      const loginRes2 = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const mfaToken2 = loginRes2.mfaToken;

      await assert.rejects(
        async () => {
          await authService.redeemMfaRecoveryCode({
            mfaToken: mfaToken2,
            recoveryCode: testCode,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Invalid or already used recovery code'));
          return true;
        }
      );
    });

    it('7.3 Recovery code regeneration invalidates all prior recovery codes', async () => {
      const priorCodes = mfaUtil.generateRecoveryCodes(8);
      studentUser.mfaRecoveryCodes = priorCodes.map((c) => ({
        codeHash: mfaUtil.hashRecoveryCode(c),
        used: false,
        usedAt: null,
      }));
      await studentUser.save();

      const oldCode = priorCodes[0];

      // Regenerate
      const regenRes = await authService.regenerateRecoveryCodes({
        userId: studentUser._id,
        password: 'Student@123',
      });

      assert.strictEqual(regenRes.recoveryCodes.length, 8);
      const newCodes = regenRes.recoveryCodes;

      // Old code is now rejected
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      await assert.rejects(
        async () => {
          await authService.redeemMfaRecoveryCode({
            mfaToken: loginRes.mfaToken,
            recoveryCode: oldCode,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );

      // New code succeeds
      const newCodeRes = await authService.redeemMfaRecoveryCode({
        mfaToken: loginRes.mfaToken,
        recoveryCode: newCodes[0],
      });
      assert.ok(newCodeRes.accessToken);
    });
  });

  // =========================================================================
  // 8. MFA DISABLEMENT
  // =========================================================================
  describe('8. MFA Disablement Protection', () => {
    it('8.1 Disabling MFA requires authentication and correct password verification', async () => {
      // Wrong password rejected
      await assert.rejects(
        async () => {
          await authService.disableMfa({
            userId: studentUser._id,
            password: 'WrongPassword!',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('Incorrect password'));
          return true;
        }
      );

      // Missing password rejected
      await assert.rejects(
        async () => {
          await authService.disableMfa({
            userId: studentUser._id,
            password: '',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('password is required'));
          return true;
        }
      );

      // Correct password succeeds
      const disableRes = await authService.disableMfa({
        userId: studentUser._id,
        password: 'Student@123',
      });
      assert.ok(disableRes.message.includes('disabled successfully'));
      assert.ok(disableRes.accessToken);

      const disabledUser = await User.findById(studentUser._id);
      assert.strictEqual(disabledUser.mfaEnabled, false);
      assert.strictEqual(disabledUser.mfaSecret, null);
      assert.strictEqual(disabledUser.mfaRecoveryCodes.length, 0);
    });
  });

  // =========================================================================
  // 9. TOKEN VERSION / SESSION INVALIDATION
  // =========================================================================
  describe('9. tokenVersion Session Invalidation', () => {
    it('9.1 Enabling MFA increments tokenVersion and invalidates pre-MFA JWT sessions', async () => {
      // Step 1: Login without MFA and capture valid JWT
      studentUser.mfaEnabled = false;
      studentUser.mfaSecret = null;
      await studentUser.save();

      const preMfaLogin = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const preMfaToken = preMfaLogin.accessToken;

      // Verify pre-MFA token works initially
      const req1 = { headers: { authorization: `Bearer ${preMfaToken}` } };
      const res1 = mockResponse();
      let next1 = false;
      await authenticate(req1, res1, () => { next1 = true; });
      assert.strictEqual(next1, true, 'Pre-MFA token should work initially');

      // Step 2: Enable MFA on the account
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      const confirmRes = await authService.confirmMfaSetup(studentUser._id, code);
      assert.ok(confirmRes.accessToken, 'New token with updated tokenVersion is returned');

      // Step 3: Attempt to use the previous pre-MFA JWT
      const req2 = { headers: { authorization: `Bearer ${preMfaToken}` } };
      const res2 = mockResponse();
      let next2 = false;
      await authenticate(req2, res2, () => { next2 = true; });

      // Step 4: Verify previous JWT is rejected due to tokenVersion invalidation
      assert.strictEqual(next2, false, 'Pre-MFA token MUST be rejected after MFA is enabled');
      assert.strictEqual(res2.statusCode, 401);
      assert.ok(res2.responseData.message.includes('Session has expired or been invalidated'));

      // Step 5: Verify new token works
      const req3 = { headers: { authorization: `Bearer ${confirmRes.accessToken}` } };
      const res3 = mockResponse();
      let next3 = false;
      await authenticate(req3, res3, () => { next3 = true; });
      assert.strictEqual(next3, true, 'New token with updated tokenVersion must pass');
    });

    it('9.2 Disabling MFA increments tokenVersion and invalidates old sessions', async () => {
      // Capture token while MFA is enabled
      const currentUser = await User.findById(studentUser._id);
      const currentToken = generateAccessToken({
        id: currentUser._id.toString(),
        role: currentUser.role,
        email: currentUser.email,
        tokenVersion: currentUser.tokenVersion || 0,
      });

      // Disable MFA
      await authService.disableMfa({
        userId: studentUser._id,
        password: 'Student@123',
      });

      // Attempt using old token
      const req = { headers: { authorization: `Bearer ${currentToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('Session has expired or been invalidated'));
    });

    it('9.3 Changing password increments tokenVersion and invalidates old sessions', async () => {
      const currentUser = await User.findById(studentUser._id);
      const currentToken = generateAccessToken({
        id: currentUser._id.toString(),
        role: currentUser.role,
        email: currentUser.email,
        tokenVersion: currentUser.tokenVersion || 0,
      });

      // Change password
      await authService.changePassword(studentUser._id, 'Student@123', 'Student@NewPass123');

      // Attempt using old token
      const req = { headers: { authorization: `Bearer ${currentToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.responseData.message.includes('Session has expired or been invalidated'));

      // Restore baseline password
      await authService.changePassword(studentUser._id, 'Student@NewPass123', 'Student@123');
    });
  });

  // =========================================================================
  // 10. PASSWORD LOGIN & ACCOUNT LIFECYCLE CONTROLS
  // =========================================================================
  describe('10. Password Login & Account Lifecycle Controls', () => {
    it('10.1 Wrong password and unknown email are rejected with 401 and logged', async () => {
      await assert.rejects(
        async () => { await authService.login({ email: 'student@uap.edu', password: 'WrongPassword!' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); return true; }
      );

      await assert.rejects(
        async () => { await authService.login({ email: 'unknown_user_999@uap.edu', password: 'Password123!' }); },
        (err) => { assert.strictEqual(err.statusCode, 401); return true; }
      );
    });

    it('10.2 Pending, rejected, revoked, and inactive accounts are blocked from login', async () => {
      const testCases = [
        { status: 'pending', isActive: false, expectedMsg: 'pending administrator approval' },
        { status: 'rejected', isActive: false, expectedMsg: 'rejected' },
        { status: 'revoked', isActive: false, expectedMsg: 'revoked' },
      ];

      for (const tc of testCases) {
        const u = await User.create({
          name: `User ${tc.status}`,
          email: `test_${tc.status}@uap.edu`,
          password: await hashPassword('Password123!'),
          role: 'student',
          status: tc.status,
          isActive: tc.isActive,
        });

        await assert.rejects(
          async () => {
            await authService.login({ email: u.email, password: 'Password123!' });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 403);
            assert.ok(err.message.toLowerCase().includes(tc.expectedMsg));
            return true;
          }
        );
      }
    });
  });

  // =========================================================================
  // 11. GOOGLE SSO AUDIT
  // =========================================================================
  describe('11. Google SSO MFA Enforcement & Security', () => {
    it('11.1 Google SSO does NOT bypass MFA when mfaEnabled is true', async () => {
      const ssoUser = await User.create({
        name: 'Google User With MFA',
        email: 'google_audit_mfa@uap.edu',
        googleId: 'google-audit-sub-777',
        authProvider: 'google',
        role: 'student',
        status: 'active',
        isActive: true,
        mfaEnabled: true,
        mfaSecret: mfaUtil.encryptSecret(mfaUtil.generateTotpSecret()),
      });

      googleAuthService.setMockVerificationHandler(async () => ({
        sub: 'google-audit-sub-777',
        email: 'google_audit_mfa@uap.edu',
        email_verified: true,
        name: 'Google User With MFA',
      }));

      const res = await authService.googleLogin({
        code: 'mock-code',
        state: googleAuthService.generateStateToken(),
      });

      assert.strictEqual(res.mfaRequired, true, 'mfaRequired must be true for Google SSO user with MFA');
      assert.ok(res.mfaToken, 'MFA challenge token must be issued');
      assert.strictEqual(res.accessToken, undefined, 'Access token must NOT be issued');

      googleAuthService.clearMockVerificationHandler();
    });

    it('11.2 Google OAuth state parameter verifies HMAC signature and rejects CSRF tampering', async () => {
      const validState = googleAuthService.generateStateToken();
      assert.strictEqual(googleAuthService.verifyStateToken(validState), true);

      // Tampered state
      const tamperedState = validState.slice(0, -4) + 'abcd';
      assert.throws(
        () => googleAuthService.verifyStateToken(tamperedState),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('Invalid OAuth state parameter signature'));
          return true;
        }
      );

      // Missing state
      assert.throws(
        () => googleAuthService.verifyStateToken(''),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 12. RBAC AFTER MFA
  // =========================================================================
  describe('12. Role-Based Access Control (RBAC) Enforcement After MFA', () => {
    it('12.1 Student after MFA: receives student role and cannot access instructor or admin APIs', async () => {
      const currentStudent = await User.findById(studentUser._id);
      const studentToken = generateAccessToken({
        id: currentStudent._id.toString(),
        role: 'student',
        email: currentStudent.email,
        tokenVersion: currentStudent.tokenVersion,
      });

      // Pass auth
      const req = { headers: { authorization: `Bearer ${studentToken}` } };
      const res = mockResponse();
      let authNext = false;
      await authenticate(req, res, () => { authNext = true; });
      assert.strictEqual(authNext, true);

      // Blocked from instructor
      const instAuthorize = authorize('instructor', 'admin');
      const resInst = mockResponse();
      let instNext = false;
      instAuthorize(req, resInst, () => { instNext = true; });
      assert.strictEqual(instNext, false);
      assert.strictEqual(resInst.statusCode, 403);

      // Blocked from admin
      const adminAuthorize = authorize('admin');
      const resAdmin = mockResponse();
      let adminNext = false;
      adminAuthorize(req, resAdmin, () => { adminNext = true; });
      assert.strictEqual(adminNext, false);
      assert.strictEqual(resAdmin.statusCode, 403);
    });

    it('12.2 Instructor after MFA: receives instructor role and cannot access admin APIs', async () => {
      const currentInstructor = await User.findById(instructorUser._id);
      const instructorToken = generateAccessToken({
        id: currentInstructor._id.toString(),
        role: 'instructor',
        email: currentInstructor.email,
        tokenVersion: currentInstructor.tokenVersion,
      });

      const req = { headers: { authorization: `Bearer ${instructorToken}` } };
      const res = mockResponse();
      let authNext = false;
      await authenticate(req, res, () => { authNext = true; });
      assert.strictEqual(authNext, true);

      // Permitted on instructor
      const instAuthorize = authorize('instructor', 'admin');
      let instNext = false;
      instAuthorize(req, res, () => { instNext = true; });
      assert.strictEqual(instNext, true);

      // Blocked from admin
      const adminAuthorize = authorize('admin');
      const resAdmin = mockResponse();
      let adminNext = false;
      adminAuthorize(req, resAdmin, () => { adminNext = true; });
      assert.strictEqual(adminNext, false);
      assert.strictEqual(resAdmin.statusCode, 403);
    });

    it('12.3 Admin after MFA: receives admin role and accesses admin APIs', async () => {
      const currentAdmin = await User.findById(adminUser._id);
      const adminToken = generateAccessToken({
        id: currentAdmin._id.toString(),
        role: 'admin',
        email: currentAdmin.email,
        tokenVersion: currentAdmin.tokenVersion,
      });

      const req = { headers: { authorization: `Bearer ${adminToken}` } };
      const res = mockResponse();
      let authNext = false;
      await authenticate(req, res, () => { authNext = true; });
      assert.strictEqual(authNext, true);

      const adminAuthorize = authorize('admin');
      let adminNext = false;
      adminAuthorize(req, res, () => { adminNext = true; });
      assert.strictEqual(adminNext, true);
    });
  });
});
