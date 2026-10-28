const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, AuditLog } = require('../src/models');
const { verifyAccessToken } = require('../src/utils/jwt');
const googleAuthService = require('../src/services/googleAuth.service');
const authController = require('../src/controllers/auth.controller');
const adminController = require('../src/controllers/admin.controller');

const mockResponse = () => {
  const headers = {};
  const res = {
    statusCode: 200,
    responseData: null,
    setHeader(name, value) {
      const key = name.toLowerCase();
      if (!headers[key]) {
        headers[key] = value;
      } else if (Array.isArray(headers[key])) {
        headers[key] = [...headers[key], value];
      } else {
        headers[key] = [headers[key], value];
      }
      return this;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
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

const getMockCookie = (res, name) => {
  const raw = res.getHeader('set-cookie');
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const found = list.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return decodeURIComponent(found.split(';')[0].slice(name.length + 1));
};

describe('Institutional Admin Google OAuth Provisioning & RBAC Lifecycle Suite', () => {
  const TARGET_ADMIN_EMAIL = 'admin.uap.edu@gmail.com';
  const TARGET_GOOGLE_SUB = 'google-sub-institutional-admin-999';

  before(async () => {
    await connectDB();
    await User.deleteMany({
      email: {
        $in: [
          TARGET_ADMIN_EMAIL,
          'unrelated_student@institution.edu',
          'pending_applicant@institution.edu',
        ],
      },
    });
    await seedDatabase();
  });

  after(async () => {
    await disconnectDB();
  });

  it('1. Pre-provisioned institutional admin logging in with Google succeeds (HTTP 200, role: admin, active)', async () => {
    // Ensure target admin account exists in seeded database
    const adminDoc = await User.findOne({ email: TARGET_ADMIN_EMAIL });
    assert.ok(adminDoc, 'Target institutional administrator account must exist');
    assert.strictEqual(adminDoc.role, 'admin');
    assert.strictEqual(adminDoc.status, 'active');
    assert.strictEqual(adminDoc.isActive, true);
    assert.strictEqual(adminDoc.adminId, 'ADM-INST-001');

    // Simulate Google OAuth token verification
    googleAuthService.setMockVerificationHandler(() => ({
      sub: TARGET_GOOGLE_SUB,
      email: TARGET_ADMIN_EMAIL,
      email_verified: true,
      name: 'Institutional Administrator',
    }));

    const req = { body: { idToken: 'token-admin-google-sso' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let capturedErr = null;

    await authController.googleLogin(req, res, (err) => {
      capturedErr = err;
    });

    assert.strictEqual(capturedErr, null, 'Google login must not throw error for pre-provisioned active admin');
    assert.strictEqual(res.statusCode, 200, 'Must respond with HTTP 200 OK');
    assert.ok(res.responseData.data.accessToken, 'Access token must be present');

    const decoded = verifyAccessToken(res.responseData.data.accessToken);
    assert.strictEqual(decoded.role, 'admin', 'JWT token role must be admin');
    assert.strictEqual(decoded.email, TARGET_ADMIN_EMAIL);

    // Verify account linking in database
    const updatedUser = await User.findById(adminDoc._id);
    assert.strictEqual(updatedUser.googleId, TARGET_GOOGLE_SUB);
    assert.strictEqual(updatedUser.role, 'admin');
    assert.strictEqual(updatedUser.status, 'active');
    assert.strictEqual(updatedUser.isActive, true);
    assert.strictEqual(updatedUser.adminId, 'ADM-INST-001');
    assert.strictEqual(updatedUser.studentId, undefined);
  });

  it('2. Elevating a pending Google applicant to administrator updates status, unsets studentId, and permits login', async () => {
    // Simulate what originally occurred: an admin email registered via Google as an unapproved pending student
    const pendingEmail = 'admin.elevation.test@gmail.com';
    const pendingGoogleSub = 'google-sub-elevate-12345';

    await User.deleteMany({ email: pendingEmail });

    const pendingUser = await User.create({
      name: 'Pending Admin Applicant',
      email: pendingEmail,
      googleId: pendingGoogleSub,
      authProvider: 'google',
      role: 'student',
      status: 'pending',
      isActive: false,
      studentId: 'STU-ELEV-999',
      department: 'Computer Science',
    });

    // Before elevation: Google login must be rejected with HTTP 403 pending administrator approval
    googleAuthService.setMockVerificationHandler(() => ({
      sub: pendingGoogleSub,
      email: pendingEmail,
      email_verified: true,
      name: 'Pending Admin Applicant',
    }));

    const reqBefore = { body: { idToken: 'token-before-elevate' }, ip: '127.0.0.1' };
    const resBefore = mockResponse();
    let errBefore = null;

    await authController.googleLogin(reqBefore, resBefore, (err) => {
      errBefore = err;
    });

    assert.ok(errBefore, 'Pending user must be blocked');
    assert.strictEqual(errBefore.statusCode, 403);
    assert.ok(errBefore.message.includes('pending administrator approval'));

    // Execute authoritative administrator elevation
    const updateOp = {
      $set: {
        role: 'admin',
        status: 'active',
        isActive: true,
        adminId: 'ADM-INST-999',
        department: 'Institutional Administration',
        approvedAt: new Date(),
        rejectionReason: null,
        revokedAt: null,
        revokedBy: null,
      },
      $unset: { studentId: 1 },
    };
    await User.updateOne({ _id: pendingUser._id }, updateOp);

    await AuditLog.create({
      userId: pendingUser._id,
      action: 'ADMIN_ACCOUNT_PROVISIONED',
      entityType: 'User',
      entityId: pendingUser._id.toString(),
      details: {
        email: pendingEmail,
        role: 'admin',
        adminId: 'ADM-INST-999',
        elevatedFromPendingGoogle: true,
      },
      ipAddress: '127.0.0.1',
    });

    // After elevation: Google login must succeed with HTTP 200 and admin role
    const reqAfter = { body: { idToken: 'token-after-elevate' }, ip: '127.0.0.1' };
    const resAfter = mockResponse();
    let errAfter = null;

    await authController.googleLogin(reqAfter, resAfter, (err) => {
      errAfter = err;
    });

    assert.strictEqual(errAfter, null, 'Elevated administrator must not receive error');
    assert.strictEqual(resAfter.statusCode, 200);
    assert.strictEqual(resAfter.responseData.data.user.role, 'admin');
    assert.strictEqual(resAfter.responseData.data.user.status, 'active');
    assert.ok(!resAfter.responseData.data.user.studentId, 'studentId must not be present on admin profile');

    const refreshed = await User.findById(pendingUser._id);
    assert.strictEqual(refreshed.role, 'admin');
    assert.strictEqual(refreshed.status, 'active');
    assert.strictEqual(refreshed.isActive, true);
    assert.strictEqual(refreshed.adminId, 'ADM-INST-999');
    assert.strictEqual(refreshed.studentId, undefined);

    await User.deleteMany({ email: pendingEmail });
  });

  it('3. Zero-trust RBAC preservation: public Google signups remain pending students and cannot self-escalate', async () => {
    const publicEmail = 'unrelated_student@institution.edu';
    const publicSub = 'google-sub-public-student-001';

    googleAuthService.setMockVerificationHandler(() => ({
      sub: publicSub,
      email: publicEmail,
      email_verified: true,
      name: 'Unrelated Student',
    }));

    const req = { body: { idToken: 'token-public-signup' }, ip: '127.0.0.1' };
    const res = mockResponse();
    let capturedErr = null;

    await authController.googleLogin(req, res, (err) => {
      capturedErr = err;
    });

    assert.strictEqual(capturedErr, null);
    // Initial Google registration returns 202 Accepted with pending status
    assert.strictEqual(res.statusCode, 202);
    assert.strictEqual(res.responseData.data.status, 'pending');
    assert.strictEqual(res.responseData.data.user.role, 'student');
    assert.strictEqual(res.responseData.data.user.isActive, false);

    // Verify stored document
    const createdUser = await User.findOne({ email: publicEmail });
    assert.ok(createdUser);
    assert.strictEqual(createdUser.role, 'student', 'Must strictly default to student');
    assert.strictEqual(createdUser.status, 'pending', 'Must strictly default to pending');
    assert.strictEqual(createdUser.isActive, false);

    // Subsequent login attempt while still pending must receive HTTP 403
    const reqSubsequent = { body: { idToken: 'token-public-subsequent' }, ip: '127.0.0.1' };
    const resSubsequent = mockResponse();
    let subsequentErr = null;

    await authController.googleLogin(reqSubsequent, resSubsequent, (err) => {
      subsequentErr = err;
    });

    assert.ok(subsequentErr);
    assert.strictEqual(subsequentErr.statusCode, 403);
    assert.ok(subsequentErr.message.includes('pending administrator approval'));

    // Admin approval queue cannot approve user as admin
    const adminUser = await User.findOne({ role: 'admin', status: 'active' });
    const approveReq = {
      params: { id: createdUser._id.toString() },
      body: { role: 'admin' }, // Malicious attempt to elevate via standard queue
      user: adminUser,
      ip: '127.0.0.1',
    };
    const approveRes = mockResponse();
    await adminController.approveUser(approveReq, approveRes, () => {});

    // Role override to admin must be ignored
    const approvedDoc = await User.findById(createdUser._id);
    assert.strictEqual(approvedDoc.status, 'active');
    assert.strictEqual(approvedDoc.role, 'student', 'Approval queue must never elevate to admin');

    await User.deleteMany({ email: publicEmail });
  });
});
