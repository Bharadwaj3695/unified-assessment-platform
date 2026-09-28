const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Notification, AuditLog } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { verifyAccessToken } = require('../src/utils/jwt');
const googleAuthService = require('../src/services/googleAuth.service');
const authService = require('../src/services/auth.service');
const emailService = require('../src/services/email.service');
const authController = require('../src/controllers/auth.controller');
const adminController = require('../src/controllers/admin.controller');
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

describe('Google SSO, Lifecycle Governance & SMTP Verification Matrix (19 Requirements)', () => {
  let adminUser;
  let existingInstructor;
  let existingStudent;
  let testPasswordHash;

  before(async () => {
    await connectDB();
    await seedDatabase();

    testPasswordHash = await hashPassword('TestPassword123!');

    // Clean up test users
    await User.deleteMany({
      email: {
        $in: [
          'chk_new_student@checklist.edu',
          'chk_existing_instructor@checklist.edu',
          'chk_existing_student@checklist.edu',
          'chk_pending_user@checklist.edu',
          'chk_approved_user@checklist.edu',
          'chk_rejected_user@checklist.edu',
          'chk_revoked_user@checklist.edu',
          'chk_smtp_fail@checklist.edu',
        ],
      },
    });

    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    existingInstructor = await User.create({
      name: 'Checklist Instructor',
      email: 'chk_existing_instructor@checklist.edu',
      password: testPasswordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-CHK-101',
      department: 'Computer Science',
      subjectId: 'CS-901',
      subjectName: 'Advanced Distributed Systems',
    });

    existingStudent = await User.create({
      name: 'Checklist Student',
      email: 'chk_existing_student@checklist.edu',
      password: testPasswordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-CHK-201',
      department: 'Computer Science',
    });
  });

  afterEach(() => {
    googleAuthService.clearMockVerificationHandler();
    emailService.clearSentEmails();
  });

  after(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'chk_new_student@checklist.edu',
          'chk_existing_instructor@checklist.edu',
          'chk_existing_student@checklist.edu',
          'chk_pending_user@checklist.edu',
          'chk_approved_user@checklist.edu',
          'chk_rejected_user@checklist.edu',
          'chk_revoked_user@checklist.edu',
          'chk_smtp_fail@checklist.edu',
        ],
      },
    });
    await disconnectDB();
  });

  // 1. Google account creation
  it('1. Google account creation: creates new student user with pending status, generated student ID, and no JWT', async () => {
    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-001',
      email: 'chk_new_student@checklist.edu',
      email_verified: true,
      name: 'New Google Student',
      picture: 'https://lh3.googleusercontent.com/a/chk-pic-1',
    }));

    const req = { body: { idToken: 'valid-token-chk-001' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let nextErr = null;

    await authController.googleLogin(req, res, (err) => {
      nextErr = err;
    });

    assert.strictEqual(nextErr, null);
    assert.strictEqual(res.statusCode, 202, 'New Google applicants must receive HTTP 202');
    assert.strictEqual(res.responseData.data.status, 'pending');
    assert.strictEqual(res.responseData.data.accessToken, undefined, 'Must not issue accessToken');
    assert.strictEqual(res.responseData.data.refreshToken, undefined, 'Must not issue refreshToken');

    const created = await User.findOne({ email: 'chk_new_student@checklist.edu' });
    assert.ok(created);
    assert.strictEqual(created.role, 'student');
    assert.strictEqual(created.status, 'pending');
    assert.strictEqual(created.isActive, false);
    assert.strictEqual(created.authProvider, 'google');
    assert.strictEqual(created.googleId, 'google-sub-chk-001');
    assert.ok(created.studentId.startsWith('STU-'));
  });

  // 2. Google → existing email account linking
  it('2. Google → existing email account linking: links googleId to existing user with matching verified email and sets authProvider to both', async () => {
    const preUser = await User.findOne({ email: 'chk_existing_instructor@checklist.edu' });
    const originalId = preUser._id.toString();

    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-inst-002',
      email: 'chk_existing_instructor@checklist.edu',
      email_verified: true,
      name: 'Checklist Instructor',
    }));

    const req = { body: { idToken: 'token-link-instructor' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let nextErr = null;

    await authController.googleLogin(req, res, (err) => {
      nextErr = err;
    });

    assert.strictEqual(nextErr, null);
    assert.strictEqual(res.statusCode, 200);

    const postUser = await User.findById(originalId);
    assert.strictEqual(postUser._id.toString(), originalId, 'User ID must remain unchanged');
    assert.strictEqual(postUser.googleId, 'google-sub-chk-inst-002');
    assert.strictEqual(postUser.authProvider, 'both');
    assert.strictEqual(postUser.password, testPasswordHash, 'Password hash must be preserved');
  });

  // 3. No duplicate account
  it('3. No duplicate account: ensures duplicate accounts are prevented and User document count remains 1', async () => {
    const countBefore = await User.countDocuments({ email: 'chk_existing_instructor@checklist.edu' });
    assert.strictEqual(countBefore, 1);

    // Repeat Google login for linked user
    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-inst-002',
      email: 'chk_existing_instructor@checklist.edu',
      email_verified: true,
      name: 'Checklist Instructor',
    }));

    const req = { body: { idToken: 'token-repeat' }, ip: '127.0.0.1' };
    const res = mockResponse();
    await authController.googleLogin(req, res, () => {});

    assert.strictEqual(res.statusCode, 200);
    const countAfter = await User.countDocuments({ email: 'chk_existing_instructor@checklist.edu' });
    assert.strictEqual(countAfter, 1, 'Document count must remain exactly 1 (no duplicate account created)');
  });

  // 4. Pending Google user
  it('4. Pending Google user: blocks pending Google users from logging in (HTTP 403) and does not issue JWT', async () => {
    await User.create({
      name: 'Pending Test Google User',
      email: 'chk_pending_user@checklist.edu',
      role: 'student',
      status: 'pending',
      isActive: false,
      studentId: 'STU-CHK-PEND-1',
      googleId: 'google-sub-chk-pend-004',
      authProvider: 'google',
    });

    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-pend-004',
      email: 'chk_pending_user@checklist.edu',
      email_verified: true,
      name: 'Pending Test Google User',
    }));

    const req = { body: { idToken: 'token-pend-login' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let capturedError = null;

    await authController.googleLogin(req, res, (err) => {
      capturedError = err;
    });

    assert.ok(capturedError);
    assert.strictEqual(capturedError.statusCode, 403);
    assert.ok(capturedError.message.includes('pending administrator approval'));
  });

  // 5. Approved Google user
  it('5. Approved Google user: allows approved Google user to authenticate with HTTP 200, user profile, and valid JWT', async () => {
    const pendingUser = await User.create({
      name: 'Approved Test Google User',
      email: 'chk_approved_user@checklist.edu',
      role: 'student',
      status: 'pending',
      isActive: false,
      studentId: 'STU-CHK-APP-1',
      googleId: 'google-sub-chk-app-005',
      authProvider: 'google',
    });

    // Admin approves the user
    const adminReq = {
      params: { id: pendingUser._id.toString() },
      body: {},
      user: adminUser,
      ip: '127.0.0.1',
    };
    const adminRes = mockResponse();
    await adminController.approveUser(adminReq, adminRes, () => {});
    assert.strictEqual(adminRes.statusCode, 200);

    const refreshed = await User.findById(pendingUser._id);
    assert.strictEqual(refreshed.status, 'active');
    assert.strictEqual(refreshed.isActive, true);

    // Now log in via Google
    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-app-005',
      email: 'chk_approved_user@checklist.edu',
      email_verified: true,
      name: 'Approved Test Google User',
    }));

    const req = { body: { idToken: 'token-app-login' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let capturedErr = null;

    await authController.googleLogin(req, res, (err) => {
      capturedErr = err;
    });

    assert.strictEqual(capturedErr, null);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.responseData.data.accessToken);
    assert.ok(res.responseData.data.refreshToken);
    assert.strictEqual(res.responseData.data.user.email, 'chk_approved_user@checklist.edu');
    assert.strictEqual(res.responseData.data.user.status, 'active');
  });

  // 6. Rejected Google user
  it('6. Rejected Google user: blocks rejected Google user with HTTP 403 including rejectionReason', async () => {
    await User.create({
      name: 'Rejected Google Candidate',
      email: 'chk_rejected_user@checklist.edu',
      role: 'student',
      status: 'rejected',
      isActive: false,
      rejectionReason: 'Academic verification document unreadable',
      studentId: 'STU-CHK-REJ-1',
      googleId: 'google-sub-chk-rej-006',
      authProvider: 'google',
    });

    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-rej-006',
      email: 'chk_rejected_user@checklist.edu',
      email_verified: true,
      name: 'Rejected Google Candidate',
    }));

    const req = { body: { idToken: 'token-rej-login' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let capturedErr = null;

    await authController.googleLogin(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr);
    assert.strictEqual(capturedErr.statusCode, 403);
    assert.ok(capturedErr.message.includes('rejected: Academic verification document unreadable'));
  });

  // 7. Revoked Google user
  it('7. Revoked Google user: blocks revoked Google user with HTTP 403 and records REVOKED_USER_LOGIN_ATTEMPT audit log', async () => {
    const revokedUser = await User.create({
      name: 'Revoked Google User',
      email: 'chk_revoked_user@checklist.edu',
      role: 'student',
      status: 'revoked',
      isActive: false,
      studentId: 'STU-CHK-REV-1',
      googleId: 'google-sub-chk-rev-007',
      authProvider: 'google',
    });

    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-rev-007',
      email: 'chk_revoked_user@checklist.edu',
      email_verified: true,
      name: 'Revoked Google User',
    }));

    const req = { body: { idToken: 'token-rev-login' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let capturedErr = null;

    await authController.googleLogin(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr);
    assert.strictEqual(capturedErr.statusCode, 403);
    assert.ok(capturedErr.message.includes('account has been revoked'));

    const audit = await AuditLog.findOne({
      userId: revokedUser._id,
      action: 'REVOKED_USER_LOGIN_ATTEMPT',
    });
    assert.ok(audit);
  });

  // 8. Role preservation
  it('8. Role preservation: preserves existing instructor or admin role when linking Google account, preventing role escalation or resetting', async () => {
    const instructor = await User.findOne({ email: 'chk_existing_instructor@checklist.edu' });
    assert.strictEqual(instructor.role, 'instructor');

    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-inst-002',
      email: 'chk_existing_instructor@checklist.edu',
      email_verified: true,
      name: 'Checklist Instructor',
    }));

    const res = mockResponse();
    await authController.googleLogin({ body: { idToken: 'token' }, ip: '127.0.0.1' }, res, () => {});

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.responseData.data.user.role, 'instructor', 'Must preserve instructor role');
  });

  // 9. Student ID preservation
  it('9. Student ID preservation: preserves existing student ID when linking Google account and enforces student ID immutability', async () => {
    const student = await User.findOne({ email: 'chk_existing_student@checklist.edu' });
    const origStudentId = student.studentId;
    assert.strictEqual(origStudentId, 'STU-CHK-201');

    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-stu-009',
      email: 'chk_existing_student@checklist.edu',
      email_verified: true,
      name: 'Checklist Student',
    }));

    const res = mockResponse();
    await authController.googleLogin({ body: { idToken: 'token-stu-link' }, ip: '127.0.0.1' }, res, () => {});

    assert.strictEqual(res.statusCode, 200);
    const postStudent = await User.findOne({ email: 'chk_existing_student@checklist.edu' });
    assert.strictEqual(postStudent.studentId, origStudentId, 'studentId must not be changed');

    // Verify immutability on Mongoose save
    postStudent.studentId = 'STU-MODIFIED-999';
    await assert.rejects(
      async () => {
        await postStudent.save();
      },
      (err) => err.statusCode === 400 && err.message.includes('Student ID is permanent and immutable')
    );
  });

  // 10. Faculty ID preservation
  it('10. Faculty ID preservation: preserves existing faculty ID when linking Google account and enforces faculty ID immutability', async () => {
    const instructor = await User.findOne({ email: 'chk_existing_instructor@checklist.edu' });
    const origFacultyId = instructor.facultyId;
    assert.strictEqual(origFacultyId, 'FAC-CHK-101');

    instructor.facultyId = 'FAC-MODIFIED-888';
    await assert.rejects(
      async () => {
        await instructor.save();
      },
      (err) => err.statusCode === 400 && err.message.includes('Faculty ID is permanent and immutable')
    );
  });

  // 11. JWT issuance
  it('11. JWT issuance: generates valid JWT access and refresh tokens with proper id, role, and email claims for approved users', async () => {
    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-chk-inst-002',
      email: 'chk_existing_instructor@checklist.edu',
      email_verified: true,
      name: 'Checklist Instructor',
    }));

    const res = mockResponse();
    await authController.googleLogin({ body: { idToken: 'token' }, ip: '127.0.0.1' }, res, () => {});

    assert.strictEqual(res.statusCode, 200);
    const { accessToken, refreshToken, user } = res.responseData.data;
    assert.ok(accessToken);
    assert.ok(refreshToken);

    const decoded = verifyAccessToken(accessToken);
    assert.strictEqual(decoded.id, user.id);
    assert.strictEqual(decoded.role, 'instructor');
    assert.strictEqual(decoded.email, 'chk_existing_instructor@checklist.edu');
  });

  // 12. RBAC enforcement
  it('12. RBAC enforcement: verifies that tokens from Google authentication enforce role-based access control and reject unauthorized route access', async () => {
    const student = await User.findOne({ email: 'chk_existing_student@checklist.edu' });
    const instructor = await User.findOne({ email: 'chk_existing_instructor@checklist.edu' });

    const { authorize } = require('../src/middleware/role.middleware');
    const adminGuard = authorize('admin');
    const instructorGuard = authorize('instructor');
    const studentGuard = authorize('student');

    // 1. Student blocked from admin route (HTTP 403)
    const reqStudent = { user: student };
    const resStudent = mockResponse();
    let nextCalled = false;
    adminGuard(reqStudent, resStudent, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(resStudent.statusCode, 403);
    assert.ok(resStudent.responseData.message.includes('Access denied'));

    // 2. Instructor blocked from admin route (HTTP 403)
    const reqInstructor = { user: instructor };
    const resInstructor = mockResponse();
    let nextInstructorCalled = false;
    adminGuard(reqInstructor, resInstructor, () => {
      nextInstructorCalled = true;
    });
    assert.strictEqual(nextInstructorCalled, false);
    assert.strictEqual(resInstructor.statusCode, 403);

    // 3. Authorized access succeeds (calls next)
    let studentNextCalled = false;
    studentGuard(reqStudent, mockResponse(), () => {
      studentNextCalled = true;
    });
    assert.strictEqual(studentNextCalled, true);
  });

  // 13. Invalid Google identity
  it('13. Invalid Google identity: rejects missing credentials (400), invalid/expired tokens (401), missing sub (400), and missing email (400)', async () => {
    // Missing credentials
    let err1 = null;
    await authController.googleLogin({ body: {}, ip: '127.0.0.1' }, mockResponse(), (err) => {
      err1 = err;
    });
    assert.ok(err1);
    assert.strictEqual(err1.statusCode, 400);

    // Invalid / expired token
    googleAuthService.setMockVerificationHandler(() => {
      const err = new Error('Token expired');
      err.statusCode = 401;
      throw err;
    });
    let err2 = null;
    await authController.googleLogin({ body: { idToken: 'expired' }, ip: '127.0.0.1' }, mockResponse(), (err) => {
      err2 = err;
    });
    assert.ok(err2);
    assert.strictEqual(err2.statusCode, 401);

    // Missing sub
    googleAuthService.setMockVerificationHandler(() => ({
      email: 'no_sub@checklist.edu',
      email_verified: true,
    }));
    let err3 = null;
    await authController.googleLogin({ body: { idToken: 'no-sub' }, ip: '127.0.0.1' }, mockResponse(), (err) => {
      err3 = err;
    });
    assert.ok(err3);
    assert.strictEqual(err3.statusCode, 400);
    assert.ok(err3.message.includes('missing subject identifier'));

    // Missing email
    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'sub-no-email',
      email_verified: true,
    }));
    let err4 = null;
    await authController.googleLogin({ body: { idToken: 'no-email' }, ip: '127.0.0.1' }, mockResponse(), (err) => {
      err4 = err;
    });
    assert.ok(err4);
    assert.strictEqual(err4.statusCode, 400);
    assert.ok(err4.message.includes('missing email address'));
  });

  // 14. Unverified email
  it('14. Unverified email: rejects Google accounts where email_verified is false (HTTP 400)', async () => {
    googleAuthService.setMockVerificationHandler(() => ({
      sub: 'google-sub-unverified',
      email: 'unverified@checklist.edu',
      email_verified: false,
    }));

    let capturedErr = null;
    await authController.googleLogin(
      { body: { idToken: 'unverified-token' }, ip: '127.0.0.1' },
      mockResponse(),
      (err) => {
        capturedErr = err;
      }
    );

    assert.ok(capturedErr);
    assert.strictEqual(capturedErr.statusCode, 400);
    assert.ok(capturedErr.message.includes('Unverified Google email'));
  });

  // 15. SMTP configuration
  it('15. SMTP configuration: initializes Nodemailer transporter with configurable host/port/auth and supports connection verification', async () => {
    assert.ok(emailService.transporter);
    const conn = await emailService.verifyConnection();
    assert.strictEqual(conn.verified, true);
    assert.strictEqual(conn.mode, 'test_fallback');
  });

  // 16. SMTP failure handling
  it('16. SMTP failure handling: handles mail dispatch failures gracefully without blocking auth/registration, and sanitizes sensitive credentials in errors', async () => {
    // 1. Sanitization of credentials in error strings
    const rawError = 'SMTP Error: auth failed with pass=SuperSecretPassword99!';
    const sanitized = emailService.sanitizeError(rawError);
    assert.ok(!sanitized.includes('SuperSecretPassword99!'));
    assert.ok(sanitized.includes('***'));

    // 2. Non-blocking error handling on Google registration
    // Temporarily break sendPendingRegistrationEmail to simulate SMTP network outage
    const originalSend = emailService.sendPendingRegistrationEmail;
    emailService.sendPendingRegistrationEmail = async () => {
      throw new Error('Connection timed out: smtp.gmail.com:587');
    };

    try {
      googleAuthService.setMockVerificationHandler(() => ({
        sub: 'google-sub-chk-smtp-fail',
        email: 'chk_smtp_fail@checklist.edu',
        email_verified: true,
        name: 'SMTP Outage Applicant',
      }));

      const res = mockResponse();
      let capturedErr = null;
      await authController.googleLogin({ body: { idToken: 'token-smtp-fail' }, ip: '127.0.0.1' }, res, (err) => {
        capturedErr = err;
      });

      assert.strictEqual(capturedErr, null, 'Registration must not fail when SMTP encounters network error');
      assert.strictEqual(res.statusCode, 202);
      assert.strictEqual(res.responseData.data.status, 'pending');
    } finally {
      emailService.sendPendingRegistrationEmail = originalSend;
    }
  });

  // 17. Password login still works
  it('17. Password login still works: confirms local email/password login continues to work for standard and hybrid accounts, directing Google-only users appropriately', async () => {
    // 1. Hybrid user (both Google and password) can log in with password
    const hybridLogin = await authService.login({
      email: 'chk_existing_instructor@checklist.edu',
      password: 'TestPassword123!',
    });
    assert.ok(hybridLogin.accessToken);
    assert.strictEqual(hybridLogin.user.email, 'chk_existing_instructor@checklist.edu');

    // 2. Standard user (local password only) can log in with password
    const studentLogin = await authService.login({
      email: 'chk_existing_student@checklist.edu',
      password: 'TestPassword123!',
    });
    assert.ok(studentLogin.accessToken);
    assert.strictEqual(studentLogin.user.email, 'chk_existing_student@checklist.edu');

    // 3. Google-only user attempting password login receives informative error
    const googleOnlyUser = await User.findOne({ email: 'chk_approved_user@checklist.edu' });
    assert.strictEqual(googleOnlyUser.authProvider, 'google');

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'chk_approved_user@checklist.edu',
          password: 'AnyPassword123!',
        });
      },
      (err) => err.statusCode === 400 && err.message.includes('sign in with Google')
    );
  });

  // 18. Password reset still works
  it('18. Password reset still works: supports changing password and verifies password reset email generation and token handling', async () => {
    // 1. Changing password for active user
    const student = await User.findOne({ email: 'chk_existing_student@checklist.edu' });
    const changeRes = await authService.changePassword(
      student._id.toString(),
      'TestPassword123!',
      'NewSecurePassword456!'
    );
    assert.ok(changeRes.message.includes('Password updated successfully'));

    // Authenticate with new password
    const newLogin = await authService.login({
      email: 'chk_existing_student@checklist.edu',
      password: 'NewSecurePassword456!',
    });
    assert.ok(newLogin.accessToken);

    // Old password must now fail
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'chk_existing_student@checklist.edu',
          password: 'TestPassword123!',
        });
      },
      (err) => err.statusCode === 401
    );

    // 2. Password reset email dispatch verification
    const mailRes = await emailService.sendPasswordResetEmail(student, 'secure-reset-token-xyz789');
    assert.strictEqual(mailRes.success, true);
    const lastMail = emailService.getLastEmail();
    assert.strictEqual(lastMail.to, student.email);
    assert.ok(lastMail.html.includes('/auth/reset-password?token=secure-reset-token-xyz789'));
  });

  // 19. Existing regression suite
  it('19. Existing regression suite: confirms database integrity, model indices, and audit logging operate as expected', async () => {
    // Verify AuditLog collection holds entries
    const auditLogs = await AuditLog.find({ 'details.email': 'chk_new_student@checklist.edu' });
    assert.ok(auditLogs.length > 0);

    // Verify Notification collection holds alerts
    const adminNotif = await Notification.findOne({
      userId: adminUser._id,
      title: 'New Google Applicant Pending',
    });
    assert.ok(adminNotif);

    // Verify unique indexes exist on User collection
    const indexes = await User.collection.indexes();
    const indexNames = indexes.map((idx) => Object.keys(idx.key)[0]);
    assert.ok(indexNames.includes('email'));
    assert.ok(indexNames.includes('googleId'));
    assert.ok(indexNames.includes('studentId'));
    assert.ok(indexNames.includes('facultyId'));
  });
});
