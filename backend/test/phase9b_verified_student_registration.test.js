const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, StudentRegistry, AuditLog, Notification } = require('../src/models');
const authService = require('../src/services/auth.service');
const adminController = require('../src/controllers/admin.controller');

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

describe('Phase 9B: Verified Student Registration & Institution Master Registry', () => {
  let adminUser;
  let instructorUser;
  let existingStudentUser;

  before(async () => {
    await connectDB();
    await seedDatabase();

    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    existingStudentUser = await User.findOne({ email: 'student@uap.edu' });
  });

  after(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // 1. Safe Normalization & Matching Logic
  // =========================================================================
  describe('1. Normalization & Authoritative Verification Utilities', () => {
    it('1.1 should normalize studentId by trimming and converting to uppercase', () => {
      assert.strictEqual(StudentRegistry.normalizeStudentId('  stu001  '), 'STU001');
      assert.strictEqual(StudentRegistry.normalizeStudentId('stu-2026-101'), 'STU-2026-101');
      assert.strictEqual(StudentRegistry.normalizeStudentId(null), '');
      assert.strictEqual(StudentRegistry.normalizeStudentId(''), '');
    });

    it('1.2 should normalize email by trimming and converting to lowercase', () => {
      assert.strictEqual(StudentRegistry.normalizeEmail('  Rahul@College.EDU  '), 'rahul@college.edu');
      assert.strictEqual(StudentRegistry.normalizeEmail(null), '');
    });

    it('1.3 should normalize name by trimming, collapsing spaces, and lowercasing for comparison', () => {
      assert.strictEqual(StudentRegistry.normalizeName('  Rahul   Kumar  '), 'rahul kumar');
      assert.strictEqual(StudentRegistry.normalizeName('rahul kumar'), 'rahul kumar');
      // Must NOT match abbreviations or partial names
      assert.notStrictEqual(StudentRegistry.normalizeName('Rahul Kumar'), StudentRegistry.normalizeName('Rahul K.'));
      assert.notStrictEqual(StudentRegistry.normalizeName('Rahul Kumar'), StudentRegistry.normalizeName('Rahul'));
    });

    it('1.4 should normalize date of birth across strings and Date objects to YYYY-MM-DD', () => {
      assert.strictEqual(StudentRegistry.normalizeDateOfBirth('2002-06-15'), '2002-06-15');
      assert.strictEqual(StudentRegistry.normalizeDateOfBirth('2002-6-5'), '2002-06-05');
      assert.strictEqual(
        StudentRegistry.normalizeDateOfBirth(new Date('2002-06-15T00:00:00.000Z')),
        '2002-06-15'
      );
      assert.strictEqual(StudentRegistry.normalizeDateOfBirth('invalid-date'), null);
      assert.strictEqual(StudentRegistry.normalizeDateOfBirth(null), null);
    });
  });

  // =========================================================================
  // 2. Matched Student Registration Flow (Automatic Activation)
  // =========================================================================
  describe('2. Matched Student Registration Flow', () => {
    const testStudent = {
      studentId: 'STU-REG-001',
      name: 'Aditi Sharma',
      dateOfBirth: '2002-04-18',
      email: 'aditi.sharma@institution.edu',
      status: 'active',
    };

    before(async () => {
      // Clean up any leftovers
      await User.deleteOne({ email: testStudent.email });
      await StudentRegistry.deleteOne({ studentId: testStudent.studentId });

      // Create authoritative record in StudentRegistry
      await StudentRegistry.create({
        studentId: testStudent.studentId,
        name: testStudent.name,
        dateOfBirth: new Date(testStudent.dateOfBirth),
        email: testStudent.email,
        status: 'active',
      });
    });

    after(async () => {
      await User.deleteOne({ email: testStudent.email });
      await StudentRegistry.deleteOne({ studentId: testStudent.studentId });
    });

    it('2.1 should automatically verify and activate account when all 4 fields match registry', async () => {
      const regResult = await authService.register({
        studentId: 'stu-reg-001', // test case-insensitivity & trimming
        name: '  Aditi   Sharma  ',
        dateOfBirth: '2002-04-18',
        email: 'ADITI.SHARMA@institution.edu',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'student',
      });

      assert.strictEqual(regResult.status, 'active');
      assert.strictEqual(regResult.verified, true);
      assert.strictEqual(regResult.user.role, 'student');
      assert.strictEqual(regResult.user.status, 'active');
      assert.strictEqual(regResult.user.studentId, 'STU-REG-001');

      // Verify in DB
      const dbUser = await User.findOne({ email: testStudent.email });
      assert.ok(dbUser);
      assert.strictEqual(dbUser.status, 'active');
      assert.strictEqual(dbUser.isActive, true);
      assert.strictEqual(dbUser.studentId, 'STU-REG-001');
      assert.ok(dbUser.approvedAt);

      // Verify Audit Log was recorded
      const log = await AuditLog.findOne({
        entityId: dbUser._id.toString(),
        action: 'USER_REGISTER_VERIFIED',
      });
      assert.ok(log);
      assert.strictEqual(log.details.verifiedViaRegistry, true);

      // Verify student in-app welcome notification was generated
      const notif = await Notification.findOne({
        userId: dbUser._id,
        title: 'Academic Identity Verified',
      });
      assert.ok(notif);
    });

    it('2.2 should allow verified student to immediately log in without admin approval', async () => {
      const loginResult = await authService.login({
        email: testStudent.email,
        password: 'Password@123',
      });

      assert.ok(loginResult.accessToken);
      assert.ok(loginResult.refreshToken);
      assert.strictEqual(loginResult.user.role, 'student');
      assert.strictEqual(loginResult.user.status, 'active');
      assert.strictEqual(loginResult.user.studentId, 'STU-REG-001');
    });

    it('2.3 should reject registration with duplicate email (409 Conflict)', async () => {
      await assert.rejects(
        async () => {
          await authService.register({
            studentId: 'STU-REG-999',
            name: 'Another Student',
            dateOfBirth: '2002-04-18',
            email: testStudent.email, // already used
            password: 'Password@123',
            role: 'student',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /already registered/i);
          return true;
        }
      );
    });

    it('2.4 should reject registration with duplicate studentId (409 Conflict)', async () => {
      await assert.rejects(
        async () => {
          await authService.register({
            studentId: testStudent.studentId, // already used
            name: 'Another Student',
            dateOfBirth: '2002-04-18',
            email: 'unique.candidate@uap.edu',
            password: 'Password@123',
            role: 'student',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /Student ID is already registered/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Non-Matched Student Flow & Identity Enumeration Protection
  // =========================================================================
  describe('3. Non-Matched Student Registration Flow (Pending Review)', () => {
    const masterRecord = {
      studentId: 'STU-REG-002',
      name: 'Rohan Mehta',
      dateOfBirth: '2003-08-25',
      email: 'rohan.mehta@institution.edu',
      status: 'active',
    };

    before(async () => {
      await StudentRegistry.deleteOne({ studentId: masterRecord.studentId });
      await StudentRegistry.create({
        studentId: masterRecord.studentId,
        name: masterRecord.name,
        dateOfBirth: new Date(masterRecord.dateOfBirth),
        email: masterRecord.email,
        status: 'active',
      });
    });

    after(async () => {
      await StudentRegistry.deleteOne({ studentId: masterRecord.studentId });
    });

    it('3.1 should fall back to pending review when studentId does not match (generic message, no enumeration)', async () => {
      const email = 'pending.mismatch.id@institution.edu';
      await User.deleteOne({ email });

      const regResult = await authService.register({
        studentId: 'WRONG-ID-999',
        name: masterRecord.name,
        dateOfBirth: masterRecord.dateOfBirth,
        email,
        password: 'Password@123',
        role: 'student',
      });

      assert.strictEqual(regResult.status, 'pending');
      assert.strictEqual(regResult.verified, false);
      assert.strictEqual(regResult.user.status, 'pending');
      // Generic message without revealing which field failed
      assert.match(regResult.message, /academic details could not be verified/i);
      assert.doesNotMatch(regResult.message, /student id/i);
      assert.doesNotMatch(regResult.message, /dob/i);

      // Verify user is in pending state in DB
      const dbUser = await User.findOne({ email });
      assert.strictEqual(dbUser.status, 'pending');
      assert.strictEqual(dbUser.isActive, false);

      // Pending user cannot log in
      await assert.rejects(
        async () => {
          await authService.login({ email, password: 'Password@123' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /pending administrator approval/i);
          return true;
        }
      );

      await User.deleteOne({ email });
    });

    it('3.2 should fall back to pending review when date of birth does not match', async () => {
      const email = 'pending.mismatch.dob@institution.edu';
      await User.deleteOne({ email });

      const regResult = await authService.register({
        studentId: masterRecord.studentId,
        name: masterRecord.name,
        dateOfBirth: '1999-01-01', // Incorrect DOB
        email: masterRecord.email,
        password: 'Password@123',
        role: 'student',
      });

      assert.strictEqual(regResult.status, 'pending');
      assert.strictEqual(regResult.verified, false);
      assert.match(regResult.message, /academic details could not be verified/i);

      await User.deleteOne({ email: masterRecord.email });
    });

    it('3.3 should fall back to pending review when name does not match', async () => {
      const email = 'pending.mismatch.name@institution.edu';
      await User.deleteOne({ email });

      const regResult = await authService.register({
        studentId: masterRecord.studentId,
        name: 'Rohan M.', // Abbreviation must NOT match
        dateOfBirth: masterRecord.dateOfBirth,
        email: masterRecord.email,
        password: 'Password@123',
        role: 'student',
      });

      assert.strictEqual(regResult.status, 'pending');
      assert.strictEqual(regResult.verified, false);

      await User.deleteOne({ email: masterRecord.email });
    });

    it('3.4 should fall back to pending review when registry record status is inactive', async () => {
      await StudentRegistry.updateOne({ studentId: masterRecord.studentId }, { status: 'inactive' });
      const email = masterRecord.email;
      await User.deleteOne({ email });

      const regResult = await authService.register({
        studentId: masterRecord.studentId,
        name: masterRecord.name,
        dateOfBirth: masterRecord.dateOfBirth,
        email: masterRecord.email,
        password: 'Password@123',
        role: 'student',
      });

      assert.strictEqual(regResult.status, 'pending');
      assert.strictEqual(regResult.verified, false);

      // Restore status
      await StudentRegistry.updateOne({ studentId: masterRecord.studentId }, { status: 'active' });
      await User.deleteOne({ email });
    });

    it('3.5 should allow administrator to manually approve the pending non-matched applicant', async () => {
      const email = 'pending.to.approve@institution.edu';
      await User.deleteOne({ email });

      const regResult = await authService.register({
        studentId: 'STU-UNVERIFIED-01',
        name: 'Unverified Candidate',
        dateOfBirth: '2001-12-12',
        email,
        password: 'Password@123',
        role: 'student',
      });

      assert.strictEqual(regResult.status, 'pending');

      // Admin approves applicant
      const req = {
        params: { id: regResult.user.id },
        body: { role: 'student' },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.approveUser(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      // Now student can log in
      const login = await authService.login({ email, password: 'Password@123' });
      assert.ok(login.accessToken);
      assert.strictEqual(login.user.status, 'active');

      await User.deleteOne({ email });
    });
  });

  // =========================================================================
  // 4. Password Confirmation Validation
  // =========================================================================
  describe('4. Password Confirmation Validation', () => {
    it('4.1 should reject registration when password and confirmPassword do not match (400)', async () => {
      await assert.rejects(
        async () => {
          await authService.register({
            studentId: 'STU-TEST-PASS',
            name: 'Test Candidate',
            dateOfBirth: '2002-01-01',
            email: 'password.mismatch@uap.edu',
            password: 'CorrectPassword123',
            confirmPassword: 'MismatchPassword999',
            role: 'student',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /passwords do not match/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. Admin Student Registry Management APIs
  // =========================================================================
  describe('5. Admin Student Registry Management Endpoints', () => {
    let createdRecordId;

    it('5.1 should allow admin to create a new master registry record', async () => {
      const req = {
        body: {
          studentId: 'STU-API-101',
          name: 'Pooja Verma',
          dateOfBirth: '2003-05-15',
          email: 'pooja.verma@college.edu',
          status: 'active',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.createStudentRegistryRecord(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.responseData.success, true);
      assert.strictEqual(res.responseData.data.studentId, 'STU-API-101');
      assert.strictEqual(res.responseData.data.email, 'pooja.verma@college.edu');

      createdRecordId = res.responseData.data._id.toString();
    });

    it('5.2 should reject duplicate studentId in master registry (409 Conflict)', async () => {
      const req = {
        body: {
          studentId: 'STU-API-101', // duplicate
          name: 'Another Student',
          dateOfBirth: '2003-05-15',
          email: 'another.unique@college.edu',
          status: 'active',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.createStudentRegistryRecord(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.responseData.success, false);
      assert.match(res.responseData.message, /Student ID already exists/i);
    });

    it('5.3 should reject duplicate email in master registry (409 Conflict)', async () => {
      const req = {
        body: {
          studentId: 'STU-API-999',
          name: 'Another Student',
          dateOfBirth: '2003-05-15',
          email: 'pooja.verma@college.edu', // duplicate email
          status: 'active',
        },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.createStudentRegistryRecord(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 409);
      assert.match(res.responseData.message, /Email already exists/i);
    });

    it('5.4 should retrieve paginated master registry list with search filter', async () => {
      const req = {
        query: { search: 'pooja', page: 1, limit: 10 },
        user: adminUser,
      };
      const res = mockResponse();

      await adminController.getStudentRegistry(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.some((r) => r.studentId === 'STU-API-101'));
    });

    it('5.5 should retrieve single master registry record by ID', async () => {
      const req = {
        params: { id: createdRecordId },
        user: adminUser,
      };
      const res = mockResponse();

      await adminController.getStudentRegistryRecordById(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.studentId, 'STU-API-101');
    });

    it('5.6 should update master registry record', async () => {
      const req = {
        params: { id: createdRecordId },
        body: { status: 'graduated' },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.updateStudentRegistryRecord(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.status, 'graduated');
    });

    it('5.7 should delete master registry record', async () => {
      const req = {
        params: { id: createdRecordId },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.deleteStudentRegistryRecord(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      // Verify deletion
      const check = await StudentRegistry.findById(createdRecordId);
      assert.strictEqual(check, null);
    });
  });
});
