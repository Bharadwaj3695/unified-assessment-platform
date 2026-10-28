const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, MfaChallenge, AuditLog, SystemSetting, Session } = require('../src/models');
const authService = require('../src/services/auth.service');
const emailService = require('../src/services/email.service');
const authController = require('../src/controllers/auth.controller');
const { hashPassword } = require('../src/utils/password');
const { generateAccessToken, verifyAccessToken, verifyMfaChallengeToken } = require('../src/utils/jwt');
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

describe('MFA Settings: Authenticator TOTP & Independent Optional Email OTP Suite', () => {
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
      // Reset MFA preferences
      await User.updateMany(
        { _id: { $in: [studentUser._id, instructorUser._id, adminUser._id] } },
        {
          $set: {
            mfaEnabled: false,
            mfaSecret: null,
            mfaPendingSecret: null,
            mfaPendingExpiresAt: null,
            mfaRecoveryCodes: [],
            emailOtpEnabled: false,
            emailOtpEnrolledAt: null,
            emailOtpPendingHash: null,
            emailOtpPendingExpiresAt: null,
            emailOtpPendingSentAt: null,
            emailOtpPendingAttempts: 0,
            emailOtpPendingResendCount: 0,
          },
        }
      );
    }
    // Ensure system setting allows email OTP
    await SystemSetting.findOneAndUpdate(
      {},
      { $set: { mfaEmailOtpEnabled: true, mfaEmailOtpExpiryMinutes: 5, mfaEmailOtpResendCooldownSeconds: 60, mfaEmailOtpMaxResends: 3 } },
      { upsert: true }
    );
  });

  // =========================================================================
  // 1. TOTP Enrollment, Verification, Enablement & Disablement
  // =========================================================================
  describe('1. TOTP Enrollment, Verification, Enablement & Disablement', () => {
    it('1.1 Initiates TOTP setup and encrypts pending secret at rest', async () => {
      const setup = await authService.initiateMfaSetup(instructorUser._id);
      assert.ok(setup.secret, 'Base32 secret must be returned');
      assert.ok(setup.qrCode, 'QR code must be returned');
      assert.ok(setup.otpauthUri, 'otpauthUri must be returned');

      const dbUser = await User.findById(instructorUser._id);
      assert.ok(dbUser.mfaPendingSecret, 'Encrypted secret must be saved in database');
      assert.notStrictEqual(dbUser.mfaPendingSecret, setup.secret, 'Secret must NOT be plaintext in MongoDB');
      assert.strictEqual(mfaUtil.decryptSecret(dbUser.mfaPendingSecret), setup.secret);
      assert.strictEqual(dbUser.mfaEnabled, false, 'MFA must remain disabled before confirmation');
    });

    it('1.2 Rejects invalid verification code during TOTP confirmation', async () => {
      await authService.initiateMfaSetup(instructorUser._id);
      await assert.rejects(
        async () => {
          await authService.confirmMfaSetup(instructorUser._id, '999999');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /invalid.*code/i);
          return true;
        }
      );

      const dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.mfaEnabled, false);
    });

    it('1.3 Confirms TOTP enrollment with genuine code and provides recovery codes', async () => {
      const setup = await authService.initiateMfaSetup(instructorUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);

      const confirm = await authService.confirmMfaSetup(instructorUser._id, code);
      assert.strictEqual(confirm.mfaEnabled, true);
      assert.ok(Array.isArray(confirm.recoveryCodes));
      assert.strictEqual(confirm.recoveryCodes.length, 8);

      const dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.mfaEnabled, true);
      assert.strictEqual(dbUser.mfaPendingSecret, null);
      assert.ok(dbUser.mfaSecret);
      assert.strictEqual(dbUser.mfaRecoveryCodes.length, 8);
    });

    it('1.4 Disables TOTP MFA with password confirmation on instructor account', async () => {
      const setup = await authService.initiateMfaSetup(instructorUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      await authService.confirmMfaSetup(instructorUser._id, code);

      // Rejects without password
      await assert.rejects(
        async () => {
          await authService.disableMfa({ userId: instructorUser._id, password: '' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );

      // Rejects with wrong password
      await assert.rejects(
        async () => {
          await authService.disableMfa({ userId: instructorUser._id, password: 'WrongPassword!' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );

      // Successfully disables with correct password
      const result = await authService.disableMfa({ userId: instructorUser._id, password: 'Instructor@123' });
      assert.match(result.message, /disabled successfully/i);

      const dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.mfaEnabled, false);
      assert.strictEqual(dbUser.mfaSecret, null);
    });

    it('1.5 Student mandatory policy: student cannot disable TOTP MFA', async () => {
      const setup = await authService.initiateMfaSetup(studentUser._id);
      const code = mfaUtil.generateTotpCode(setup.secret);
      await authService.confirmMfaSetup(studentUser._id, code);

      await assert.rejects(
        async () => {
          await authService.disableMfa({ userId: studentUser._id, password: 'Student@123' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /mandatory for student accounts/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 2. Email OTP Setup & Independent Enrollment Flow
  // =========================================================================
  describe('2. Email OTP Setup & Independent Enrollment Flow', () => {
    it('2.1 Rejects Email OTP setup initiation if password re-verification fails', async () => {
      await assert.rejects(
        async () => {
          await authService.initiateEmailOtpSetup(studentUser._id, { password: '' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /password is required/i);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await authService.initiateEmailOtpSetup(studentUser._id, { password: 'WrongPassword!' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /invalid account password/i);
          return true;
        }
      );
    });

    it('2.2 Successfully initiates Email OTP setup, hashes verifier, and dispatches code to registered email', async () => {
      const res = await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      assert.ok(res.message);
      assert.ok(res.maskedEmail);
      assert.strictEqual(res.resendCooldown, 60);

      // Verify email was sent to student email
      const sent = emailService.getSentEmails();
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, studentUser.email);
      assert.ok(sent[0].subject.includes('Verification Code'));
      const codeMatch = sent[0].text.match(/\b\d{6}\b/);
      assert.ok(codeMatch);
      const code = codeMatch[0];

      // Verify MongoDB stores ONLY the hash of the OTP
      const dbUser = await User.findById(studentUser._id);
      assert.ok(dbUser.emailOtpPendingHash);
      assert.notStrictEqual(dbUser.emailOtpPendingHash, code);
      assert.strictEqual(dbUser.emailOtpPendingHash.length, 64);
      assert.strictEqual(dbUser.emailOtpEnabled, false, 'Email OTP must remain disabled before confirmation');
    });

    it('2.3 Rejects invalid code on Email OTP confirmation and tracks failed attempts', async () => {
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });

      await assert.rejects(
        async () => {
          await authService.confirmEmailOtpSetup(studentUser._id, '000000');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /invalid verification code/i);
          return true;
        }
      );

      const dbUser = await User.findById(studentUser._id);
      assert.strictEqual(dbUser.emailOtpPendingAttempts, 1);
      assert.strictEqual(dbUser.emailOtpEnabled, false);
    });

    it('2.4 Locks setup session after 5 failed confirmation attempts', async () => {
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });

      for (let i = 0; i < 4; i++) {
        await assert.rejects(async () => {
          await authService.confirmEmailOtpSetup(studentUser._id, '111111');
        });
      }

      // 5th attempt locks setup
      await assert.rejects(
        async () => {
          await authService.confirmEmailOtpSetup(studentUser._id, '111111');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /maximum verification attempts exceeded/i);
          return true;
        }
      );

      const dbUser = await User.findById(studentUser._id);
      assert.strictEqual(dbUser.emailOtpPendingHash, null);
    });

    it('2.5 Rejects expired setup code (> 5 minutes)', async () => {
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];

      // Expire setup
      await User.updateOne(
        { _id: studentUser._id },
        { $set: { emailOtpPendingExpiresAt: new Date(Date.now() - 1000) } }
      );

      await assert.rejects(
        async () => {
          await authService.confirmEmailOtpSetup(studentUser._id, code);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /expired/i);
          return true;
        }
      );
    });

    it('2.6 Successfully confirms Email OTP setup with valid code and enables feature', async () => {
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];

      const res = await authService.confirmEmailOtpSetup(studentUser._id, code);
      assert.strictEqual(res.emailOtpEnabled, true);
      assert.match(res.message, /enabled successfully/i);

      const dbUser = await User.findById(studentUser._id);
      assert.strictEqual(dbUser.emailOtpEnabled, true);
      assert.ok(dbUser.emailOtpEnrolledAt);
      assert.strictEqual(dbUser.emailOtpPendingHash, null);
      assert.strictEqual(dbUser.mfaEnabled, false, 'TOTP must remain independent and disabled');
    });
  });

  // =========================================================================
  // 3. Independent Configuration of TOTP and Email OTP
  // =========================================================================
  describe('3. Independent Configuration of TOTP and Email OTP', () => {
    it('3.1 Enabling Email OTP does NOT enable TOTP', async () => {
      await authService.initiateEmailOtpSetup(instructorUser._id, { password: 'Instructor@123' });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(instructorUser._id, code);

      const dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.emailOtpEnabled, true);
      assert.strictEqual(dbUser.mfaEnabled, false);
      assert.strictEqual(dbUser.mfaSecret, null);
    });

    it('3.2 Disabling Email OTP leaves TOTP enabled', async () => {
      // Enable TOTP
      const totpSetup = await authService.initiateMfaSetup(instructorUser._id);
      const totpCode = mfaUtil.generateTotpCode(totpSetup.secret);
      await authService.confirmMfaSetup(instructorUser._id, totpCode);

      // Enable Email OTP
      await authService.initiateEmailOtpSetup(instructorUser._id, { password: 'Instructor@123' });
      const emailCode = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(instructorUser._id, emailCode);

      let dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.mfaEnabled, true);
      assert.strictEqual(dbUser.emailOtpEnabled, true);

      // Disable Email OTP
      await authService.disableEmailOtp({ userId: instructorUser._id, password: 'Instructor@123' });

      dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.emailOtpEnabled, false);
      assert.strictEqual(dbUser.mfaEnabled, true, 'TOTP must still be enabled');
      assert.ok(dbUser.mfaSecret, 'TOTP secret must still exist');
    });

    it('3.3 Disabling TOTP leaves Email OTP enabled', async () => {
      // Enable TOTP
      const totpSetup = await authService.initiateMfaSetup(instructorUser._id);
      const totpCode = mfaUtil.generateTotpCode(totpSetup.secret);
      await authService.confirmMfaSetup(instructorUser._id, totpCode);

      // Enable Email OTP
      await authService.initiateEmailOtpSetup(instructorUser._id, { password: 'Instructor@123' });
      const emailCode = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(instructorUser._id, emailCode);

      // Disable TOTP
      await authService.disableMfa({ userId: instructorUser._id, password: 'Instructor@123' });

      const dbUser = await User.findById(instructorUser._id);
      assert.strictEqual(dbUser.mfaEnabled, false);
      assert.strictEqual(dbUser.emailOtpEnabled, true, 'Email OTP must remain enabled');
    });

    it('3.4 User with ONLY Email OTP enabled gets email_otp in allowedMethods during sign-in', async () => {
      await authService.initiateEmailOtpSetup(instructorUser._id, { password: 'Instructor@123' });
      const emailCode = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(instructorUser._id, emailCode);
      emailService.clearSentEmails();

      const loginRes = await authService.login({
        email: instructorUser.email,
        password: 'Instructor@123',
      });

      assert.strictEqual(loginRes.mfaRequired, true);
      assert.strictEqual(loginRes.defaultMethod, 'email_otp');
      assert.ok(loginRes.allowedMethods.includes('email_otp'));
      assert.strictEqual(loginRes.allowedMethods.includes('totp'), false);
      assert.strictEqual(loginRes.emailOtpSent, true, 'Email OTP was dispatched automatically during login');

      // Verify email was sent with 6-digit code
      const sent = emailService.getSentEmails();
      assert.strictEqual(sent.length, 1);
      const loginOtp = sent[0].text.match(/\b\d{6}\b/)[0];

      // Verifying login with code succeeds
      const verifyRes = await authService.verifyMfaEmailOtp({
        mfaToken: loginRes.mfaToken,
        code: loginOtp,
      });
      assert.ok(verifyRes.accessToken);
      assert.strictEqual(verifyRes.user.email, instructorUser.email);
    });

    it('3.5 User with BOTH TOTP and Email OTP enabled can verify using either method', async () => {
      // Enable TOTP
      const totpSetup = await authService.initiateMfaSetup(instructorUser._id);
      const totpCode = mfaUtil.generateTotpCode(totpSetup.secret);
      await authService.confirmMfaSetup(instructorUser._id, totpCode);

      // Enable Email OTP
      await authService.initiateEmailOtpSetup(instructorUser._id, { password: 'Instructor@123' });
      const emailCode = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(instructorUser._id, emailCode);
      emailService.clearSentEmails();

      // Login 1: verify using TOTP
      const login1 = await authService.login({ email: instructorUser.email, password: 'Instructor@123' });
      assert.ok(login1.allowedMethods.includes('totp'));
      assert.ok(login1.allowedMethods.includes('email_otp'));
      const activeTotp = mfaUtil.generateTotpCode(totpSetup.secret);
      const verify1 = await authService.verifyMfaChallenge({ mfaToken: login1.mfaToken, code: activeTotp });
      assert.ok(verify1.accessToken);

      // Login 2: verify using Email OTP
      emailService.clearSentEmails();
      const login2 = await authService.login({ email: instructorUser.email, password: 'Instructor@123' });
      const sent = emailService.getSentEmails();
      assert.strictEqual(sent.length, 1);
      const loginOtp = sent[0].text.match(/\b\d{6}\b/)[0];
      const verify2 = await authService.verifyMfaEmailOtp({ mfaToken: login2.mfaToken, code: loginOtp });
      assert.ok(verify2.accessToken);
    });
  });

  // =========================================================================
  // 4. Send Test Code Feature & Cooldown Limits
  // =========================================================================
  describe('4. Send Test Code Feature & Cooldown Limits', () => {
    it('4.1 Dispatches test verification code when Email OTP is enabled', async () => {
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(studentUser._id, code);
      emailService.clearSentEmails();

      const testRes = await authService.sendEmailOtpTest({ userId: studentUser._id });
      assert.ok(testRes.message.includes('successfully'));
      assert.strictEqual(testRes.maskedEmail, 's****t@uap.edu');

      const sent = emailService.getSentEmails();
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, studentUser.email);
    });

    it('4.2 Rejects test code dispatch when Email OTP is disabled', async () => {
      await assert.rejects(
        async () => {
          await authService.sendEmailOtpTest({ userId: instructorUser._id });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /must be enabled/i);
          return true;
        }
      );
    });

    it('4.3 Enforces 60-second cooldown rate limit on test code dispatches', async () => {
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(studentUser._id, code);

      await authService.sendEmailOtpTest({ userId: studentUser._id });

      // Immediate second test request must fail with 429
      await assert.rejects(
        async () => {
          await authService.sendEmailOtpTest({ userId: studentUser._id });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 429);
          assert.match(err.message, /wait \d+ seconds/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. Security Guards, Mandatory Policy & Delivery Failures
  // =========================================================================
  describe('5. Security Guards, Mandatory Policy & Delivery Failures', () => {
    it('5.1 Rejects unauthenticated requests to MFA management controller endpoints', async () => {
      const req = { headers: {} };
      const res = mockResponse();

      await authenticate(req, res, () => {});
      assert.strictEqual(res.statusCode, 401);
    });

    it('5.2 Student cannot disable Email OTP when TOTP is disabled (mandatory MFA policy)', async () => {
      // Enable Email OTP for student
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(studentUser._id, code);

      await assert.rejects(
        async () => {
          await authService.disableEmailOtp({ userId: studentUser._id, password: 'Student@123' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /mandatory for student accounts/i);
          return true;
        }
      );
    });

    it('5.3 Student can disable Email OTP IF TOTP Authenticator is enabled', async () => {
      // Enable TOTP for student
      const totpSetup = await authService.initiateMfaSetup(studentUser._id);
      const totpCode = mfaUtil.generateTotpCode(totpSetup.secret);
      await authService.confirmMfaSetup(studentUser._id, totpCode);

      // Enable Email OTP for student
      await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
      const emailCode = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      await authService.confirmEmailOtpSetup(studentUser._id, emailCode);

      // Student disabling Email OTP succeeds because TOTP remains active
      const res = await authService.disableEmailOtp({ userId: studentUser._id, password: 'Student@123' });
      assert.match(res.message, /disabled successfully/i);

      const dbUser = await User.findById(studentUser._id);
      assert.strictEqual(dbUser.emailOtpEnabled, false);
      assert.strictEqual(dbUser.mfaEnabled, true);
    });

    it('5.4 Safely handles mail service delivery failure without corrupting state', async () => {
      // Simulate mail transport failure
      const originalSend = emailService.sendMail.bind(emailService);
      emailService.sendMail = async () => ({ success: false, error: 'SMTP connection timeout' });

      try {
        await assert.rejects(
          async () => {
            await authService.initiateEmailOtpSetup(studentUser._id, { password: 'Student@123' });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 502);
            assert.match(err.message, /email delivery failed/i);
            return true;
          }
        );

        // Verify pending state was cleanly rolled back
        const dbUser = await User.findById(studentUser._id);
        assert.strictEqual(dbUser.emailOtpPendingHash, null);
      } finally {
        emailService.sendMail = originalSend;
      }
    });

    it('5.5 Controller endpoints return proper HTTP response envelopes', async () => {
      const setupReq = {
        user: instructorUser,
        body: { password: 'Instructor@123' },
      };
      const setupRes = mockResponse();

      await authController.mfaEmailOtpSetup(setupReq, setupRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(setupRes.statusCode, 200);
      assert.ok(setupRes.responseData.data.maskedEmail);

      const code = emailService.getSentEmails()[0].text.match(/\b\d{6}\b/)[0];
      const confirmReq = {
        user: instructorUser,
        body: { code },
      };
      const confirmRes = mockResponse();

      await authController.mfaEmailOtpSetupConfirm(confirmReq, confirmRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(confirmRes.statusCode, 200);
      assert.strictEqual(confirmRes.responseData.data.emailOtpEnabled, true);
    });
  });
});
