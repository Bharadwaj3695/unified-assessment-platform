const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const authService = require('../src/services/auth.service');
const adminController = require('../src/controllers/admin.controller');
const { User, Assessment, Question, Submission, AuditLog, SystemSetting } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Phase H Verification: Admin Platform Oversight & System Settings', () => {
  let adminUser;
  let instructorUser;
  let studentUser;
  let targetUser;
  let testAssessment;

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

    // Ensure clean state
    await User.deleteMany({
      email: { $in: ['target.h@uap.edu', 'closed-reg.h@uap.edu', 'revoked-test.h@uap.edu'] },
    });
    await Assessment.deleteMany({ title: 'Platform Oversight Test Assessment' });

    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    studentUser = await User.findOne({ email: 'student@uap.edu' });

    const pass = await hashPassword('Password123');

    targetUser = await User.create({
      name: 'Oversight Target User',
      email: 'target.h@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
      instituteCode: 'INST-H-001',
    });

    testAssessment = await Assessment.create({
      title: 'Platform Oversight Test Assessment',
      category: 'Governance',
      instructorId: instructorUser._id,
      durationMinutes: 30,
      totalPoints: 20,
      passingScore: 65,
      status: 'published',
      accessType: 'public',
    });

    // Reset settings to default
    await SystemSetting.deleteMany({});
    await SystemSetting.create({
      platformName: 'Unified Assessment Platform',
      registrationOpen: true,
      maintenanceMode: false,
      defaultPassingScore: 60,
      enableEmailNotifications: true,
      maxAttemptDurationHours: 4,
      supportEmail: 'support@uap.edu',
      allowStudentReview: true,
    });
  });

  after(async () => {
    await User.deleteMany({
      email: { $in: ['target.h@uap.edu', 'closed-reg.h@uap.edu', 'revoked-test.h@uap.edu'] },
    });
    if (testAssessment) {
      await Assessment.deleteOne({ _id: testAssessment._id });
    }
    await SystemSetting.deleteMany({});
    await SystemSetting.create({
      platformName: 'Unified Assessment Platform',
      registrationOpen: true,
      maintenanceMode: false,
      defaultPassingScore: 60,
      enableEmailNotifications: true,
      maxAttemptDurationHours: 4,
      supportEmail: 'support@uap.edu',
      allowStudentReview: true,
    });
    await disconnectDB();
  });

  it('1. Admin dashboard stats returns complete operational telemetry', async () => {
    const req = { user: adminUser };
    const res = mockResponse();

    await adminController.getDashboardStats(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    const data = res.responseData.data;
    assert.ok(data);
    assert.ok(typeof data.totalUsers === 'number' && data.totalUsers > 0);
    assert.ok(typeof data.totalStudents === 'number');
    assert.ok(typeof data.totalInstructors === 'number');
    assert.ok(typeof data.totalAdmins === 'number');
    assert.ok(typeof data.activeUsersCount === 'number');
    assert.ok(typeof data.totalAssessments === 'number');
    assert.ok(typeof data.publishedAssessments === 'number');
    assert.ok(typeof data.passRate === 'number');
    assert.ok(Array.isArray(data.recentLogs));
    assert.ok(typeof data.suspiciousEventsCount === 'number');
  });

  it('2. Admin can list users with role and status filtering', async () => {
    const req = {
      query: { role: 'student', search: 'target.h@uap.edu' },
      user: adminUser,
    };
    const res = mockResponse();

    await adminController.getAllUsers(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    const users = res.responseData.data;
    assert.ok(Array.isArray(users));
    assert.ok(users.some((u) => u.email === 'target.h@uap.edu'));
  });

  it('3. Admin can toggle user active status and audit log is recorded', async () => {
    const req = {
      params: { id: targetUser._id.toString() },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    // Deactivate user
    await adminController.toggleUserStatus(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.responseData.data.isActive, false);
    assert.strictEqual(res.responseData.data.status, 'revoked');

    const updatedUser = await User.findById(targetUser._id);
    assert.strictEqual(updatedUser.isActive, false);

    // Verify audit log
    const audit = await AuditLog.findOne({
      entityId: targetUser._id.toString(),
      action: 'USER_DEACTIVATED',
    });
    assert.ok(audit, 'Audit log USER_DEACTIVATED should be created');

    // Reactivate user
    const reactivateRes = mockResponse();
    await adminController.toggleUserStatus(req, reactivateRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(reactivateRes.statusCode, 200);
    assert.strictEqual(reactivateRes.responseData.data.isActive, true);
    assert.strictEqual(reactivateRes.responseData.data.status, 'active');
  });

  it('4. Admin cannot deactivate their own account (HTTP 400)', async () => {
    const req = {
      params: { id: adminUser._id.toString() },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const res = mockResponse();

    await adminController.toggleUserStatus(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.responseData.message, /cannot deactivate your own account/i);
  });

  it('5. Admin assessment oversight: retrieve all assessments and moderate status', async () => {
    // 1. Get all assessments
    const getReq = { query: { search: 'Platform Oversight Test' }, user: adminUser };
    const getRes = mockResponse();
    await adminController.getAllAssessments(getReq, getRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(getRes.statusCode, 200);
    const list = getRes.responseData.data;
    assert.ok(list.length > 0);
    assert.strictEqual(list[0].title, 'Platform Oversight Test Assessment');

    // 2. Admin moderates assessment: archive it
    const updateReq = {
      params: { id: testAssessment._id.toString() },
      body: { status: 'archived' },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const updateRes = mockResponse();
    await adminController.updateAssessmentStatus(updateReq, updateRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(updateRes.statusCode, 200);
    const updated = await Assessment.findById(testAssessment._id);
    assert.strictEqual(updated.status, 'archived');

    // 3. Reject invalid status
    const badReq = {
      params: { id: testAssessment._id.toString() },
      body: { status: 'invalid_status' },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const badRes = mockResponse();
    await adminController.updateAssessmentStatus(badReq, badRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(badRes.statusCode, 400);
  });

  it('6. System settings: retrieve and persist settings in MongoDB with audit trail', async () => {
    // 1. Get settings
    const getReq = { user: adminUser };
    const getRes = mockResponse();
    await adminController.getSettings(getReq, getRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.responseData.data.platformName, 'Unified Assessment Platform');

    // 2. Update settings
    const updateReq = {
      body: {
        platformName: 'UAP Enterprise Global',
        defaultPassingScore: 70,
        announcementBanner: 'Scheduled maintenance on Sunday 02:00 UTC',
        maintenanceMode: false,
      },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const updateRes = mockResponse();
    await adminController.updateSettings(updateReq, updateRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.responseData.data.platformName, 'UAP Enterprise Global');
    assert.strictEqual(updateRes.responseData.data.defaultPassingScore, 70);

    // Verify persistence in MongoDB
    const persisted = await SystemSetting.findOne();
    assert.strictEqual(persisted.platformName, 'UAP Enterprise Global');
    assert.strictEqual(persisted.defaultPassingScore, 70);
    assert.strictEqual(persisted.announcementBanner, 'Scheduled maintenance on Sunday 02:00 UTC');

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'SETTINGS_UPDATED' }).sort({ createdAt: -1 });
    assert.ok(audit);
    assert.strictEqual(audit.entityType, 'SystemSetting');
  });

  it('7. Enforcement: closing registration blocks new signups via AuthService', async () => {
    // Turn registration off
    await SystemSetting.updateOne({}, { registrationOpen: false });

    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Blocked Applicant',
          email: 'closed-reg.h@uap.edu',
          password: 'Password123',
          role: 'student',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /registration is currently closed/i);
        return true;
      }
    );

    // Re-open registration
    await SystemSetting.updateOne({}, { registrationOpen: true });

    // Should now succeed
    const successReg = await authService.register({
      name: 'Allowed Applicant',
      email: 'closed-reg.h@uap.edu',
      password: 'Password123',
      role: 'student',
    });
    assert.strictEqual(successReg.status, 'pending');
  });

  it('8. Suspicious activity & operational alerts track security events', async () => {
    // 1. Trigger failed login with non-existent user
    await assert.rejects(async () => {
      await authService.login({
        email: 'nonexistent-user-h@uap.edu',
        password: 'RandomPassword!',
        ipAddress: '192.168.1.50',
      });
    });

    // 2. Trigger failed login with wrong password
    await assert.rejects(async () => {
      await authService.login({
        email: 'student@uap.edu',
        password: 'IncorrectPassword999',
        ipAddress: '192.168.1.51',
      });
    });

    // 3. Trigger revoked user login attempt
    const pass = await hashPassword('Password123');
    await User.deleteOne({ email: 'revoked-test.h@uap.edu' });
    await User.create({
      name: 'Revoked Security Test User',
      email: 'revoked-test.h@uap.edu',
      password: pass,
      role: 'student',
      status: 'revoked',
      isActive: false,
    });

    await assert.rejects(async () => {
      await authService.login({
        email: 'revoked-test.h@uap.edu',
        password: 'Password123',
        ipAddress: '192.168.1.52',
      });
    });

    // 4. Query operational alerts endpoint
    const req = { user: adminUser };
    const res = mockResponse();
    await adminController.getOperationalAlerts(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    const data = res.responseData.data;
    assert.ok(data);
    assert.ok(Array.isArray(data.alerts));
    assert.ok(data.summary.failedLoginsCount >= 2);
    assert.ok(data.summary.revokedAttemptsCount >= 1);

    const matchRevokedAlert = data.alerts.find(
      (a) => a.action === 'REVOKED_USER_LOGIN_ATTEMPT' && a.details?.email === 'revoked-test.h@uap.edu'
    );
    assert.ok(matchRevokedAlert, 'Revoked user attempt should be captured in alerts');
    assert.strictEqual(matchRevokedAlert.ipAddress, '192.168.1.52');
  });

  it('9. Audit logs endpoint returns paginated entries with action filter', async () => {
    const req = {
      query: { action: 'SETTINGS_UPDATED', page: 1, limit: 10 },
      user: adminUser,
    };
    const res = mockResponse();

    await adminController.getLogs(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.responseData.data));
    assert.ok(res.responseData.data.length > 0);
    assert.strictEqual(res.responseData.data[0].action, 'SETTINGS_UPDATED');
    assert.ok(res.responseData.pagination);
    assert.strictEqual(res.responseData.pagination.currentPage, 1);
  });
});
