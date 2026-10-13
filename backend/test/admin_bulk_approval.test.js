const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const emailService = require('../src/services/email.service');
const adminController = require('../src/controllers/admin.controller');
const { User, Notification, AuditLog } = require('../src/models');
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

describe('Admin Pending Registration Queue: Search, Filter & Bulk Approval Tests', () => {
  let adminUser;
  let instructorUser;
  let studentUser;
  let defaultPassword;

  before(async () => {
    await connectDB();
    await seedDatabase();

    defaultPassword = await hashPassword('Password123!');
    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    studentUser = await User.findOne({ email: 'student@uap.edu' });
  });

  after(async () => {
    // Clean up all test created users
    await User.deleteMany({
      email: { $regex: /@bulk-test-uap\.edu$/i },
    });
    await disconnectDB();
  });

  beforeEach(async () => {
    emailService.clearSentEmails();
  });

  // =========================================================================
  // 1. Search and Role Filter on Backend Queue
  // =========================================================================
  describe('Backend getPendingUsers Search & Filter', () => {
    let pendingStudentA;
    let pendingFacultyB;

    before(async () => {
      pendingStudentA = await User.create({
        name: 'Rahul Kumar',
        email: 'rahul.kumar@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
        studentId: 'STU-BULK-001',
        instituteCode: 'ENG-DELHI',
      });

      pendingFacultyB = await User.create({
        name: 'Alan Turing',
        email: 'alan.turing@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'pending',
        isActive: false,
        facultyId: 'FAC-BULK-002',
        instituteCode: 'CS-CAMBRIDGE',
      });
    });

    after(async () => {
      await User.deleteMany({
        _id: { $in: [pendingStudentA._id, pendingFacultyB._id] },
      });
    });

    it('returns all pending users when no filter or search applied', async () => {
      const req = { query: {}, user: adminUser, ip: '127.0.0.1' };
      const res = mockResponse();
      await adminController.getPendingUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.responseData.data));
      const ids = res.responseData.data.map((u) => u._id.toString());
      assert.ok(ids.includes(pendingStudentA._id.toString()));
      assert.ok(ids.includes(pendingFacultyB._id.toString()));
    });

    it('filters pending users by role=student', async () => {
      const req = { query: { role: 'student' }, user: adminUser, ip: '127.0.0.1' };
      const res = mockResponse();
      await adminController.getPendingUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      const students = res.responseData.data;
      assert.ok(students.every((u) => u.role === 'student'));
      assert.ok(students.some((u) => u._id.toString() === pendingStudentA._id.toString()));
      assert.strictEqual(students.some((u) => u._id.toString() === pendingFacultyB._id.toString()), false);
    });

    it('filters pending users by role=instructor (faculty)', async () => {
      const req = { query: { role: 'instructor' }, user: adminUser, ip: '127.0.0.1' };
      const res = mockResponse();
      await adminController.getPendingUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      const faculty = res.responseData.data;
      assert.ok(faculty.every((u) => u.role === 'instructor'));
      assert.ok(faculty.some((u) => u._id.toString() === pendingFacultyB._id.toString()));
      assert.strictEqual(faculty.some((u) => u._id.toString() === pendingStudentA._id.toString()), false);
    });

    it('searches pending users by name, email, studentId, or facultyId', async () => {
      // Search by name
      const req1 = { query: { search: 'Rahul' }, user: adminUser, ip: '127.0.0.1' };
      const res1 = mockResponse();
      await adminController.getPendingUsers(req1, res1, (err) => {
        if (err) throw err;
      });
      assert.ok(res1.responseData.data.some((u) => u.name === 'Rahul Kumar'));
      assert.strictEqual(res1.responseData.data.some((u) => u.name === 'Alan Turing'), false);

      // Search by student ID
      const req2 = { query: { search: 'STU-BULK-001' }, user: adminUser, ip: '127.0.0.1' };
      const res2 = mockResponse();
      await adminController.getPendingUsers(req2, res2, (err) => {
        if (err) throw err;
      });
      assert.ok(res2.responseData.data.some((u) => u.studentId === 'STU-BULK-001'));

      // Search by faculty ID
      const req3 = { query: { search: 'FAC-BULK-002' }, user: adminUser, ip: '127.0.0.1' };
      const res3 = mockResponse();
      await adminController.getPendingUsers(req3, res3, (err) => {
        if (err) throw err;
      });
      assert.ok(res3.responseData.data.some((u) => u.facultyId === 'FAC-BULK-002'));
    });
  });

  // =========================================================================
  // 2. Bulk Approval Functionality & Validation
  // =========================================================================
  describe('Bulk Approval Processing', () => {
    it('1. Admin can bulk approve pending students', async () => {
      const student1 = await User.create({
        name: 'Student One',
        email: 'stu1@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });
      const student2 = await User.create({
        name: 'Student Two',
        email: 'stu2@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: { userIds: [student1._id.toString(), student2._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 2);
      assert.strictEqual(res.responseData.data.skippedCount, 0);

      const u1 = await User.findById(student1._id);
      const u2 = await User.findById(student2._id);
      assert.strictEqual(u1.status, 'active');
      assert.strictEqual(u1.isActive, true);
      assert.ok(u1.approvedAt);
      assert.strictEqual(u1.approvedBy.toString(), adminUser._id.toString());
      assert.strictEqual(u2.status, 'active');
      assert.strictEqual(u2.isActive, true);
    });

    it('2. Admin can bulk approve pending faculty', async () => {
      const fac1 = await User.create({
        name: 'Prof Alpha',
        email: 'prof_alpha@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'pending',
        isActive: false,
      });
      const fac2 = await User.create({
        name: 'Prof Beta',
        email: 'prof_beta@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: { userIds: [fac1._id.toString(), fac2._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 2);
      assert.strictEqual(res.responseData.data.skippedCount, 0);

      const updatedFac1 = await User.findById(fac1._id);
      assert.strictEqual(updatedFac1.status, 'active');
      assert.strictEqual(updatedFac1.role, 'instructor');
    });

    it('3. Admin can bulk approve mixed student/faculty selection', async () => {
      const mixedStudent = await User.create({
        name: 'Mixed Student',
        email: 'mixed_stu@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });
      const mixedFaculty = await User.create({
        name: 'Mixed Faculty',
        email: 'mixed_fac@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'instructor',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: { userIds: [mixedStudent._id.toString(), mixedFaculty._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();

      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 2);
      assert.strictEqual(res.responseData.data.skippedCount, 0);

      const uStu = await User.findById(mixedStudent._id);
      const uFac = await User.findById(mixedFaculty._id);
      assert.strictEqual(uStu.status, 'active');
      assert.strictEqual(uStu.role, 'student');
      assert.strictEqual(uFac.status, 'active');
      assert.strictEqual(uFac.role, 'instructor');
    });

    it('4. Non-admin cannot bulk approve', async () => {
      const reqStudent = {
        body: { userIds: ['some_id'] },
        user: studentUser,
        ip: '127.0.0.1',
      };
      const resStudent = mockResponse();
      await adminController.bulkApproveUsers(reqStudent, resStudent, (err) => {
        if (err) throw err;
      });
      assert.strictEqual(resStudent.statusCode, 403);
      assert.strictEqual(resStudent.responseData.success, false);

      const reqInstructor = {
        body: { userIds: ['some_id'] },
        user: instructorUser,
        ip: '127.0.0.1',
      };
      const resInstructor = mockResponse();
      await adminController.bulkApproveUsers(reqInstructor, resInstructor, (err) => {
        if (err) throw err;
      });
      assert.strictEqual(resInstructor.statusCode, 403);
      assert.strictEqual(resInstructor.responseData.success, false);
    });

    it('5. Empty selection rejected safely', async () => {
      // Empty array
      const reqEmpty = { body: { userIds: [] }, user: adminUser, ip: '127.0.0.1' };
      const resEmpty = mockResponse();
      await adminController.bulkApproveUsers(reqEmpty, resEmpty, (err) => {
        if (err) throw err;
      });
      assert.strictEqual(resEmpty.statusCode, 400);

      // Missing userIds
      const reqMissing = { body: {}, user: adminUser, ip: '127.0.0.1' };
      const resMissing = mockResponse();
      await adminController.bulkApproveUsers(reqMissing, resMissing, (err) => {
        if (err) throw err;
      });
      assert.strictEqual(resMissing.statusCode, 400);
    });

    it('6. Non-pending user cannot be approved (already active, rejected, revoked)', async () => {
      const rejectedUser = await User.create({
        name: 'Rejected User',
        email: 'rejected_candidate@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'rejected',
        isActive: false,
      });

      const req = {
        body: { userIds: [rejectedUser._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 0);
      assert.strictEqual(res.responseData.data.skippedCount, 1);
      assert.match(res.responseData.data.skipped[0].reason, /not in pending status/i);

      // Status remains rejected
      const verify = await User.findById(rejectedUser._id);
      assert.strictEqual(verify.status, 'rejected');
      assert.strictEqual(verify.isActive, false);
    });

    it('7. Already active user is handled correctly (skipped with reason)', async () => {
      const activeCandidate = await User.create({
        name: 'Active User Test',
        email: 'active_candidate@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'active',
        isActive: true,
      });

      const req = {
        body: { userIds: [activeCandidate._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 0);
      assert.strictEqual(res.responseData.data.skippedCount, 1);
      assert.match(res.responseData.data.skipped[0].reason, /currently "active"/i);
    });

    it('8. Revoked user is handled correctly (skipped with reason)', async () => {
      const revokedCandidate = await User.create({
        name: 'Revoked User Test',
        email: 'revoked_candidate@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'revoked',
        isActive: false,
      });

      const req = {
        body: { userIds: [revokedCandidate._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 0);
      assert.strictEqual(res.responseData.data.skippedCount, 1);
      assert.match(res.responseData.data.skipped[0].reason, /currently "revoked"/i);
    });

    it('9. Invalid user ID handled safely', async () => {
      const nonExistentId = '60d5ec49f1b2c8b1f8e4e1a1';
      const malformedId = 'not-a-valid-id';

      const req = {
        body: { userIds: [nonExistentId, malformedId] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 0);
      assert.strictEqual(res.responseData.data.skippedCount, 2);
      assert.strictEqual(res.responseData.data.skipped[0].reason, 'User not found');
      assert.strictEqual(res.responseData.data.skipped[1].reason, 'Invalid user identifier');
    });

    it('10. Partial success is reported accurately', async () => {
      const validPending = await User.create({
        name: 'Valid Pending Partial',
        email: 'valid_partial@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const nonExistentId = '60d5ec49f1b2c8b1f8e4e1a2';

      const req = {
        body: { userIds: [validPending._id.toString(), nonExistentId] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.responseData.data.approvedCount, 1);
      assert.strictEqual(res.responseData.data.skippedCount, 1);
      assert.ok(res.responseData.data.approvedUserIds.includes(validPending._id.toString()));
      assert.strictEqual(res.responseData.data.skipped[0].id, nonExistentId);
      assert.match(res.responseData.message, /1 approved, 1 skipped/i);
    });

    it('11. Audit logs are created for every approved user', async () => {
      const auditTestApplicant = await User.create({
        name: 'Audit Test Applicant',
        email: 'audit_test@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: { userIds: [auditTestApplicant._id.toString()] },
        user: adminUser,
        ip: '192.168.1.100',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      const log = await AuditLog.findOne({
        entityId: auditTestApplicant._id.toString(),
        action: 'USER_APPROVED',
      });
      assert.ok(log, 'Audit log should be recorded');
      assert.strictEqual(log.userId.toString(), adminUser._id.toString());
      assert.strictEqual(log.entityType, 'User');
      assert.strictEqual(log.details.targetEmail, 'audit_test@bulk-test-uap.edu');
      assert.strictEqual(log.details.assignedRole, 'student');
      assert.strictEqual(log.details.bulk, true);
      assert.ok(log.createdAt, 'Timestamp must exist');
    });

    it('12. Existing approval email/notification behavior remains functional', async () => {
      const emailTestApplicant = await User.create({
        name: 'Email Test Applicant',
        email: 'email_notif_test@bulk-test-uap.edu',
        password: defaultPassword,
        role: 'student',
        status: 'pending',
        isActive: false,
      });

      const req = {
        body: { userIds: [emailTestApplicant._id.toString()] },
        user: adminUser,
        ip: '127.0.0.1',
      };
      const res = mockResponse();
      await adminController.bulkApproveUsers(req, res, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(res.statusCode, 200);

      // Verify in-app notification
      const notif = await Notification.findOne({
        userId: emailTestApplicant._id,
        title: 'Account Approved',
      });
      assert.ok(notif, 'Notification must be created');
      assert.strictEqual(notif.type, 'system');
      assert.strictEqual(notif.link, '/auth/login');
      assert.match(notif.message, /approved with role "student"/i);

      // Verify email dispatched
      const sentEmails = emailService.getSentEmails();
      const userEmail = sentEmails.find((e) => e.to === 'email_notif_test@bulk-test-uap.edu');
      assert.ok(userEmail, 'Approval email should be dispatched');
      assert.match(userEmail.subject, /Account Has Been Approved/i);

      // Verify security: no credentials or secrets leaked
      const fullText = (userEmail.text + ' ' + userEmail.html).toLowerCase();
      assert.strictEqual(fullText.includes('password'), false);
      assert.strictEqual(fullText.includes('jwt'), false);
      assert.strictEqual(fullText.includes('secret'), false);
    });
  });
});
