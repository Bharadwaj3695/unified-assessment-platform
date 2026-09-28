const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Submission, Notification, AuditLog } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const googleAuthService = require('../src/services/googleAuth.service');
const authService = require('../src/services/auth.service');
const userService = require('../src/services/user.service');
const emailService = require('../src/services/email.service');
const authController = require('../src/controllers/auth.controller');
const userController = require('../src/controllers/user.controller');
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

describe('Phase 4 Verification Suite: Google SSO (OAuth2/OIDC) & Google SMTP Nodemailer Integration', () => {
  let adminUser;
  let instructorUser;
  let studentUser;
  let testPassword;

  before(async () => {
    try {
      await connectDB();
      await seedDatabase();

      testPassword = await hashPassword('Password123!');

      // Clean up any test users from previous runs
      await User.deleteMany({
        $or: [
          {
            email: {
              $in: [
                'google_new_applicant@test.edu',
                'google_instructor@test.edu',
                'google_student@test.edu',
                'google_pending@test.edu',
                'google_revoked@test.edu',
                'google_rejected@test.edu',
                'unallowed_domain@external.com',
                'allowed_domain@permitted.edu',
              ],
            },
          },
          { facultyId: 'FAC-2026-991' },
          { studentId: { $in: ['STU-2026-991', 'STU-2026-992', 'STU-2026-993', 'STU-2026-994'] } },
        ],
      });

      adminUser = await User.findOne({ email: 'admin@uap.edu' });

      instructorUser = await User.create({
        name: 'Dr. Google Link Instructor',
        email: 'google_instructor@test.edu',
        password: testPassword,
        role: 'instructor',
        status: 'active',
        isActive: true,
        facultyId: 'FAC-2026-991',
        department: 'Computer Science',
        subjectId: 'CS-401',
        subjectName: 'Distributed Cloud Systems',
      });

      studentUser = await User.create({
        name: 'Existing Active Student',
        email: 'google_student@test.edu',
        password: testPassword,
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: 'STU-2026-991',
        department: 'Computer Science',
      });
    } catch (err) {
      console.error('[google_sso_smtp_phase4.test.js] BEFORE ERROR:', err);
      throw err;
    }
  });

  afterEach(() => {
    googleAuthService.clearMockVerificationHandler();
    emailService.clearSentEmails();
  });

  after(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'google_new_applicant@test.edu',
          'google_instructor@test.edu',
          'google_student@test.edu',
          'google_pending@test.edu',
          'google_revoked@test.edu',
          'google_rejected@test.edu',
          'unallowed_domain@external.com',
          'allowed_domain@permitted.edu',
        ],
      },
    });
    await disconnectDB();
  });

  // =========================================================================
  // SECTION 1: Google OAuth Authorization URL & CSRF State Token Security
  // =========================================================================
  describe('1. Google OAuth Authorization URL & CSRF State Tokens', () => {
    it('GET / /v1/auth/google/url returns valid authorization URL with client_id, redirect_uri, scope, and signed state', async () => {
      const origClientId = env.GOOGLE_CLIENT_ID;
      try {
        env.GOOGLE_CLIENT_ID = 'mock-google-client-id-12345.apps.googleusercontent.com';
        const req = {};
        const res = mockResponse();
        let nextErr = null;

        await authController.getGoogleAuthUrl(req, res, (err) => {
          nextErr = err;
        });

        assert.strictEqual(nextErr, null, 'getGoogleAuthUrl should not throw');
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.responseData.success);
        assert.ok(res.responseData.data.url, 'Should return OAuth URL');
        assert.ok(res.responseData.data.state, 'Should return state parameter');

        const url = new URL(res.responseData.data.url);
        assert.strictEqual(url.hostname, 'accounts.google.com');
        assert.strictEqual(url.searchParams.get('client_id'), 'mock-google-client-id-12345.apps.googleusercontent.com');
        assert.strictEqual(url.searchParams.get('response_type'), 'code');
        assert.ok(url.searchParams.get('scope').includes('openid'));
        assert.ok(url.searchParams.get('scope').includes('email'));
        assert.ok(url.searchParams.get('scope').includes('profile'));
        assert.strictEqual(url.searchParams.get('state'), res.responseData.data.state);
      } finally {
        env.GOOGLE_CLIENT_ID = origClientId;
      }
    });

    it('CSRF state token: valid freshly generated token passes verification', () => {
      const token = googleAuthService.generateStateToken();
      assert.ok(token);
      assert.strictEqual(token.split('.').length, 3);
      const verified = googleAuthService.verifyStateToken(token);
      assert.strictEqual(verified, true);
    });

    it('CSRF state token: tampered token is rejected with 400 error', () => {
      const token = googleAuthService.generateStateToken();
      const parts = token.split('.');
      // Tamper randomBytes
      const tampered = `tampered123.${parts[1]}.${parts[2]}`;
      assert.throws(
        () => googleAuthService.verifyStateToken(tampered),
        (err) => err.statusCode === 400 && err.message.includes('signature')
      );
    });

    it('CSRF state token: expired token (>15 minutes) is rejected with 400 error', () => {
      const randomBytes = crypto.randomBytes(24).toString('hex');
      const expiredTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      const payload = `${randomBytes}.${expiredTimestamp}`;
      const hmacSecret = env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform';
      const signature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
      const expiredToken = `${payload}.${signature}`;

      assert.throws(
        () => googleAuthService.verifyStateToken(expiredToken),
        (err) => err.statusCode === 400 && err.message.includes('expired')
      );
    });

    it('CSRF state token: malformed or empty token is rejected with 400 error', () => {
      assert.throws(
        () => googleAuthService.verifyStateToken(''),
        (err) => err.statusCode === 400
      );
      assert.throws(
        () => googleAuthService.verifyStateToken('invalid-token-without-parts'),
        (err) => err.statusCode === 400
      );
    });
  });

  // =========================================================================
  // SECTION 2: Google Identity Payload Validation & Claim Verification
  // =========================================================================
  describe('2. Google Identity Payload Validation & Security Verification', () => {
    it('POST /api/v1/auth/google rejects request if neither code nor idToken/credential is provided', async () => {
      const req = { body: {}, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError, 'Should throw error when credentials missing');
      assert.strictEqual(capturedError.statusCode, 400);
      assert.ok(capturedError.message.includes('authorization code or ID token is required'));
    });

    it('POST /api/v1/auth/google rejects request if Google verification throws error', async () => {
      googleAuthService.setMockVerificationHandler(() => {
        const err = new Error('Google ID token verification failed: Token expired');
        err.statusCode = 401;
        throw err;
      });

      const req = { body: { idToken: 'expired-or-invalid-token' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 401);
      assert.ok(capturedError.message.includes('Token expired'));
    });

    it('POST /api/v1/auth/google rejects request if Google payload lacks sub', async () => {
      googleAuthService.setMockVerificationHandler(() => ({
        email: 'nosub@test.edu',
        email_verified: true,
        name: 'No Sub User',
      }));

      const req = { body: { idToken: 'valid-token-no-sub' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 400);
      assert.ok(capturedError.message.includes('missing subject identifier'));
    });

    it('POST /api/v1/auth/google rejects request if Google payload lacks email', async () => {
      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-no-email-12345',
        email_verified: true,
        name: 'No Email User',
      }));

      const req = { body: { idToken: 'valid-token-no-email' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 400);
      assert.ok(capturedError.message.includes('missing email address'));
    });

    it('POST /api/v1/auth/google rejects request if Google payload has email_verified: false', async () => {
      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-unverified-12345',
        email: 'unverified@test.edu',
        email_verified: false,
        name: 'Unverified Email User',
      }));

      const req = { body: { idToken: 'token-unverified-email' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 400);
      assert.ok(capturedError.message.includes('Unverified Google email'));
    });
  });

  // =========================================================================
  // SECTION 3: Institutional Domain Restriction (GOOGLE_ALLOWED_DOMAINS)
  // =========================================================================
  describe('3. Institutional Domain Restriction Enforcements', () => {
    it('rejects email from unpermitted domain when GOOGLE_ALLOWED_DOMAINS is configured (HTTP 403)', async () => {
      const origDomains = env.GOOGLE_ALLOWED_DOMAINS;
      try {
        env.GOOGLE_ALLOWED_DOMAINS = 'test.edu,permitted.edu';
        googleAuthService.setMockVerificationHandler(() => ({
          sub: 'google-sub-unallowed-domain',
          email: 'unallowed_domain@external.com',
          email_verified: true,
          name: 'External User',
        }));

        const req = { body: { idToken: 'token-external-domain' }, ip: '127.0.0.1' };
        const res = mockResponse();
        let capturedError = null;

        await authController.googleLogin(req, res, (err) => {
          capturedError = err;
        });

        assert.ok(capturedError);
        assert.strictEqual(capturedError.statusCode, 403);
        assert.ok(capturedError.message.includes('Institutional access restricted'));
      } finally {
        env.GOOGLE_ALLOWED_DOMAINS = origDomains;
      }
    });

    it('accepts email from permitted domain when GOOGLE_ALLOWED_DOMAINS is configured', async () => {
      const origDomains = env.GOOGLE_ALLOWED_DOMAINS;
      try {
        env.GOOGLE_ALLOWED_DOMAINS = 'test.edu,permitted.edu';
        googleAuthService.setMockVerificationHandler(() => ({
          sub: 'google-sub-allowed-domain-1',
          email: 'allowed_domain@permitted.edu',
          email_verified: true,
          name: 'Permitted Institutional User',
        }));

        const req = { body: { idToken: 'token-permitted-domain' }, ip: '127.0.0.1' };
        const res = mockResponse();
        let capturedError = null;

        await authController.googleLogin(req, res, (err) => {
          capturedError = err;
        });

        assert.strictEqual(capturedError, null);
        assert.strictEqual(res.statusCode, 202, 'Should be accepted as pending student');
        assert.strictEqual(res.responseData.data.status, 'pending');
      } finally {
        env.GOOGLE_ALLOWED_DOMAINS = origDomains;
      }
    });
  });

  // =========================================================================
  // SECTION 4: New Google User Registration & Lifecycle Governance
  // =========================================================================
  describe('4. New Google User Registration, Student Role Defaulting & Pending State', () => {
    it('creates new student user in pending approval status when neither googleId nor email matches', async () => {
      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-new-applicant-9999',
        email: 'google_new_applicant@test.edu',
        email_verified: true,
        name: 'John Google Applicant',
        picture: 'https://lh3.googleusercontent.com/a/mock-pic',
      }));

      const req = { body: { idToken: 'token-new-applicant' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.strictEqual(capturedError, null);
      assert.strictEqual(res.statusCode, 202, 'New Google applicants must receive 202 Accepted');
      assert.strictEqual(res.responseData.data.status, 'pending');
      assert.strictEqual(res.responseData.data.accessToken, undefined, 'Must NOT issue accessToken');
      assert.strictEqual(res.responseData.data.refreshToken, undefined, 'Must NOT issue refreshToken');

      const created = await User.findOne({ email: 'google_new_applicant@test.edu' });
      assert.ok(created);
      assert.strictEqual(created.role, 'student', 'Default role must be student');
      assert.strictEqual(created.status, 'pending', 'Default status must be pending');
      assert.strictEqual(created.isActive, false, 'isActive must be false');
      assert.strictEqual(created.authProvider, 'google');
      assert.strictEqual(created.googleId, 'google-sub-new-applicant-9999');
      assert.ok(created.studentId, 'Must have auto-generated studentId');
      assert.ok(created.studentId.startsWith('STU-'), 'studentId must start with STU-');
      assert.strictEqual(created.avatar, 'https://lh3.googleusercontent.com/a/mock-pic');
    });

    it('creates audit log and alert notifications for administrators on new Google registration', async () => {
      const log = await AuditLog.findOne({
        action: 'USER_REGISTER_GOOGLE',
        'details.email': 'google_new_applicant@test.edu',
      });
      assert.ok(log, 'Audit log for USER_REGISTER_GOOGLE must exist');
      assert.strictEqual(log.details.role, 'student');
      assert.strictEqual(log.details.status, 'pending');

      const adminNotif = await Notification.findOne({
        userId: adminUser._id,
        title: 'New Google Applicant Pending',
      });
      assert.ok(adminNotif, 'Administrator must receive system notification of pending Google applicant');
    });
  });

  // =========================================================================
  // SECTION 5: Existing Account Linking & Identity Preservation
  // =========================================================================
  describe('5. Existing Account Linking & Identity Preservation', () => {
    it('links existing user with matching verified email: preserves password, role, and user ID', async () => {
      const preUser = await User.findOne({ email: 'google_instructor@test.edu' });
      const origUserId = preUser._id.toString();
      const origPasswordHash = preUser.password;
      const origFacultyId = preUser.facultyId;

      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-instructor-link-777',
        email: 'google_instructor@test.edu',
        email_verified: true,
        name: 'Dr. Google Link Instructor',
      }));

      const req = { body: { idToken: 'token-link-instructor' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.strictEqual(capturedError, null);
      assert.strictEqual(res.statusCode, 200, 'Active linked user receives 200 OK');
      assert.ok(res.responseData.data.accessToken, 'Active user receives accessToken');
      assert.ok(res.responseData.data.refreshToken, 'Active user receives refreshToken');
      assert.strictEqual(res.responseData.data.user.role, 'instructor', 'Preserves instructor role');

      const postUser = await User.findById(origUserId);
      assert.strictEqual(postUser._id.toString(), origUserId, 'User ID must NOT change');
      assert.strictEqual(postUser.googleId, 'google-sub-instructor-link-777', 'googleId must be linked');
      assert.strictEqual(postUser.authProvider, 'both', 'authProvider must be both');
      assert.strictEqual(postUser.password, origPasswordHash, 'Password hash must NOT be cleared or changed');
      assert.strictEqual(postUser.role, 'instructor', 'Role must remain instructor');
      assert.strictEqual(postUser.facultyId, origFacultyId, 'Faculty ID must remain unchanged');
    });

    it('active linked user can subsequently log in using googleId directly without email lookup', async () => {
      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-instructor-link-777',
        email: 'google_instructor@test.edu',
        email_verified: true,
        name: 'Dr. Google Link Instructor',
      }));

      const req = { body: { idToken: 'token-repeat-google' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.strictEqual(capturedError, null);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.status, 'active');
      assert.strictEqual(res.responseData.data.user.email, 'google_instructor@test.edu');
    });
  });

  // =========================================================================
  // SECTION 6: Account Status & Administrative Lifecycle Enforcement
  // =========================================================================
  describe('6. Account Status & Administrative Lifecycle Enforcement', () => {
    it('existing pending user attempting Google login is rejected (HTTP 403, account pending)', async () => {
      const pendingCandidate = await User.create({
        name: 'Pending Student Candidate',
        email: 'google_pending@test.edu',
        role: 'student',
        status: 'pending',
        isActive: false,
        studentId: 'STU-2026-992',
        googleId: 'google-sub-pending-candidate-111',
        authProvider: 'google',
      });

      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-pending-candidate-111',
        email: 'google_pending@test.edu',
        email_verified: true,
        name: 'Pending Student Candidate',
      }));

      const req = { body: { idToken: 'token-pending-user' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 403);
      assert.ok(capturedError.message.includes('pending administrator approval'));
    });

    it('existing revoked user attempting Google login is rejected (HTTP 403, account revoked)', async () => {
      const revokedCandidate = await User.create({
        name: 'Revoked Account Candidate',
        email: 'google_revoked@test.edu',
        role: 'student',
        status: 'revoked',
        isActive: false,
        studentId: 'STU-2026-993',
        googleId: 'google-sub-revoked-candidate-222',
        authProvider: 'google',
      });

      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-revoked-candidate-222',
        email: 'google_revoked@test.edu',
        email_verified: true,
        name: 'Revoked Account Candidate',
      }));

      const req = { body: { idToken: 'token-revoked-user' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 403);
      assert.ok(capturedError.message.includes('account has been revoked'));
    });

    it('existing rejected user attempting Google login is rejected (HTTP 403, account rejected)', async () => {
      const rejectedCandidate = await User.create({
        name: 'Rejected Account Candidate',
        email: 'google_rejected@test.edu',
        role: 'student',
        status: 'rejected',
        isActive: false,
        rejectionReason: 'Invalid student verification documents',
        studentId: 'STU-2026-994',
        googleId: 'google-sub-rejected-candidate-333',
        authProvider: 'google',
      });

      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-rejected-candidate-333',
        email: 'google_rejected@test.edu',
        email_verified: true,
        name: 'Rejected Account Candidate',
      }));

      const req = { body: { idToken: 'token-rejected-user' }, ip: '127.0.0.1' };
      const res = mockResponse();
      let capturedError = null;

      await authController.googleLogin(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 403);
      assert.ok(capturedError.message.includes('rejected: Invalid student verification documents'));
    });
  });

  // =========================================================================
  // SECTION 7: Immutability & Hybrid Password Authentication
  // =========================================================================
  describe('7. Immutability Protections & Hybrid Password Authentication', () => {
    it('PUT /api/v1/users/profile rejects attempts to modify googleId or authProvider (HTTP 400)', async () => {
      const req = {
        user: studentUser,
        body: {
          name: 'Updated Name',
          googleId: 'malicious-google-id-override',
          authProvider: 'both',
        },
      };
      const res = mockResponse();
      let capturedError = null;

      await userController.updateProfile(req, res, (err) => {
        capturedError = err;
      });

      assert.ok(capturedError);
      assert.strictEqual(capturedError.statusCode, 400);
      assert.ok(capturedError.message.includes('OAuth authentication identifiers cannot be modified'));
    });

    it('direct Mongoose save rejects mutating an already linked googleId (HTTP 400)', async () => {
      const linkedUser = await User.findOne({ email: 'google_instructor@test.edu' });
      assert.ok(linkedUser);
      assert.ok(linkedUser.googleId);

      linkedUser.googleId = 'altered-google-id-should-fail';
      await assert.rejects(
        async () => {
          await linkedUser.save();
        },
        (err) => err.statusCode === 400 && err.message.includes('Google ID is permanent')
      );
    });

    it('attempting password login on Google-only account returns helpful error directing user to Google', async () => {
      const googleOnlyApplicant = await User.findOne({ email: 'google_new_applicant@test.edu' });
      assert.ok(googleOnlyApplicant);
      assert.strictEqual(googleOnlyApplicant.authProvider, 'google');
      assert.strictEqual(googleOnlyApplicant.password, undefined);

      await assert.rejects(
        async () => {
          await authService.login({ email: 'google_new_applicant@test.edu', password: 'AnyPassword123' });
        },
        (err) => err.statusCode === 400 && err.message.includes('sign in with Google')
      );
    });

    it('user with both Google and password set can authenticate via email/password as well as Google', async () => {
      // The instructor has authProvider: 'both' and a valid password
      const loginResult = await authService.login({ email: 'google_instructor@test.edu', password: 'Password123!' });
      assert.ok(loginResult.accessToken);
      assert.strictEqual(loginResult.user.email, 'google_instructor@test.edu');
    });
  });

  // =========================================================================
  // SECTION 8: SMTP Configuration, Transporter & Security
  // =========================================================================
  describe('8. Nodemailer SMTP Configuration, Transporter & Credential Security', () => {
    it('SMTP configuration: transporter is created and supports custom host/port/auth', () => {
      assert.ok(emailService.transporter);
      assert.strictEqual(typeof emailService.sendMail, 'function');
    });

    it('verifyConnection() succeeds in test mode and returns { verified: true, mode: "test_fallback" }', async () => {
      const status = await emailService.verifyConnection();
      assert.strictEqual(status.verified, true);
      assert.strictEqual(status.mode, 'test_fallback');
    });

    it('sanitizes credentials in error messages (never logs real or mock passwords)', () => {
      const rawError = 'Invalid login credentials: password SecretPass123 rejected by smtp.gmail.com';
      const sanitized = emailService.sanitizeError(rawError);
      assert.ok(!sanitized.includes('SecretPass123'), 'Sanitized error should not contain raw secret');
      assert.ok(sanitized.includes('***'), 'Sanitized error should replace secret with ***');
    });
  });

  // =========================================================================
  // SECTION 9: Transactional Institutional Email Notifications
  // =========================================================================
  describe('9. Complete Transactional Institutional Email Workflows', () => {
    it('sendPendingRegistrationEmail sends application received notice to user', async () => {
      const res = await emailService.sendPendingRegistrationEmail({
        name: 'Sarah Applicant',
        email: 'sarah@test.edu',
      });
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'sarah@test.edu');
      assert.ok(last.subject.includes('Application Received'));
      assert.ok(last.html.includes('Pending Review'));
      assert.ok(last.html.includes('Check Application Status'));
    });

    it('sendAdminNewApplicantAlert sends notification alert to administrators', async () => {
      const res = await emailService.sendAdminNewApplicantAlert(adminUser, {
        name: 'Sarah Applicant',
        email: 'sarah@test.edu',
        role: 'student',
        instituteCode: 'INST-2026',
      });
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, adminUser.email);
      assert.ok(last.subject.includes('New Applicant Pending Review'));
      assert.ok(last.html.includes('Review Pending Accounts'));
    });

    it('sendAccountApprovedEmail sends welcome and login notice to approved user', async () => {
      const res = await emailService.sendAccountApprovedEmail({
        name: 'Sarah Approved',
        email: 'sarah@test.edu',
        role: 'student',
      });
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'sarah@test.edu');
      assert.ok(last.subject.includes('Account Approved'));
      assert.ok(last.html.includes('Sign In to Platform'));
    });

    it('sendAccountRejectedEmail sends rejection notification with provided reason', async () => {
      const res = await emailService.sendAccountRejectedEmail(
        { name: 'Sarah Candidate', email: 'sarah@test.edu' },
        'Incomplete enrollment documentation'
      );
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'sarah@test.edu');
      assert.ok(last.subject.includes('Account Application Status'));
      assert.ok(last.html.includes('Incomplete enrollment documentation'));
    });

    it('sendAccountRevokedEmail sends access revocation notice with reason', async () => {
      const res = await emailService.sendAccountRevokedEmail(
        { name: 'Sarah User', email: 'sarah@test.edu' },
        'Violation of platform academic integrity code'
      );
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'sarah@test.edu');
      assert.ok(last.subject.includes('Account Status Notice'));
      assert.ok(last.html.includes('Violation of platform academic integrity code'));
    });

    it('sendAssessmentPublishedEmail sends assessment notification to student', async () => {
      const res = await emailService.sendAssessmentPublishedEmail(
        { name: 'Student One', email: 'student1@test.edu' },
        {
          _id: '67c71234567890abcdef1234',
          title: 'Algorithms Midterm Assessment',
          category: 'Algorithms',
          durationMinutes: 60,
          passingScore: 65,
        }
      );
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'student1@test.edu');
      assert.ok(last.subject.includes('New Assessment Available: Algorithms Midterm Assessment'));
      assert.ok(last.html.includes('Start Assessment Attempt'));
    });

    it('sendSubmissionReceivedEmail sends submission alert to instructor', async () => {
      const res = await emailService.sendSubmissionReceivedEmail(
        { name: 'Prof. Turing', email: 'turing@test.edu' },
        { name: 'Student One', email: 'student1@test.edu' },
        { title: 'Algorithms Midterm Assessment' },
        { _id: '67c71234567890abcdef5678', autoScore: 45, status: 'submitted' }
      );
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'turing@test.edu');
      assert.ok(last.subject.includes('Submission Received: Student One'));
      assert.ok(last.html.includes('Open Evaluation Studio'));
    });

    it('sendGradeReleasedEmail sends score and feedback results notice to student', async () => {
      const res = await emailService.sendGradeReleasedEmail(
        { name: 'Student One', email: 'student1@test.edu' },
        { title: 'Algorithms Midterm Assessment', totalPoints: 100, passingScore: 60 },
        {
          finalScore: 85,
          percentage: 85,
          passed: true,
          feedback: 'Excellent work on dynamic programming question.',
        }
      );
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'student1@test.edu');
      assert.ok(last.subject.includes('Evaluation Completed: Algorithms Midterm Assessment (85%)'));
      assert.ok(last.html.includes('PASSED'));
      assert.ok(last.html.includes('Excellent work on dynamic programming question.'));
    });

    it('sendPasswordResetEmail sends password reset link to user', async () => {
      const res = await emailService.sendPasswordResetEmail(
        { name: 'Sarah Reset', email: 'sarah@test.edu' },
        'mock-secure-reset-token-xyz123'
      );
      assert.strictEqual(res.success, true);
      const last = emailService.getLastEmail();
      assert.strictEqual(last.to, 'sarah@test.edu');
      assert.ok(last.subject.includes('Password Reset Request'));
      assert.ok(last.html.includes('/auth/reset-password?token=mock-secure-reset-token-xyz123'));
      assert.ok(last.html.includes('Reset Password'));
    });
  });
});
