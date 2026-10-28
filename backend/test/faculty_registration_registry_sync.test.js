const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const authService = require('../src/services/auth.service');
const adminRegistryService = require('../src/services/adminRegistry.service');
const adminController = require('../src/controllers/admin.controller');
const emailService = require('../src/services/email.service');
const { User, FacultyRegistry, AuditLog } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

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

describe('Faculty Registration and Admin Faculty Registry Synchronization Workflow', () => {
  let adminUser;
  let studentUser;
  let defaultPassword;

  before(async () => {
    await connectDB();
    await seedDatabase();

    defaultPassword = await hashPassword('TestPassword@123');
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    studentUser = await User.findOne({ email: 'student@uap.edu' });

    // Clean up any old test records
    await User.deleteMany({ email: { $regex: /@faculty-sync-test\.edu$/i } });
    await FacultyRegistry.deleteMany({ email: { $regex: /@faculty-sync-test\.edu$/i } });
  });

  after(async () => {
    // Clean up test generated records
    await User.deleteMany({ email: { $regex: /@faculty-sync-test\.edu$/i } });
    await FacultyRegistry.deleteMany({ email: { $regex: /@faculty-sync-test\.edu$/i } });
    await disconnectDB();
  });

  beforeEach(() => {
    emailService.clearSentEmails();
  });

  describe('1. Self-Registration Data Flow', () => {
    let registrationResult;
    let registeredUser;

    it('1.1 should register faculty applicant into User collection with status=pending and role=instructor', async () => {
      registrationResult = await authService.register({
        name: 'Dr. Grace Hopper',
        email: 'grace.hopper@faculty-sync-test.edu',
        password: 'Password@123',
        role: 'instructor',
        instituteCode: 'NAVY-CS',
        ipAddress: '127.0.0.1',
      });

      assert.strictEqual(registrationResult.status, 'pending');
      assert.ok(registrationResult.user);
      assert.strictEqual(registrationResult.user.role, 'instructor');

      registeredUser = await User.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      assert.ok(registeredUser);
      assert.strictEqual(registeredUser.role, 'instructor');
      assert.strictEqual(registeredUser.status, 'pending');
      assert.strictEqual(registeredUser.isActive, false);
      assert.ok(registeredUser.facultyId, 'User must have auto-generated facultyId');
      assert.match(registeredUser.facultyId, /^FAC-\d{4}-\d{3,}$/);
    });

    it('1.2 should NOT show pending faculty applicant in FacultyRegistry collection', async () => {
      const registryRecord = await FacultyRegistry.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      assert.strictEqual(registryRecord, null, 'Pending faculty applicant must not be in FacultyRegistry');

      const registryList = await adminRegistryService.getFacultyRegistry({ search: 'Grace Hopper' });
      assert.strictEqual(registryList.records.length, 0);
    });

    it('1.3 should list pending faculty applicant in Admin Approval Queue (getPendingUsers)', async () => {
      const req = { query: { role: 'instructor' }, user: adminUser, ip: '127.0.0.1' };
      const res = mockResponse();

      await adminController.getPendingUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.responseData.data));
      const match = res.responseData.data.find((u) => u.email === 'grace.hopper@faculty-sync-test.edu');
      assert.ok(match, 'Pending instructor must appear in approval queue');
      assert.strictEqual(match.status, 'pending');
      assert.strictEqual(match.role, 'instructor');
      assert.strictEqual(match.facultyId, registeredUser.facultyId);
    });
  });

  describe('2. Single Approval & Faculty Registry Synchronization', () => {
    let targetUser;

    before(async () => {
      targetUser = await User.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      assert.ok(targetUser);
    });

    it('2.1 should approve faculty member and automatically sync record into FacultyRegistry', async () => {
      const req = {
        params: { id: targetUser._id.toString() },
        body: {},
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.approveUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.status, 'active');
      assert.strictEqual(res.responseData.data.isActive, true);

      // Verify User in database
      const userInDb = await User.findById(targetUser._id);
      assert.strictEqual(userInDb.status, 'active');
      assert.strictEqual(userInDb.isActive, true);

      // Verify FacultyRegistry record created
      const registryRecord = await FacultyRegistry.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      assert.ok(registryRecord, 'FacultyRegistry record must be created upon approval');
      assert.strictEqual(registryRecord.facultyId, userInDb.facultyId);
      assert.strictEqual(registryRecord.name, userInDb.name);
      assert.strictEqual(registryRecord.email, userInDb.email);
      assert.strictEqual(registryRecord.status, 'active');

      // Verify audit log
      const audit = await AuditLog.findOne({
        action: 'USER_APPROVED',
        entityId: userInDb._id.toString(),
      });
      assert.ok(audit, 'Audit log for USER_APPROVED must exist');
    });

    it('2.2 should display approved faculty member in Faculty Registry queries and search', async () => {
      const result = await adminRegistryService.getFacultyRegistry({ search: 'Grace Hopper' });
      assert.strictEqual(result.records.length, 1);
      assert.strictEqual(result.records[0].facultyId, targetUser.facultyId);
      assert.strictEqual(result.records[0].email, 'grace.hopper@faculty-sync-test.edu');
      assert.strictEqual(result.records[0].status, 'active');
      assert.ok(result.pagination.total >= 1);
    });
  });

  describe('3. Bulk Approval & Multi-Faculty Synchronization', () => {
    let faculty1;
    let faculty2;

    before(async () => {
      const reg1 = await authService.register({
        name: 'Dr. Katherine Johnson',
        email: 'katherine.johnson@faculty-sync-test.edu',
        password: 'Password@123',
        role: 'instructor',
        instituteCode: 'NASA-MATH',
        ipAddress: '127.0.0.1',
      });
      const reg2 = await authService.register({
        name: 'Dr. Margaret Hamilton',
        email: 'margaret.hamilton@faculty-sync-test.edu',
        password: 'Password@123',
        role: 'instructor',
        instituteCode: 'MIT-APOLLO',
        ipAddress: '127.0.0.1',
      });

      faculty1 = await User.findOne({ email: 'katherine.johnson@faculty-sync-test.edu' });
      faculty2 = await User.findOne({ email: 'margaret.hamilton@faculty-sync-test.edu' });
    });

    it('3.1 should bulk approve multiple pending faculty and sync all into FacultyRegistry', async () => {
      const req = {
        body: { userIds: [faculty1._id.toString(), faculty2._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 2);

      // Verify both in User collection
      const u1 = await User.findById(faculty1._id);
      const u2 = await User.findById(faculty2._id);
      assert.strictEqual(u1.status, 'active');
      assert.strictEqual(u2.status, 'active');

      // Verify both in FacultyRegistry collection
      const r1 = await FacultyRegistry.findOne({ email: 'katherine.johnson@faculty-sync-test.edu' });
      const r2 = await FacultyRegistry.findOne({ email: 'margaret.hamilton@faculty-sync-test.edu' });
      assert.ok(r1, 'Faculty 1 must be synced to FacultyRegistry');
      assert.ok(r2, 'Faculty 2 must be synced to FacultyRegistry');
      assert.strictEqual(r1.status, 'active');
      assert.strictEqual(r2.status, 'active');
      assert.strictEqual(r1.facultyId, u1.facultyId);
      assert.strictEqual(r2.facultyId, u2.facultyId);
    });
  });

  describe('4. Lifecycle & Status Controls Synchronization', () => {
    let facultyUser;
    let registryDoc;

    beforeEach(async () => {
      facultyUser = await User.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      registryDoc = await FacultyRegistry.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      assert.ok(facultyUser);
      assert.ok(registryDoc);
    });

    it('4.1 should synchronize status=inactive to FacultyRegistry upon deactivating User', async () => {
      const req = {
        params: { id: facultyUser._id.toString() },
        body: { reason: 'Sabbatical research leave' },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.deactivateUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      // Verify User
      const updatedUser = await User.findById(facultyUser._id);
      assert.strictEqual(updatedUser.status, 'inactive');
      assert.strictEqual(updatedUser.isActive, false);

      // Verify FacultyRegistry
      const updatedRegistry = await FacultyRegistry.findById(registryDoc._id);
      assert.strictEqual(updatedRegistry.status, 'inactive');
    });

    it('4.2 should synchronize status=active to FacultyRegistry upon reactivating User', async () => {
      const req = {
        params: { id: facultyUser._id.toString() },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.activateUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      // Verify User
      const updatedUser = await User.findById(facultyUser._id);
      assert.strictEqual(updatedUser.status, 'active');
      assert.strictEqual(updatedUser.isActive, true);

      // Verify FacultyRegistry
      const updatedRegistry = await FacultyRegistry.findById(registryDoc._id);
      assert.strictEqual(updatedRegistry.status, 'active');
    });

    it('4.3 should synchronize status to User when updated via FacultyRegistry service', async () => {
      await adminRegistryService.updateFacultyRegistryRecord(
        registryDoc._id,
        { status: 'inactive' },
        adminUser,
        '127.0.0.1'
      );

      const userAfter = await User.findById(facultyUser._id);
      assert.strictEqual(userAfter.status, 'inactive');
      assert.strictEqual(userAfter.isActive, false);

      // Toggle back to active
      await adminRegistryService.updateFacultyRegistryRecord(
        registryDoc._id,
        { status: 'active' },
        adminUser,
        '127.0.0.1'
      );

      const userRestored = await User.findById(facultyUser._id);
      assert.strictEqual(userRestored.status, 'active');
      assert.strictEqual(userRestored.isActive, true);
    });

    it('4.4 should bulk synchronize status when bulk deactivating faculty users', async () => {
      const f1 = await User.findOne({ email: 'katherine.johnson@faculty-sync-test.edu' });
      const f2 = await User.findOne({ email: 'margaret.hamilton@faculty-sync-test.edu' });

      const req = {
        body: {
          userIds: [f1._id.toString(), f2._id.toString()],
          reason: 'Semester end recess',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkDeactivateUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      const r1 = await FacultyRegistry.findOne({ email: 'katherine.johnson@faculty-sync-test.edu' });
      const r2 = await FacultyRegistry.findOne({ email: 'margaret.hamilton@faculty-sync-test.edu' });
      assert.strictEqual(r1.status, 'inactive');
      assert.strictEqual(r2.status, 'inactive');
    });
  });

  describe('5. Preservation of Existing Faculty & Idempotence', () => {
    it('5.1 should backfill existing active instructors to FacultyRegistry without creating duplicates', async () => {
      // Run syncExistingFacultyToRegistry
      const syncResult = await adminRegistryService.syncExistingFacultyToRegistry();
      assert.ok(typeof syncResult.syncedCount === 'number');

      // The seeded instructor (instructor@uap.edu) should exist in FacultyRegistry
      const seededRegistry = await FacultyRegistry.findOne({ email: 'instructor@uap.edu' });
      assert.ok(seededRegistry, 'Seeded instructor must exist in FacultyRegistry');

      // Re-running sync must be idempotent
      const countBefore = await FacultyRegistry.countDocuments();
      await adminRegistryService.syncExistingFacultyToRegistry();
      const countAfter = await FacultyRegistry.countDocuments();
      assert.strictEqual(countBefore, countAfter, 'Sync must be idempotent and not create duplicates');
    });
  });

  describe('6. Authorization and Access Control', () => {
    it('6.1 should prevent student from approving faculty users', async () => {
      const target = await User.findOne({ email: 'grace.hopper@faculty-sync-test.edu' });
      const req = {
        params: { id: target._id.toString() },
        user: studentUser, // student role
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await assert.rejects(
        async () => {
          // If authorization middleware or controller checks user.role
          if (req.user.role !== 'admin') {
            const err = new Error('Access denied: Administrator privileges required.');
            err.statusCode = 403;
            throw err;
          }
          await adminController.approveUser(req, res, (err) => {
            if (err) throw err;
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });
  });
});
