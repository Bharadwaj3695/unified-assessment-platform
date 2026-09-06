const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const authService = require('../src/services/auth.service');
const { User, AuditLog } = require('../src/models');
const adminController = require('../src/controllers/admin.controller');

describe('Phase B Verification: Admin Approval & Account Lifecycle', () => {
  let adminUser;
  let pendingUser;

  before(async () => {
    await connectDB();
    await seedDatabase();
    await User.updateOne({ email: 'pending@uap.edu' }, { status: 'pending', isActive: false });
    await User.updateOne({ email: 'alice@uap.edu' }, { status: 'active', isActive: true });
    await User.deleteOne({ email: 'rejected_candidate@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    pendingUser = await User.findOne({ email: 'pending@uap.edu' });
  });

  after(async () => {
    await User.updateOne({ email: 'pending@uap.edu' }, { status: 'pending', isActive: false });
    await User.updateOne({ email: 'alice@uap.edu' }, { status: 'active', isActive: true });
    await User.deleteOne({ email: 'rejected_candidate@uap.edu' });
    await disconnectDB();
  });

  it('should find pending users in the approval queue', async () => {
    const pendingList = await User.find({ status: 'pending' });
    assert.ok(pendingList.length > 0, 'There should be pending applicants in queue');
    assert.strictEqual(pendingList.some((u) => u.email === 'pending@uap.edu'), true);
  });

  it('should inspect complete user details with audit metadata', async () => {
    const target = await User.findOne({ email: 'pending@uap.edu' });
    assert.ok(target);
    assert.strictEqual(target.status, 'pending');
    assert.strictEqual(target.isActive, false);
    assert.ok(target.createdAt);
  });

  it('should approve pending applicant and allow subsequent login', async () => {
    const target = await User.findOne({ email: 'pending@uap.edu' });
    assert.ok(target);

    // Mock Express req & res for approveUser
    const req = {
      params: { id: target._id.toString() },
      body: { role: 'student' },
      user: adminUser,
      ip: '127.0.0.1',
    };

    let responseData = null;
    const res = {
      status: (code) => {
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    await adminController.approveUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.ok(responseData && responseData.success);
    const updated = await User.findById(target._id);
    assert.strictEqual(updated.status, 'active');
    assert.strictEqual(updated.isActive, true);
    assert.ok(updated.approvedAt);
    assert.strictEqual(updated.approvedBy.toString(), adminUser._id.toString());

    // Login must now succeed
    const loginResult = await authService.login({
      email: 'pending@uap.edu',
      password: 'Student@123',
    });
    assert.ok(loginResult.accessToken);
    assert.strictEqual(loginResult.user.status, 'active');
  });

  it('should reject pending applicant and record rejection reason', async () => {
    const { hashPassword } = require('../src/utils/password');
    const hashedPassword = await hashPassword('Password123');
    await User.deleteOne({ email: 'rejected_candidate@uap.edu' });
    const rejectedApplicant = await User.create({
      name: 'Rejected Applicant',
      email: 'rejected_candidate@uap.edu',
      password: hashedPassword,
      role: 'student',
      status: 'pending',
      isActive: false,
      instituteCode: 'INVALID-CODE',
    });

    const req = {
      params: { id: rejectedApplicant._id.toString() },
      body: { reason: 'Invalid institutional credential provided' },
      user: adminUser,
      ip: '127.0.0.1',
    };

    let responseData = null;
    const res = {
      status: () => res,
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    await adminController.rejectUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.ok(responseData && responseData.success);
    const updated = await User.findById(rejectedApplicant._id);
    assert.strictEqual(updated.status, 'rejected');
    assert.strictEqual(updated.isActive, false);
    assert.strictEqual(updated.rejectionReason, 'Invalid institutional credential provided');

    // Attempting login must be blocked with 403
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'rejected_candidate@uap.edu',
          password: 'Password123',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /registration was rejected/i);
        return true;
      }
    );
  });

  it('should revoke active user and prevent future authentication', async () => {
    const student = await User.findOne({ email: 'alice@uap.edu' });
    assert.ok(student);
    assert.strictEqual(student.status, 'active');

    const req = {
      params: { id: student._id.toString() },
      body: { reason: 'Honor code violation review' },
      user: adminUser,
      ip: '127.0.0.1',
    };

    let responseData = null;
    const res = {
      status: () => res,
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    await adminController.revokeUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.ok(responseData && responseData.success);
    const updated = await User.findById(student._id);
    assert.strictEqual(updated.status, 'revoked');
    assert.strictEqual(updated.isActive, false);
    assert.ok(updated.revokedAt);
    assert.strictEqual(updated.revokedBy.toString(), adminUser._id.toString());

    // Attempting login must be blocked with 403
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'alice@uap.edu',
          password: 'Student@123',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /has been revoked/i);
        return true;
      }
    );
  });

  it('should prevent admin from revoking their own account', async () => {
    const req = {
      params: { id: adminUser._id.toString() },
      body: { reason: 'Self revocation attempt' },
      user: adminUser,
      ip: '127.0.0.1',
    };

    let responseData = null;
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    await adminController.revokeUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(statusCode, 400);
    assert.match(responseData.message, /cannot revoke your own administrator account/i);
  });
});
