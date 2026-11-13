const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog, SystemSetting, Session } = require('../src/models');
const authService = require('../src/services/auth.service');
const authController = require('../src/controllers/auth.controller');
const emailService = require('../src/services/email.service');
const { hashPassword } = require('../src/utils/password');
const mfaUtil = require('../src/utils/mfa');

const mockResponse = () => {
  const headers = {};
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
    setHeader(key, val) {
      headers[key.toLowerCase()] = val;
    },
    getHeader(key) {
      return headers[key.toLowerCase()] || null;
    },
  };
  return res;
};

describe('UAP Authenticator App QR-Code Enrollment & TOTP Verification Suite', () => {
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

  beforeEach(async () => {
    emailService.clearSentEmails();
    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    if (studentUser && instructorUser && adminUser) {
      await MfaChallenge.deleteMany({
        userId: { $in: [studentUser._id, instructorUser._id, adminUser._id] },
      });
      // Reset student user MFA state for pristine test runs
      await User.updateOne(
        { _id: studentUser._id },
        {
          $set: {
            mfaEnabled: false,
            mfaSecret: null,
            mfaPendingSecret: null,
            mfaPendingExpiresAt: null,
            mfaRecoveryCodes: [],
          },
        }
      );
      studentUser = await User.findById(studentUser._id);
    }
    await SystemSetting.findOneAndUpdate(
      {},
      { $set: { mfaEmailOtpEnabled: true, mfaEmailOtpExpiryMinutes: 5, mfaEmailOtpResendCooldownSeconds: 60, mfaEmailOtpMaxResends: 3 } },
      { upsert: true }
    );
  });

  // =========================================================================
  // 1. QR Provisioning Data & Cryptographic Secret Generation
  // =========================================================================
  describe('1. QR Provisioning Data & Secret Generation', () => {
    it('1.1 Generates cryptographically secure Base32 secret, otpauth URI, and QR code Data URL', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);

      assert.ok(setup.secret, 'Must return plaintext secret for manual key fallback');
      assert.ok(setup.secret.length >= 16, 'Secret should have adequate Base32 entropy');
      assert.ok(setup.otpauthUri, 'Must return standard otpauth URI');
      assert.ok(setup.otpauthUri.startsWith('otpauth://totp/'), 'URI scheme must be otpauth://totp/');
      assert.ok(setup.otpauthUri.includes(encodeURIComponent(studentUser.email)), 'URI must include account email');
      assert.ok(setup.otpauthUri.includes(`secret=${setup.secret}`), 'URI must encode the generated secret');
      assert.ok(setup.qrCode, 'Must return scannable QR code');
      assert.ok(setup.qrCode.startsWith('data:image/png;base64,'), 'QR code must be a PNG data URL');
      assert.strictEqual(setup.expiresInMinutes, 10, 'Should declare a 10-minute expiry window');

      // Verify User document state
      const userDoc = await User.findById(studentUser._id);
      assert.strictEqual(userDoc.mfaEnabled, false, 'MFA must NOT be enabled until first code is verified');
      assert.strictEqual(userDoc.mfaSecret, null, 'Active secret must remain null');
      assert.ok(userDoc.mfaPendingSecret, 'Pending secret must be stored');
      assert.notStrictEqual(userDoc.mfaPendingSecret, setup.secret, 'Pending secret must be encrypted, not plaintext');
      assert.ok(userDoc.mfaPendingExpiresAt > new Date(), 'Pending expiry must be in the future');

      // Verify decrypted pending secret matches returned secret
      const decrypted = mfaUtil.decryptSecret(userDoc.mfaPendingSecret);
      assert.strictEqual(decrypted, setup.secret);
    });

    it('1.2 Sanitizes serialized User to never leak mfaSecret, mfaPendingSecret, or mfaPendingExpiresAt', async () => {
      await authService.initiateMfaSetup(studentUser._id);
      const userDoc = await User.findById(studentUser._id);
      const json = userDoc.toJSON();

      assert.strictEqual(json.mfaSecret, undefined, 'mfaSecret must never appear in JSON serialization');
      assert.strictEqual(json.mfaPendingSecret, undefined, 'mfaPendingSecret must never appear in JSON serialization');
      assert.strictEqual(json.mfaPendingExpiresAt, undefined, 'mfaPendingExpiresAt must never appear in JSON serialization');
      assert.strictEqual(json.mfaRecoveryCodes, undefined, 'mfaRecoveryCodes must never appear in JSON serialization');
    });
  });

  // =========================================================================
  // 2. Valid and Invalid TOTP Enrollment Codes
  // =========================================================================
  describe('2. Valid and Invalid TOTP Enrollment Codes', () => {
    it('2.1 Rejects invalid 6-digit confirmation code and leaves MFA disabled', async () => {
      await authService.initiateMfaSetup(studentUser._id);

      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(studentUser._id, '999999');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /invalid totp verification code/i);
          return true;
        }
      );

      const userDoc = await User.findById(studentUser._id);
      assert.strictEqual(userDoc.mfaEnabled, false, 'MFA must remain disabled after invalid verification attempt');
      assert.strictEqual(userDoc.mfaSecret, null, 'Active secret must remain null');
      assert.ok(userDoc.mfaPendingSecret, 'Pending secret must still be preserved for valid retry');
    });

    it('2.2 Successfully verifies valid TOTP code, promotes secret, and issues recovery codes', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const validCode = mfaUtil.generateTotpCode(setup.secret);

      const confirmRes = await authService.confirmMfaSetup(studentUser._id, validCode);

      assert.strictEqual(confirmRes.mfaEnabled, true);
      assert.ok(Array.isArray(confirmRes.recoveryCodes));
      assert.strictEqual(confirmRes.recoveryCodes.length, 8, 'Must return 8 emergency backup codes');
      assert.ok(confirmRes.accessToken, 'Must return new access token carrying mfa claims');
      assert.ok(confirmRes.refreshToken, 'Must return new refresh token');

      // Check DB persistence
      const userDoc = await User.findById(studentUser._id);
      assert.strictEqual(userDoc.mfaEnabled, true, 'User must now have mfaEnabled = true');
      assert.strictEqual(userDoc.mfaPendingSecret, null, 'mfaPendingSecret must be cleared');
      assert.strictEqual(userDoc.mfaPendingExpiresAt, null, 'mfaPendingExpiresAt must be cleared');
      assert.ok(userDoc.mfaSecret, 'mfaSecret must be populated');
      assert.strictEqual(mfaUtil.decryptSecret(userDoc.mfaSecret), setup.secret);
      assert.ok(userDoc.mfaEnrolledAt instanceof Date);
      assert.strictEqual(userDoc.mfaRecoveryCodes.length, 8);
    });

    it('2.3 Rejects confirmation if no pending setup exists', async () => {
      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(studentUser._id, '123456');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /no pending mfa setup found/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Expired Enrollment Attempts
  // =========================================================================
  describe('3. Expired Enrollment Attempts', () => {
    it('3.1 Rejects confirmation and clears pending setup when enrollment session has expired', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const validCode = mfaUtil.generateTotpCode(setup.secret);

      // Simulate expired enrollment session (set 1 minute in the past)
      await User.updateOne(
        { _id: studentUser._id },
        { $set: { mfaPendingExpiresAt: new Date(Date.now() - 60000) } }
      );

      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(studentUser._id, validCode);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /mfa enrollment session has expired/i);
          return true;
        }
      );

      const userDoc = await User.findById(studentUser._id);
      assert.strictEqual(userDoc.mfaEnabled, false);
      assert.strictEqual(userDoc.mfaPendingSecret, null, 'Expired pending secret must be invalidated');
      assert.strictEqual(userDoc.mfaPendingExpiresAt, null);
    });
  });

  // =========================================================================
  // 4. Repeated Enrollment Requests
  // =========================================================================
  describe('4. Repeated Enrollment Requests', () => {
    it('4.1 Re-initiating setup overwrites previous pending secret; old code fails and newest code succeeds', async () => {
      // First initiation
      const setup1 = await authService.initiateMfaSetup(studentUser._id);
      const code1 = mfaUtil.generateTotpCode(setup1.secret);

      // Second initiation
      const setup2 = await authService.initiateMfaSetup(studentUser._id);
      const code2 = mfaUtil.generateTotpCode(setup2.secret);

      assert.notStrictEqual(setup1.secret, setup2.secret, 'Each setup request must generate a fresh secret');

      // Submitting code from first setup must fail
      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(studentUser._id, code1);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /invalid totp verification code/i);
          return true;
        }
      );

      // Submitting code from newest setup must succeed
      const confirmRes = await authService.confirmMfaSetup(studentUser._id, code2);
      assert.strictEqual(confirmRes.mfaEnabled, true);

      const userDoc = await User.findById(studentUser._id);
      assert.strictEqual(mfaUtil.decryptSecret(userDoc.mfaSecret), setup2.secret);
    });
  });

  // =========================================================================
  // 5. Login Challenges for Enrolled and Unenrolled Accounts
  // =========================================================================
  describe('5. Login Challenges: Enrolled vs Unenrolled Accounts', () => {
    it('5.1 Unenrolled account logs in directly with single-factor credentials', async () => {
      await User.updateOne(
        { _id: studentUser._id },
        { $set: { mfaEnabled: false, mfaSecret: null } }
      );

      const result = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      assert.ok(result.accessToken, 'Single factor login returns access token');
      assert.strictEqual(result.mfaRequired, undefined);
    });

    it('5.2 Enrolled account requires MFA challenge; does NOT issue tokens immediately', async () => {
      // Enroll account
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      await authService.confirmMfaSetup(studentUser._id, code);

      const result = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      assert.strictEqual(result.mfaRequired, true);
      assert.ok(result.mfaToken);
      assert.strictEqual(result.accessToken, undefined, 'Access token must NOT be issued before MFA verification');
      assert.strictEqual(result.refreshToken, undefined, 'Refresh token must NOT be issued before MFA verification');
      assert.ok(result.allowedMethods.includes('totp'));

      // Complete login verification using current TOTP code
      const currentCode = mfaUtil.generateTotpCode(setup.secret);
      const verifyRes = await authService.verifyMfaChallenge({
        mfaToken: result.mfaToken,
        code: currentCode,
      });

      assert.ok(verifyRes.accessToken, 'Issued access token upon successful verification');
      assert.ok(verifyRes.refreshToken, 'Issued refresh token upon successful verification');
    });

    it('5.3 Account with mfaEnabled=true but missing mfaSecret is handled securely without silent bypass', async () => {
      // Simulate corrupted/unenrolled state where mfaEnabled is true but secret is absent
      await User.updateOne(
        { _id: studentUser._id },
        { $set: { mfaEnabled: true, mfaSecret: null } }
      );

      await assert.rejects(
        async () => {
          await authService.login({
            email: 'student@uap.edu',
            password: 'Student@123',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403, 'Must reject with 403 Forbidden');
          assert.match(err.message, /mfa is required for this account, but no active authenticator has been enrolled/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. Controller Cookies, Session Refresh & RBAC Protections
  // =========================================================================
  describe('6. Controller Cookies, Session Refresh & Authorization', () => {
    it('6.1 authController.mfaSetupConfirm sets secure refresh and CSRF cookies upon confirmation', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);

      const req = {
        user: { _id: studentUser._id },
        body: { code },
      };
      const res = mockResponse();

      await authController.mfaSetupConfirm(req, res, () => {});

      assert.strictEqual(res.statusCode, 200);
      const cookieHeader = res.getHeader('Set-Cookie');
      assert.ok(cookieHeader, 'Must set Set-Cookie header');
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
      assert.ok(cookieStr.includes('uap_refresh='), 'Must set uap_refresh cookie');
      assert.ok(cookieStr.includes('HttpOnly'), 'uap_refresh must be HttpOnly');
      assert.ok(cookieStr.includes('uap_csrf='), 'Must set CSRF cookie');
    });

    it('6.2 Unauthorized/cross-user protection: setup and confirm require authenticated user context', async () => {
      // Missing user context should fail
      const req = { user: null, body: { code: '123456' } };
      const res = mockResponse();
      let capturedError;

      await authController.mfaSetup(req, res, (err) => {
        capturedError = err;
      });
      assert.ok(capturedError, 'Missing user context must produce error');
    });
  });

  // =========================================================================
  // 7. Email OTP and Recovery Code Regression
  // =========================================================================
  describe('7. Email OTP and Recovery Code Regression', () => {
    it('7.1 Enrolled account can verify via Email OTP alternative', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      await authService.confirmMfaSetup(studentUser._id, code);

      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      // Request email OTP
      const emailRes = await authService.sendMfaEmailOtp({ mfaToken: loginRes.mfaToken });
      assert.ok(emailRes.maskedEmail);

      const sentEmails = emailService.getSentEmails();
      assert.strictEqual(sentEmails.length, 1);
      const match = sentEmails[0].text.match(/verification code is:\s*(\d{6})/i) || sentEmails[0].html.match(/(\d{6})/);
      assert.ok(match, 'Verification code must be present in email');
      const emailOtpCode = match[1];

      // Verify email OTP
      const verifyRes = await authService.verifyMfaEmailOtp({
        mfaToken: loginRes.mfaToken,
        code: emailOtpCode,
      });

      assert.ok(verifyRes.accessToken);
    });

    it('7.2 Enrolled account can verify via single-use backup recovery code', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      const confirmRes = await authService.confirmMfaSetup(studentUser._id, code);
      const backupCode = confirmRes.recoveryCodes[0];

      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });

      const recoveryRes = await authService.redeemMfaRecoveryCode({
        mfaToken: loginRes.mfaToken,
        recoveryCode: backupCode,
      });

      assert.ok(recoveryRes.accessToken);
    });
  });
});
