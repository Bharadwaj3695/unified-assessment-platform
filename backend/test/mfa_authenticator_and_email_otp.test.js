
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog, SystemSetting, Session } = require('../src/models');
const authService = require('../src/services/auth.service');
const emailService = require('../src/services/email.service');
const { hashPassword } = require('../src/utils/password');
const { verifyAccessToken, generateAccessToken, generateMfaChallengeToken, verifyMfaChallengeToken } = require('../src/utils/jwt');
const mfaUtil = require('../src/utils/mfa');
const { authenticate } = require('../src/middleware/auth.middleware');
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

describe('Authenticator MFA & Email OTP Alternative Security Suite', () => {
  let studentUser;
  let instructorUser;
  let adminUser;
  let defaultPassword;

  before(async () => {
    await connectDB();
    await seedDatabase();

    defaultPassword = await hashPassword('Student@123');
    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    emailService.clearSentEmails();
    if (studentUser && instructorUser && adminUser) {
      await MfaChallenge.deleteMany({
        userId: { $in: [studentUser._id, instructorUser._id, adminUser._id] },
      });
    }
    // Ensure email OTP is enabled in settings by default
    await SystemSetting.findOneAndUpdate(
      {},
      { $set: { mfaEmailOtpEnabled: true, mfaEmailOtpExpiryMinutes: 5, mfaEmailOtpResendCooldownSeconds: 60, mfaEmailOtpMaxResends: 3 } },
      { upsert: true }
    );
  });

  // =========================================================================
  // 1. Authenticator TOTP Enrollment & Secure Secret Storage
  // =========================================================================
  describe('1. Authenticator TOTP Enrollment & Verification', () => {
    it('1.1 Generates unique TOTP secret, QR code data URL, and manual key alternative', async () => {
      const setupData = await authService.initiateMfaSetup(studentUser._id);

      assert.ok(setupData.secret, 'Manual Base32 secret must be returned');
      assert.strictEqual(typeof setupData.secret, 'string');
      assert.ok(setupData.secret.length >= 16, 'Secret must be at least 16 chars');
      assert.ok(setupData.qrCode, 'QR code Data URL must be returned');
      assert.ok(setupData.qrCode.startsWith('data:image/png;base64,'), 'QR code must be a base64 PNG image');
      assert.ok(setupData.otpauthUri, 'otpauth URI must be present');
      assert.ok(setupData.otpauthUri.includes(encodeURIComponent(studentUser.email)));

      // Verify pending secret is stored encrypted in MongoDB, not plaintext
      const dbUser = await User.findById(studentUser._id);
      assert.ok(dbUser.mfaPendingSecret, 'mfaPendingSecret must be saved');
      assert.notStrictEqual(dbUser.mfaPendingSecret, setupData.secret, 'mfaPendingSecret must NOT be stored in plaintext');
      assert.ok(dbUser.mfaPendingSecret.includes(':'), 'Encrypted secret must be iv:tag:ciphertext format');

      // Verify decrypted secret matches original
      const decrypted = mfaUtil.decryptSecret(dbUser.mfaPendingSecret);
      assert.strictEqual(decrypted, setupData.secret);
    });

    it('1.2 Rejects invalid first authenticator code during enrollment confirmation', async () => {
      await authService.initiateMfaSetup(studentUser._id);

      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(studentUser._id, '000000');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /invalid.*code/i);
          return true;
        }
      );

      const dbUser = await User.findById(studentUser._id);
      assert.strictEqual(dbUser.mfaEnabled, false, 'MFA must remain disabled after invalid first code');
    });

    it('1.3 Successfully confirms enrollment with valid TOTP code and generates 8 recovery codes', async () => {
      const setupData = await authService.initiateMfaSetup(studentUser._id);
      const validCode = mfaUtil.generateTotpCode(setupData.secret);

      const confirmResult = await authService.confirmMfaSetup(studentUser._id, validCode);

      assert.ok(confirmResult.message.includes('successfully'));
      assert.ok(Array.isArray(confirmResult.recoveryCodes), 'Must return recovery codes array');
      assert.strictEqual(confirmResult.recoveryCodes.length, 8, 'Must return exactly 8 recovery codes');

      const dbUser = await User.findById(studentUser._id);
      assert.strictEqual(dbUser.mfaEnabled, true);
      assert.strictEqual(dbUser.mfaPendingSecret, null);
      assert.ok(dbUser.mfaSecret, 'mfaSecret must be set');
      assert.notStrictEqual(dbUser.mfaSecret, setupData.secret, 'mfaSecret must be encrypted');
      assert.strictEqual(dbUser.mfaRecoveryCodes.length, 8);
      // Verify recovery codes are stored as hashes
      assert.ok(dbUser.mfaRecoveryCodes[0].codeHash);
      assert.notStrictEqual(dbUser.mfaRecoveryCodes[0].codeHash, confirmResult.recoveryCodes[0]);
    });

    it('1.4 Standard TOTP verification on login challenge succeeds with genuine credentials', async () => {
      const dbUser = await User.findById(studentUser._id);
      const secret = mfaUtil.decryptSecret(dbUser.mfaSecret);
      const validCode = mfaUtil.generateTotpCode(secret);

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      assert.strictEqual(loginRes.mfaRequired, true);
      assert.ok(loginRes.mfaToken);

      const verifyRes = await authService.verifyMfaChallenge({
        mfaToken: loginRes.mfaToken,
        code: validCode,
      });

      assert.ok(verifyRes.accessToken, 'Access token must be issued');
      assert.ok(verifyRes.refreshToken, 'Refresh token must be issued');
      assert.strictEqual(verifyRes.user.email, studentUser.email);
    });
  });

  // =========================================================================
  // 2. Email OTP Generation, Masking & Delivery
  // =========================================================================
  describe('2. Email OTP Delivery and Masking', () => {
    let mfaToken;

    beforeEach(async () => {
      // Ensure student has MFA enabled
      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      studentUser.mfaEnabled = true;
      await studentUser.save();

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      mfaToken = loginRes.mfaToken;
      emailService.clearSentEmails();
    });

    it('2.1 Login response lists allowedMethods including email_otp and masked email', async () => {
      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      assert.strictEqual(loginRes.mfaRequired, true);
      assert.ok(Array.isArray(loginRes.allowedMethods));
      assert.ok(loginRes.allowedMethods.includes('totp'));
      assert.ok(loginRes.allowedMethods.includes('email_otp'));
      assert.ok(loginRes.allowedMethods.includes('recovery_code'));
    });

    it('2.2 Dispatches 6-digit email OTP ONLY to verified account email and masks in response', async () => {
      const sendRes = await authService.sendMfaEmailOtp({
        mfaToken,
        ipAddress: '127.0.0.1',
      });

      assert.ok(sendRes.maskedEmail, 'Masked email must be returned');
      assert.strictEqual(sendRes.maskedEmail, 's****t@uap.edu', 'Email must be masked (s****t@uap.edu)');
      assert.strictEqual(sendRes.expiresIn, 300, 'Expires in 300 seconds (5m)');
      assert.strictEqual(sendRes.resendCooldown, 60, '60s resend cooldown');
      assert.strictEqual(sendRes.code, undefined, 'Raw code must NEVER be returned in API response');

      // Verify email was sent
      const sentEmails = emailService.getSentEmails();
      assert.strictEqual(sentEmails.length, 1);
      assert.strictEqual(sentEmails[0].to, studentUser.email);
      assert.ok(sentEmails[0].subject.includes('Verification Code'));
      // Email body must contain a 6-digit code
      const match = sentEmails[0].text.match(/\b\d{6}\b/);
      assert.ok(match, 'Email text must contain the 6-digit code');
      const sentCode = match[0];

      // Verify MongoDB stores ONLY the HMAC hash of the code, not plaintext
      const decoded = verifyMfaChallengeToken(mfaToken);
      const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);
      const challengeDoc = await MfaChallenge.findOne({ challengeHash });
      assert.ok(challengeDoc, 'Challenge doc must be found by challengeHash');
      assert.ok(challengeDoc.emailOtpHash, 'emailOtpHash must be persisted');
      assert.notStrictEqual(challengeDoc.emailOtpHash, sentCode, 'Raw OTP code must NOT be stored in MongoDB');
      assert.strictEqual(challengeDoc.emailOtpHash.length, 64, 'HMAC-SHA256 must be 64 hex characters');
      assert.strictEqual(challengeDoc.code, undefined);
      assert.strictEqual(challengeDoc.emailOtp, undefined);
    });

    it('2.3 Successfully verifies valid 6-digit Email OTP and establishes full session', async () => {
      await authService.sendMfaEmailOtp({ mfaToken });
      const sentEmails = emailService.getSentEmails();
      const code = sentEmails[0].text.match(/\b\d{6}\b/)[0];

      const verifyRes = await authService.verifyMfaEmailOtp({
        mfaToken,
        code,
        ipAddress: '127.0.0.1',
      });

      assert.ok(verifyRes.accessToken, 'Access token must be issued');
      assert.ok(verifyRes.refreshToken, 'Refresh token must be issued');
      assert.strictEqual(verifyRes.user.email, studentUser.email);
      assert.strictEqual(verifyRes.user.role, 'student');

      // Verify session was created
      const sessions = await Session.find({ userId: studentUser._id });
      assert.ok(sessions.length > 0, 'Active Session document must be created');

      // Verify challenge document is consumed and emailOtpHash cleared
      const decoded = verifyMfaChallengeToken(mfaToken);
      const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);
      const challengeDoc = await MfaChallenge.findOne({ challengeHash });
      assert.strictEqual(challengeDoc.consumed, true, 'Challenge must be marked consumed');
      assert.strictEqual(challengeDoc.emailOtpHash, null, 'emailOtpHash must be purged on consumption');

      // Verify access token can access protected route
      const req = { headers: { authorization: `Bearer ${verifyRes.accessToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true, 'Issued access token must pass auth middleware');
    });
  });

  // =========================================================================
  // 3. Invalid, Expired, Reused, and Rate-Limited Codes
  // =========================================================================
  describe('3. Security Guards: Invalid, Expired, Reused, and Rate-Limited Codes', () => {
    let mfaToken;

    beforeEach(async () => {
      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      studentUser.mfaEnabled = true;
      await studentUser.save();

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      mfaToken = loginRes.mfaToken;
      emailService.clearSentEmails();
    });

    it('3.1 Rejects invalid 6-digit code with 401 and tracks failed attempts', async () => {
      await authService.sendMfaEmailOtp({ mfaToken });

      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({
            mfaToken,
            code: '000000',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /invalid verification code/i);
          return true;
        }
      );

      const decoded = verifyMfaChallengeToken(mfaToken);
      const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);
      const challengeDoc = await MfaChallenge.findOne({ challengeHash });
      assert.strictEqual(challengeDoc.attempts, 1);
      assert.strictEqual(challengeDoc.emailOtpAttempts, 1);
    });

    it('3.2 Rejects expired Email OTP (> 5 minutes) with 401', async () => {
      await authService.sendMfaEmailOtp({ mfaToken });
      const sentEmails = emailService.getSentEmails();
      const code = sentEmails[0].text.match(/\b\d{6}\b/)[0];

      // Artificially expire the code
      const decoded = verifyMfaChallengeToken(mfaToken);
      const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);
      await MfaChallenge.updateOne(
        { challengeHash },
        { $set: { emailOtpExpiresAt: new Date(Date.now() - 1000) } }
      );

      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({
            mfaToken,
            code,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /expired/i);
          return true;
        }
      );
    });

    it('3.3 Rejects reused / replayed Email OTP', async () => {
      await authService.sendMfaEmailOtp({ mfaToken });
      const sentEmails = emailService.getSentEmails();
      const code = sentEmails[0].text.match(/\b\d{6}\b/)[0];

      // First verification succeeds
      await authService.verifyMfaEmailOtp({ mfaToken, code });

      // Second verification attempt with same token and code must be rejected
      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({ mfaToken, code });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /already been used/i);
          return true;
        }
      );
    });

    it('3.4 Invalidates previous code when a new code is issued', async () => {
      const decoded = verifyMfaChallengeToken(mfaToken);
      const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);

      // First send
      await authService.sendMfaEmailOtp({ mfaToken });
      const code1 = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];

      // Artificially bypass cooldown for testing resend
      await MfaChallenge.updateOne(
        { challengeHash },
        { $set: { emailOtpSentAt: new Date(Date.now() - 70000) } }
      );

      // Second send
      await authService.sendMfaEmailOtp({ mfaToken });
      const code2 = emailService.getSentEmails()[1].text.match(/\b\d{6}\b/)[0];

      // code1 must now fail
      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({ mfaToken, code: code1 });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /invalid verification code/i);
          return true;
        }
      );

      // code2 must succeed
      const verifyRes = await authService.verifyMfaEmailOtp({ mfaToken, code: code2 });
      assert.ok(verifyRes.accessToken);
    });

    it('3.5 Enforces 60-second cooldown rate limit on resends with HTTP 429', async () => {
      await authService.sendMfaEmailOtp({ mfaToken });

      // Immediate second request within 60s must fail with 429
      await assert.rejects(
        async () => {
          await authService.sendMfaEmailOtp({ mfaToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 429);
          assert.match(err.message, /wait \d+ seconds/i);
          return true;
        }
      );
    });

    it('3.6 Enforces maximum resend limit (3 resends) with HTTP 429', async () => {
      const decoded = verifyMfaChallengeToken(mfaToken);
      const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);

      await authService.sendMfaEmailOtp({ mfaToken });

      // Simulate 2 resends past cooldown
      for (let i = 0; i < 2; i++) {
        await MfaChallenge.updateOne(
          { challengeHash },
          { $set: { emailOtpSentAt: new Date(Date.now() - 70000) } }
        );
        await authService.sendMfaEmailOtp({ mfaToken });
      }

      // Now at 3 total sends (resendCount = 3)
      await MfaChallenge.updateOne(
        { challengeHash },
        { $set: { emailOtpSentAt: new Date(Date.now() - 70000) } }
      );

      // 4th send attempt must be rejected by abuse protection
      await assert.rejects(
        async () => {
          await authService.sendMfaEmailOtp({ mfaToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 429);
          assert.match(err.message, /maximum email verification code requests exceeded/i);
          return true;
        }
      );
    });

    it('3.7 Locks challenge after 5 failed verification attempts', async () => {
      await authService.sendMfaEmailOtp({ mfaToken });

      for (let i = 0; i < 4; i++) {
        await assert.rejects(
          async () => {
            await authService.verifyMfaEmailOtp({ mfaToken, code: '000000' });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 401);
            return true;
          }
        );
      }

      // 5th attempt locks challenge
      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({ mfaToken, code: '000000' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /maximum mfa verification attempts exceeded/i);
          return true;
        }
      );

      // Subsequent attempt is permanently blocked
      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({ mfaToken, code: '123456' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. Email Delivery Failure Handling
  // =========================================================================
  describe('4. Email Delivery Failure Handling', () => {
    let mfaToken;

    beforeEach(async () => {
      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      studentUser.mfaEnabled = true;
      await studentUser.save();

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      mfaToken = loginRes.mfaToken;
    });

    it('4.1 Safely handles email transport failure without crashing or corrupting challenge', async () => {
      // Mock emailService.sendMfaEmailOtp to throw an error simulating SMTP failure
      const originalSend = emailService.sendMfaEmailOtp;
      emailService.sendMfaEmailOtp = async () => {
        throw new Error('SMTP Connection Timeout (ETIMEDOUT)');
      };

      try {
        await assert.rejects(
          async () => {
            await authService.sendMfaEmailOtp({ mfaToken });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 500);
            assert.match(err.message, /failed to deliver verification email/i);
            // Must NOT leak credentials or raw stack trace
            assert.ok(!err.message.includes('password'));
            return true;
          }
        );

        // Challenge emailOtpHash should be rolled back to null
        const decoded = verifyMfaChallengeToken(mfaToken);
        const challengeHash = mfaUtil.hashMfaChallenge(decoded.jti);
        const challenge = await MfaChallenge.findOne({ challengeHash });
        assert.strictEqual(challenge.emailOtpHash, null, 'Hash must be rolled back on transport error');
      } finally {
        emailService.sendMfaEmailOtp = originalSend;
      }
    });
  });

  // =========================================================================
  // 5. Password Success Without MFA Completion & Cross-Account Isolation
  // =========================================================================
  describe('5. Password Success Without MFA & Cross-Account Isolation', () => {
    it('5.1 Password verification alone does NOT establish an authenticated session or issue cookies', async () => {
      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });

      assert.strictEqual(loginRes.mfaRequired, true);
      assert.strictEqual(loginRes.accessToken, undefined);
      assert.strictEqual(loginRes.refreshToken, undefined);

      // Challenge token cannot pass auth middleware
      const req = { headers: { authorization: `Bearer ${loginRes.mfaToken}` } };
      const res = mockResponse();
      let nextCalled = false;
      await authenticate(req, res, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
    });

    it('5.2 User B cannot access or verify User A challenge token', async () => {
      const userAChallenge = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });

      // Attacker creates a challenge token signed with User B subject but targeting User A challengeId
      const fakeToken = generateMfaChallengeToken({
        userId: instructorUser._id.toString(),
        challengeId: crypto.randomUUID(),
      });

      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({
            mfaToken: fakeToken,
            code: '123456',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          assert.match(err.message, /invalid mfa challenge/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. Institutional Security Policy Enforcement
  // =========================================================================
  describe('6. Institutional Security Policy Enforcement', () => {
    let mfaToken;

    beforeEach(async () => {
      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      studentUser.mfaEnabled = true;
      await studentUser.save();

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      mfaToken = loginRes.mfaToken;
    });

    it('6.1 When institutional policy disables Email OTP, login response excludes email_otp', async () => {
      // Admin disables email OTP in institutional settings
      await SystemSetting.findOneAndUpdate(
        {},
        { $set: { mfaEmailOtpEnabled: false } }
      );

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });

      assert.strictEqual(loginRes.mfaRequired, true);
      assert.ok(!loginRes.allowedMethods.includes('email_otp'), 'email_otp must NOT be in allowedMethods when disabled by policy');
      assert.ok(loginRes.allowedMethods.includes('totp'));
      assert.ok(loginRes.allowedMethods.includes('recovery_code'));
    });

    it('6.2 When institutional policy disables Email OTP, sendMfaEmailOtp rejects with 403 Forbidden', async () => {
      await SystemSetting.findOneAndUpdate(
        {},
        { $set: { mfaEmailOtpEnabled: false } }
      );

      await assert.rejects(
        async () => {
          await authService.sendMfaEmailOtp({ mfaToken });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /not authorized by institutional security policy/i);
          return true;
        }
      );
    });

    it('6.3 When institutional policy disables Email OTP, verifyMfaEmailOtp rejects with 403 Forbidden', async () => {
      await SystemSetting.findOneAndUpdate(
        {},
        { $set: { mfaEmailOtpEnabled: false } }
      );

      await assert.rejects(
        async () => {
          await authService.verifyMfaEmailOtp({ mfaToken, code: '123456' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /not authorized by institutional security policy/i);
          return true;
        }
      );
    });

    it('6.4 Preserves mandatory student MFA policy: students cannot disable MFA', async () => {
      await assert.rejects(
        async () => {
          await authService.disableMfa({
            userId: studentUser._id,
            password: 'Student@123',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /mandatory for student accounts/i);
          return true;
        }
      );
    });

    it('6.5 Preserves instructor/admin self-service policy: instructor can disable MFA with valid credentials', async () => {
      const secret = mfaUtil.generateTotpSecret();
      instructorUser.mfaSecret = mfaUtil.encryptSecret(secret);
      instructorUser.mfaEnabled = true;
      instructorUser.mfaRecoveryCodes = [];
      await instructorUser.save();

      const result = await authService.disableMfa({
        userId: instructorUser._id,
        password: 'Instructor@123',
      });

      assert.ok(result.message.includes('disabled successfully'));
      const updated = await User.findById(instructorUser._id);
      assert.strictEqual(updated.mfaEnabled, false);
    });
  });

  // =========================================================================
  // 7. Session, Refresh, Logout, and RBAC Regression
  // =========================================================================
  describe('7. Session, Refresh, Logout, and RBAC Regression', () => {
    it('7.1 Authenticated session via Email OTP can rotate refresh token successfully', async () => {
      // Re-enable email OTP
      await SystemSetting.findOneAndUpdate({}, { $set: { mfaEmailOtpEnabled: true } });

      const secret = mfaUtil.generateTotpSecret();
      studentUser.mfaSecret = mfaUtil.encryptSecret(secret);
      studentUser.mfaEnabled = true;
      await studentUser.save();

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      await authService.sendMfaEmailOtp({ mfaToken: loginRes.mfaToken });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];

      const verifyRes = await authService.verifyMfaEmailOtp({
        mfaToken: loginRes.mfaToken,
        code,
      });

      // Refresh token rotation
      const refreshRes = await authService.refreshAccessToken({ refreshToken: verifyRes.refreshToken });
      assert.ok(refreshRes.accessToken, 'New access token must be issued on refresh');
      assert.ok(refreshRes.refreshToken, 'Rotated refresh token must be issued');
    });

    it('7.2 RBAC isolation: Student after Email OTP verification is restricted to student endpoints', async () => {
      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });
      await authService.sendMfaEmailOtp({ mfaToken: loginRes.mfaToken });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];

      const verifyRes = await authService.verifyMfaEmailOtp({
        mfaToken: loginRes.mfaToken,
        code,
      });

      // Student has student role
      assert.strictEqual(verifyRes.user.role, 'student');
      const decoded = verifyAccessToken(verifyRes.accessToken);
      assert.strictEqual(decoded.role, 'student');
    });

    it('7.3 Single-use recovery code authentication remains functional alongside Email OTP', async () => {
      // Enable MFA with recovery codes
      const setupData = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setupData.secret);
      const confirm = await authService.confirmMfaSetup(studentUser._id, code);
      const recoveryCode = confirm.recoveryCodes[0];

      const loginRes = await authService.login({
        email: studentUser.email,
        password: 'Student@123',
      });

      const recoveryRes = await authService.redeemMfaRecoveryCode({
        mfaToken: loginRes.mfaToken,
        recoveryCode,
      });

      assert.ok(recoveryRes.accessToken, 'Access token must be issued via recovery code');
      assert.strictEqual(recoveryRes.user.email, studentUser.email);
    });
  });
});
