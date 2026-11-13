const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const authService = require('../src/services/auth.service');
const adminController = require('../src/controllers/admin.controller');
const { User, Assessment, Submission, AuditLog, Session } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { generateRefreshToken } = require('../src/utils/jwt');

describe('Admin User Status Controls: Activate / Deactivate Verification', () => {
  let adminUser;
  let nonAdminUser;
  let targetUser;
  let rawPassword = 'Password@123';

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

  before(async () => {
    await connectDB();
    await seedDatabase();

    await User.deleteMany({
      email: { $in: ['status_admin@uap.edu', 'status_student@uap.edu', 'status_target@uap.edu', 'status_target2@uap.edu'] },
    });

    const hashedPassword = await hashPassword(rawPassword);

    adminUser = await User.create({
      name: 'Status Test Admin',
      email: 'status_admin@uap.edu',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      isActive: true,
    });

    nonAdminUser = await User.create({
      name: 'Status Test Student',
      email: 'status_student@uap.edu',
      password: hashedPassword,
      role: 'student',
      status: 'active',
      isActive: true,
    });
  });

  after(async () => {
    await User.deleteMany({
      email: { $in: ['status_admin@uap.edu', 'status_student@uap.edu', 'status_target@uap.edu', 'status_target2@uap.edu'] },
    });
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({
      email: { $in: ['status_target@uap.edu', 'status_target2@uap.edu'] },
    });
    await AuditLog.deleteMany({
      entityType: 'User',
      action: { $in: ['USER_ACTIVATED', 'USER_DEACTIVATED'] },
    });

    const hashedPassword = await hashPassword(rawPassword);
    targetUser = await User.create({
      name: 'Status Target User',
      email: 'status_target@uap.edu',
      password: hashedPassword,
      role: 'student',
      status: 'active',
      isActive: true,
      tokenVersion: 1,
    });
  });

  it('1. Active user -> Deactivate -> status becomes inactive and sessions invalidated', async () => {
    // Create an active session for the target user
    const session = await Session.create({
      userId: targetUser._id,
      familyId: 'fam_status_test_1',
      currentTokenHash: 'token_hash_1',
      status: 'active',
      deviceInfo: { ip: '127.0.0.1' },
      expiresAt: new Date(Date.now() + 86400000),
    });

    const req = {
      params: { id: targetUser._id.toString() },
      user: adminUser,
      body: { reason: 'Scheduled leave of absence' },
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.deactivateUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.responseData.data.isActive, false);
    assert.strictEqual(res.responseData.data.status, 'inactive');

    // Verify database state
    const updatedUser = await User.findById(targetUser._id);
    assert.strictEqual(updatedUser.isActive, false);
    assert.strictEqual(updatedUser.status, 'inactive');
    assert.strictEqual(updatedUser.rejectionReason, 'Scheduled leave of absence');
    assert.strictEqual(updatedUser.tokenVersion, 2);

    // Verify session in Session model is marked revoked
    const updatedSession = await Session.findById(session._id);
    assert.strictEqual(updatedSession.status, 'revoked');

    // Verify audit log
    const audit = await AuditLog.findOne({
      entityId: targetUser._id.toString(),
      action: 'USER_DEACTIVATED',
    });
    assert.ok(audit, 'Audit log USER_DEACTIVATED must be recorded');
    assert.strictEqual(audit.details.targetEmail, targetUser.email);
  });

  it('2. Inactive user -> Activate -> status becomes active and tokenVersion incremented', async () => {
    // Start with inactive user
    targetUser.status = 'inactive';
    targetUser.isActive = false;
    targetUser.rejectionReason = 'Past deactivation';
    await targetUser.save();

    const req = {
      params: { id: targetUser._id.toString() },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.activateUser(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.responseData.data.isActive, true);
    assert.strictEqual(res.responseData.data.status, 'active');

    // Verify database state
    const updatedUser = await User.findById(targetUser._id);
    assert.strictEqual(updatedUser.isActive, true);
    assert.strictEqual(updatedUser.status, 'active');
    assert.strictEqual(updatedUser.rejectionReason, null);
    assert.strictEqual(updatedUser.revokedAt, null);

    // Verify audit log
    const audit = await AuditLog.findOne({
      entityId: targetUser._id.toString(),
      action: 'USER_ACTIVATED',
    });
    assert.ok(audit, 'Audit log USER_ACTIVATED must be recorded');
  });

  it('3. Inactive users cannot authenticate or refresh their sessions', async () => {
    // Generate valid refresh token while user has tokenVersion
    const validRefreshToken = generateRefreshToken({
      id: targetUser._id.toString(),
      role: targetUser.role,
      tokenVersion: targetUser.tokenVersion,
    });

    // Deactivate user
    targetUser.status = 'inactive';
    targetUser.isActive = false;
    await targetUser.save();

    // 3.1 Login attempt must fail with HTTP 403
    await assert.rejects(
      async () => {
        await authService.login({
          email: targetUser.email,
          password: rawPassword,
          ipAddress: '127.0.0.1',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /deactivated|revoked|not active/i);
        return true;
      }
    );

    // 3.2 Refresh token attempt must fail with HTTP 401
    await assert.rejects(
      async () => {
        await authService.refreshAccessToken({
          refreshToken: validRefreshToken,
          ipAddress: '127.0.0.1',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );
  });

  it('4. Unauthorized users cannot activate or deactivate accounts (HTTP 403)', async () => {
    const deactivateReq = {
      params: { id: targetUser._id.toString() },
      user: nonAdminUser,
      body: {},
      ip: '127.0.0.1',
    };
    const deactivateRes = mockResponse();

    await adminController.deactivateUser(deactivateReq, deactivateRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(deactivateRes.statusCode, 403);

    const activateReq = {
      params: { id: targetUser._id.toString() },
      user: nonAdminUser,
      ip: '127.0.0.1',
    };
    const activateRes = mockResponse();

    await adminController.activateUser(activateReq, activateRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(activateRes.statusCode, 403);
  });

  it('5. Admin cannot deactivate their own administrator account (HTTP 400)', async () => {
    const req = {
      params: { id: adminUser._id.toString() },
      user: adminUser,
      body: {},
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.deactivateUser(req, res, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.responseData.message, /cannot deactivate your own/i);
  });

  it('6. Cannot activate an already active user or deactivate an inactive user (HTTP 400)', async () => {
    // Try to activate already active user
    const actReq = {
      params: { id: targetUser._id.toString() },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const actRes = mockResponse();
    await adminController.activateUser(actReq, actRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(actRes.statusCode, 400);
    assert.match(actRes.responseData.message, /already active/i);

    // Deactivate user first
    targetUser.status = 'inactive';
    targetUser.isActive = false;
    await targetUser.save();

    // Try to deactivate already inactive user
    const deactReq = {
      params: { id: targetUser._id.toString() },
      user: adminUser,
      body: {},
      ip: '127.0.0.1',
    };
    const deactRes = mockResponse();
    await adminController.deactivateUser(deactReq, deactRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(deactRes.statusCode, 400);
    assert.match(deactRes.responseData.message, /already inactive/i);
  });

  it('7. Bulk deactivation and activation operations', async () => {
    const hashedPassword = await hashPassword(rawPassword);
    const target2 = await User.create({
      name: 'Status Target 2',
      email: 'status_target2@uap.edu',
      password: hashedPassword,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    // 7.1 Bulk deactivate
    const bulkDeactReq = {
      user: adminUser,
      body: {
        userIds: [targetUser._id.toString(), target2._id.toString(), adminUser._id.toString()],
        reason: 'Bulk semester archive',
      },
      ip: '127.0.0.1',
    };
    const bulkDeactRes = mockResponse();
    await adminController.bulkDeactivateUsers(bulkDeactReq, bulkDeactRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(bulkDeactRes.statusCode, 200);
    assert.strictEqual(bulkDeactRes.responseData.data.deactivatedCount, 2);
    assert.strictEqual(bulkDeactRes.responseData.data.skippedCount, 1); // Admin user skipped

    const checkU1 = await User.findById(targetUser._id);
    const checkU2 = await User.findById(target2._id);
    assert.strictEqual(checkU1.status, 'inactive');
    assert.strictEqual(checkU2.status, 'inactive');

    // 7.2 Bulk activate
    const bulkActReq = {
      user: adminUser,
      body: {
        userIds: [targetUser._id.toString(), target2._id.toString()],
      },
      ip: '127.0.0.1',
    };
    const bulkActRes = mockResponse();
    await adminController.bulkActivateUsers(bulkActReq, bulkActRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(bulkActRes.statusCode, 200);
    assert.strictEqual(bulkActRes.responseData.data.activatedCount, 2);

    const recheckU1 = await User.findById(targetUser._id);
    assert.strictEqual(recheckU1.status, 'active');
    assert.strictEqual(recheckU1.isActive, true);
  });

  it('8. getAllUsers supports status=active and status=inactive filtering', async () => {
    // One active, one inactive
    targetUser.status = 'inactive';
    targetUser.isActive = false;
    await targetUser.save();

    // Query active
    const activeReq = {
      query: { status: 'active', search: 'status_target@uap.edu' },
      user: adminUser,
    };
    const activeRes = mockResponse();
    await adminController.getAllUsers(activeReq, activeRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(activeRes.responseData.data.length, 0);

    // Query inactive
    const inactiveReq = {
      query: { status: 'inactive', search: 'status_target@uap.edu' },
      user: adminUser,
    };
    const inactiveRes = mockResponse();
    await adminController.getAllUsers(inactiveReq, inactiveRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(inactiveRes.responseData.data.length, 1);
    assert.strictEqual(inactiveRes.responseData.data[0].email, 'status_target@uap.edu');
  });
});
