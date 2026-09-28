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
    await User.deleteOne({ email: 'new_candidate@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    pendingUser = await User.findOne({ email: 'pending@uap.edu' });
  });

  after(async () => {
    await User.updateOne({ email: 'pending@uap.edu' }, { status: 'pending', isActive: false });
    await User.updateOne({ email: 'alice@uap.edu' }, { status: 'active', isActive: true });
    await User.deleteOne({ email: 'rejected_candidate@uap.edu' });
    await User.deleteOne({ email: 'new_candidate@uap.edu' });
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

  describe('Lifecycle Verification Suite: 6 Step Authentication Lifecycle', () => {
    let testCandidate;

    it('1. New registration -> pending status and isActive false', async () => {
      await User.deleteOne({ email: 'new_candidate@uap.edu' });
      const regResult = await authService.register({
        name: 'New Candidate',
        email: 'new_candidate@uap.edu',
        password: 'Password123!',
        role: 'student',
        instituteCode: 'TEST-2026',
      });

      assert.ok(regResult.user.id);
      assert.strictEqual(regResult.status, 'pending');
      assert.strictEqual(regResult.user.status, 'pending');
      assert.strictEqual(regResult.accessToken, undefined, 'Pending user must not receive access token');

      testCandidate = await User.findOne({ email: 'new_candidate@uap.edu' });
      assert.ok(testCandidate);
      assert.strictEqual(testCandidate.status, 'pending');
      assert.strictEqual(testCandidate.isActive, false);
    });

    it('2. Pending user -> cannot login (HTTP 403)', async () => {
      await assert.rejects(
        async () => {
          await authService.login({
            email: 'new_candidate@uap.edu',
            password: 'Password123!',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /pending administrator approval/i);
          return true;
        }
      );
    });

    it('3. Admin approval -> active (status = active, isActive = true)', async () => {
      const approveReq = {
        params: { id: testCandidate._id.toString() },
        body: { role: 'student' },
        user: adminUser,
        ip: '127.0.0.1',
      };

      let responseData = null;
      const approveRes = {
        status: () => approveRes,
        json: (data) => {
          responseData = data;
          return approveRes;
        },
      };

      await adminController.approveUser(approveReq, approveRes, (err) => {
        if (err) throw err;
      });

      assert.ok(responseData && responseData.success);
      const approved = await User.findById(testCandidate._id);
      assert.strictEqual(approved.status, 'active');
      assert.strictEqual(approved.isActive, true);
      assert.ok(approved.approvedAt);
      assert.strictEqual(approved.approvedBy.toString(), adminUser._id.toString());
    });

    it('4. Active user -> can login repeatedly without approval', async () => {
      // Login attempt 1
      const login1 = await authService.login({
        email: 'new_candidate@uap.edu',
        password: 'Password123!',
      });
      assert.ok(login1.accessToken, 'First login should return access token');
      assert.ok(login1.refreshToken, 'First login should return refresh token');
      assert.strictEqual(login1.user.status, 'active');
      assert.strictEqual(login1.user.isActive, true);
      assert.strictEqual(login1.user.role, 'student');

      // Login attempt 2 (immediate repeat, no approval requested)
      const login2 = await authService.login({
        email: 'new_candidate@uap.edu',
        password: 'Password123!',
      });
      assert.ok(login2.accessToken, 'Second login should return access token');
      assert.strictEqual(login2.user.status, 'active');
      assert.strictEqual(login2.user.isActive, true);

      // Login attempt 3
      const login3 = await authService.login({
        email: 'new_candidate@uap.edu',
        password: 'Password123!',
      });
      assert.ok(login3.accessToken, 'Third login should return access token');
      assert.strictEqual(login3.user.status, 'active');
      assert.strictEqual(login3.user.isActive, true);

      // Verify user document did not reset or generate approval workflow
      const verified = await User.findById(testCandidate._id);
      assert.strictEqual(verified.status, 'active');
      assert.strictEqual(verified.isActive, true);
    });

    it('5. Admin revoke -> user can no longer authenticate', async () => {
      const revokeReq = {
        params: { id: testCandidate._id.toString() },
        body: { reason: 'Violation of platform terms' },
        user: adminUser,
        ip: '127.0.0.1',
      };

      let responseData = null;
      const revokeRes = {
        status: () => revokeRes,
        json: (data) => {
          responseData = data;
          return revokeRes;
        },
      };

      await adminController.revokeUser(revokeReq, revokeRes, (err) => {
        if (err) throw err;
      });

      assert.ok(responseData && responseData.success);
      const revoked = await User.findById(testCandidate._id);
      assert.strictEqual(revoked.status, 'revoked');
      assert.strictEqual(revoked.isActive, false);
      assert.ok(revoked.revokedAt);
      assert.strictEqual(revoked.revokedBy.toString(), adminUser._id.toString());
      assert.strictEqual(revoked.rejectionReason, 'Violation of platform terms');

      // Authentication attempt must now be rejected
      await assert.rejects(
        async () => {
          await authService.login({
            email: 'new_candidate@uap.edu',
            password: 'Password123!',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /has been revoked/i);
          return true;
        }
      );
    });

    it('6. Existing admin/instructor/student demo accounts continue to work', async () => {
      const adminLogin = await authService.login({
        email: 'admin@uap.edu',
        password: 'Admin@123',
      });
      assert.ok(adminLogin.accessToken);
      assert.strictEqual(adminLogin.user.role, 'admin');
      assert.strictEqual(adminLogin.user.status, 'active');
      assert.strictEqual(adminLogin.user.isActive, true);

      const instructorLogin = await authService.login({
        email: 'instructor@uap.edu',
        password: 'Instructor@123',
      });
      assert.ok(instructorLogin.accessToken);
      assert.strictEqual(instructorLogin.user.role, 'instructor');
      assert.strictEqual(instructorLogin.user.status, 'active');
      assert.strictEqual(instructorLogin.user.isActive, true);

      const studentLogin = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      assert.ok(studentLogin.accessToken);
      assert.strictEqual(studentLogin.user.role, 'student');
      assert.strictEqual(studentLogin.user.status, 'active');
      assert.strictEqual(studentLogin.user.isActive, true);
    });
  });
});
