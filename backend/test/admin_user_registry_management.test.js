const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const XLSX = require('xlsx');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const emailService = require('../src/services/email.service');
const adminRegistryService = require('../src/services/adminRegistry.service');
const { User, StudentRegistry, FacultyRegistry, AuditLog } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Admin User & Registry Management Module Verification', () => {
  let adminUser;
  let studentUser;
  let instructorUser;

  before(async () => {
    await connectDB();
    await seedDatabase();

    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
  });

  after(async () => {
    // Clean up test generated records
    await StudentRegistry.deleteMany({
      $or: [
        { studentId: { $regex: /^TEST-STU/i } },
        { email: { $regex: /@test-uap\.edu$/i } },
      ],
    });
    await FacultyRegistry.deleteMany({
      $or: [
        { facultyId: { $regex: /^TEST-FAC/i } },
        { email: { $regex: /@test-uap\.edu$/i } },
      ],
    });
    await User.deleteMany({
      email: { $regex: /@test-uap\.edu$/i },
    });
    await disconnectDB();
  });

  beforeEach(() => {
    emailService.clearSentEmails();
  });

  // =========================================================================
  // 1. Student Registry & Individual Student Creation
  // =========================================================================
  describe('1. Individual Student Management & Master Registry', () => {
    it('1.1 should create master StudentRegistry record and active User account', async () => {
      const result = await adminRegistryService.createStudent(
        {
          studentId: 'TEST-STU-001',
          name: 'Ananya Roy',
          dateOfBirth: '2002-08-15',
          email: 'ananya.roy@test-uap.edu',
        },
        adminUser,
        '127.0.0.1'
      );

      assert.ok(result.registry);
      assert.strictEqual(result.registry.studentId, 'TEST-STU-001');
      assert.strictEqual(result.registry.email, 'ananya.roy@test-uap.edu');
      assert.strictEqual(result.registry.status, 'active');

      assert.ok(result.user);
      assert.strictEqual(result.user.role, 'student');
      assert.strictEqual(result.user.status, 'active');
      assert.strictEqual(result.user.isActive, true);
      assert.strictEqual(result.user.studentId, 'TEST-STU-001');
      assert.strictEqual(result.user.email, 'ananya.roy@test-uap.edu');
      assert.strictEqual(result.user.password, undefined, 'Plaintext password must never be returned');

      // Verify audit logs
      const registryAudit = await AuditLog.findOne({
        action: 'STUDENT_REGISTRY_CREATED',
        entityId: result.registry._id.toString(),
      });
      assert.ok(registryAudit, 'AuditLog for STUDENT_REGISTRY_CREATED should exist');

      const userAudit = await AuditLog.findOne({
        action: 'STUDENT_ACCOUNT_CREATED',
        entityId: result.user.id || result.user._id,
      });
      assert.ok(userAudit, 'AuditLog for STUDENT_ACCOUNT_CREATED should exist');

      // Verify email dispatched
      const sentEmails = emailService.getSentEmails();
      const welcomeEmail = sentEmails.find((e) => e.to === 'ananya.roy@test-uap.edu');
      assert.ok(welcomeEmail, 'Welcome email should be dispatched to student');
      assert.match(welcomeEmail.subject, /Student Account Created/i);
    });

    it('1.2 should reject duplicate studentId in StudentRegistry', async () => {
      await assert.rejects(
        async () => {
          await adminRegistryService.createStudent(
            {
              studentId: 'TEST-STU-001', // duplicate
              name: 'Different Name',
              dateOfBirth: '2003-01-10',
              email: 'unique.email@test-uap.edu',
            },
            adminUser,
            '127.0.0.1'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /already exists in the Student Registry/i);
          return true;
        }
      );
    });

    it('1.3 should reject duplicate email in StudentRegistry', async () => {
      await assert.rejects(
        async () => {
          await adminRegistryService.createStudent(
            {
              studentId: 'TEST-STU-002',
              name: 'Duplicate Email Candidate',
              dateOfBirth: '2003-01-10',
              email: 'ananya.roy@test-uap.edu', // duplicate email
            },
            adminUser,
            '127.0.0.1'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /already exists/i);
          return true;
        }
      );
    });

    it('1.4 should reject missing required fields or invalid email', async () => {
      await assert.rejects(
        async () => {
          await adminRegistryService.createStudent(
            {
              studentId: '',
              name: 'Missing ID',
              dateOfBirth: '2002-05-10',
              email: 'valid@test-uap.edu',
            },
            adminUser,
            '127.0.0.1'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await adminRegistryService.createStudent(
            {
              studentId: 'TEST-STU-999',
              name: 'Invalid Email User',
              dateOfBirth: '2002-05-10',
              email: 'not-an-email',
            },
            adminUser,
            '127.0.0.1'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /valid institutional email/i);
          return true;
        }
      );
    });

    it('1.5 should provision User account for existing StudentRegistry record', async () => {
      const standaloneRegistry = await StudentRegistry.create({
        studentId: 'TEST-STU-STANDALONE',
        name: 'Devika Sharma',
        dateOfBirth: new Date('2001-09-21'),
        email: 'devika.standalone@test-uap.edu',
        status: 'active',
      });

      const result = await adminRegistryService.createAccountForStudentRegistry(
        standaloneRegistry._id,
        adminUser,
        '127.0.0.1'
      );

      assert.ok(result.user);
      assert.strictEqual(result.user.studentId, 'TEST-STU-STANDALONE');
      assert.strictEqual(result.user.email, 'devika.standalone@test-uap.edu');
      assert.strictEqual(result.user.role, 'student');
      assert.strictEqual(result.user.status, 'active');

      const userInDb = await User.findOne({ studentId: 'TEST-STU-STANDALONE' });
      assert.ok(userInDb);
      assert.strictEqual(userInDb.isActive, true);
    });
  });

  // =========================================================================
  // 2. Faculty Registry & Individual Faculty Creation
  // =========================================================================
  describe('2. Individual Faculty Management & Master Registry', () => {
    it('2.1 should create FacultyRegistry record and active instructor User account', async () => {
      const result = await adminRegistryService.createFaculty(
        {
          facultyId: 'TEST-FAC-101',
          name: 'Dr. Vikram Sarabhai',
          email: 'vikram.sarabhai@test-uap.edu',
          department: 'Aerospace Engineering',
        },
        adminUser,
        '127.0.0.1'
      );

      assert.ok(result.registry);
      assert.strictEqual(result.registry.facultyId, 'TEST-FAC-101');
      assert.strictEqual(result.registry.email, 'vikram.sarabhai@test-uap.edu');
      assert.strictEqual(result.registry.status, 'active');

      assert.ok(result.user);
      assert.strictEqual(result.user.role, 'instructor');
      assert.strictEqual(result.user.status, 'active');
      assert.strictEqual(result.user.isActive, true);
      assert.strictEqual(result.user.facultyId, 'TEST-FAC-101');
      assert.strictEqual(result.user.department, 'Aerospace Engineering');
      assert.strictEqual(result.user.password, undefined);

      // Verify audit logs
      const facRegAudit = await AuditLog.findOne({
        action: 'FACULTY_REGISTRY_CREATED',
        entityId: result.registry._id.toString(),
      });
      assert.ok(facRegAudit);

      const facUserAudit = await AuditLog.findOne({
        action: 'FACULTY_ACCOUNT_CREATED',
        entityId: result.user.id || result.user._id,
      });
      assert.ok(facUserAudit);

      // Verify email dispatched
      const sentEmails = emailService.getSentEmails();
      const welcomeEmail = sentEmails.find((e) => e.to === 'vikram.sarabhai@test-uap.edu');
      assert.ok(welcomeEmail, 'Welcome email should be dispatched to faculty');
      assert.match(welcomeEmail.subject, /Faculty Account Created/i);
    });

    it('2.2 should reject duplicate facultyId in FacultyRegistry', async () => {
      await assert.rejects(
        async () => {
          await adminRegistryService.createFaculty(
            {
              facultyId: 'TEST-FAC-101', // duplicate
              name: 'Different Faculty',
              email: 'different.faculty@test-uap.edu',
            },
            adminUser,
            '127.0.0.1'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /already exists in the Faculty Registry/i);
          return true;
        }
      );
    });

    it('2.3 should reject duplicate email in FacultyRegistry', async () => {
      await assert.rejects(
        async () => {
          await adminRegistryService.createFaculty(
            {
              facultyId: 'TEST-FAC-102',
              name: 'Duplicate Email Faculty',
              email: 'vikram.sarabhai@test-uap.edu', // duplicate
            },
            adminUser,
            '127.0.0.1'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.match(err.message, /already exists/i);
          return true;
        }
      );
    });

    it('2.4 should provision User account for existing FacultyRegistry record', async () => {
      const standaloneFac = await FacultyRegistry.create({
        facultyId: 'TEST-FAC-STANDALONE',
        name: 'Dr. Homi Bhabha',
        email: 'homi.bhabha@test-uap.edu',
        status: 'active',
      });

      const result = await adminRegistryService.createAccountForFacultyRegistry(
        standaloneFac._id,
        adminUser,
        '127.0.0.1'
      );

      assert.ok(result.user);
      assert.strictEqual(result.user.facultyId, 'TEST-FAC-STANDALONE');
      assert.strictEqual(result.user.role, 'instructor');
      assert.strictEqual(result.user.status, 'active');
      assert.strictEqual(result.user.isActive, true);
    });
  });

  // =========================================================================
  // 3. Bulk Student Import (CSV & XLSX)
  // =========================================================================
  describe('3. Student Bulk Import: CSV & Excel Multi-Step Pipeline', () => {
    it('3.1 should parse CSV file buffer and return valid preview without persisting', async () => {
      const csvContent = `Student ID,Name,Date of Birth,Email
TEST-BULK-001,Aarav Patel,2002-04-12,aarav.patel@test-uap.edu
TEST-BULK-002,Meera Nambiar,2001-10-25,meera.nambiar@test-uap.edu
`;
      const buffer = Buffer.from(csvContent, 'utf-8');

      const preview = await adminRegistryService.previewStudentBulkImport(buffer, 'test_students.csv');

      assert.strictEqual(preview.summary.totalRows, 2);
      assert.strictEqual(preview.summary.validCount, 2);
      assert.strictEqual(preview.summary.duplicateCount, 0);
      assert.strictEqual(preview.summary.invalidCount, 0);

      // Verify NO records were persisted in preview stage
      const checkRegistry = await StudentRegistry.findOne({ studentId: 'TEST-BULK-001' });
      assert.strictEqual(checkRegistry, null, 'Preview stage must NOT write to database');

      const checkUser = await User.findOne({ studentId: 'TEST-BULK-001' });
      assert.strictEqual(checkUser, null, 'Preview stage must NOT create User accounts');
    });

    it('3.2 should parse XLSX workbook buffer accurately and detect duplicates and invalid rows', async () => {
      // Build in-memory workbook with mixed rows:
      // Row 1: Valid
      // Row 2: Invalid (missing email)
      // Row 3: Duplicate within file (same ID as Row 1)
      // Row 4: Duplicate against existing registry record (TEST-STU-001 created earlier)
      const data = [
        ['Student ID', 'Name', 'Date of Birth', 'Email'],
        ['TEST-XLS-001', 'Rohan Gupta', '2002-06-20', 'rohan.gupta@test-uap.edu'],
        ['TEST-XLS-002', 'Incomplete Row', '2002-07-21', ''], // Missing email
        ['TEST-XLS-001', 'Rohan Gupta In-File Duplicate', '2002-06-20', 'rohan2@test-uap.edu'], // Dup ID in file
        ['TEST-STU-001', 'Existing DB Conflict', '2002-08-15', 'conflict@test-uap.edu'], // Dup ID in DB
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const preview = await adminRegistryService.previewStudentBulkImport(xlsxBuffer, 'students.xlsx');

      assert.strictEqual(preview.summary.totalRows, 4);
      assert.strictEqual(preview.summary.validCount, 1);
      assert.strictEqual(preview.summary.duplicateCount, 2);
      assert.strictEqual(preview.summary.invalidCount, 1);

      const validRow = preview.rows.find((r) => r.studentId === 'TEST-XLS-001' && r.status === 'VALID');
      assert.ok(validRow);

      const invalidRow = preview.rows.find((r) => r.studentId === 'TEST-XLS-002');
      assert.strictEqual(invalidRow.status, 'INVALID');
      assert.match(invalidRow.reason, /Missing Email/i);

      const dbConflictRow = preview.rows.find((r) => r.studentId === 'TEST-STU-001');
      assert.strictEqual(dbConflictRow.status, 'DUPLICATE');
      assert.match(dbConflictRow.reason, /already exists in Student Registry/i);
    });

    it('3.3 should confirm bulk import: persist valid records, create User accounts, send emails, and log audit', async () => {
      const candidates = [
        {
          studentId: 'TEST-CONFIRM-001',
          name: 'Nisha Sundaram',
          dateOfBirth: '2003-03-30',
          email: 'nisha.sundaram@test-uap.edu',
          status: 'VALID',
        },
        {
          studentId: 'TEST-CONFIRM-002',
          name: 'Karan Mehra',
          dateOfBirth: '2002-12-14',
          email: 'karan.mehra@test-uap.edu',
          status: 'VALID',
        },
      ];

      const result = await adminRegistryService.confirmStudentBulkImport(
        candidates,
        adminUser,
        '127.0.0.1'
      );

      assert.strictEqual(result.totalSubmitted, 2);
      assert.strictEqual(result.createdCount, 2);
      assert.strictEqual(result.failedCount, 0);

      // Verify records are saved in MongoDB
      const reg1 = await StudentRegistry.findOne({ studentId: 'TEST-CONFIRM-001' });
      assert.ok(reg1);
      assert.strictEqual(reg1.name, 'Nisha Sundaram');

      const user1 = await User.findOne({ studentId: 'TEST-CONFIRM-001' });
      assert.ok(user1);
      assert.strictEqual(user1.role, 'student');
      assert.strictEqual(user1.status, 'active');
      assert.strictEqual(user1.isActive, true);

      // Verify Audit Log
      const auditLog = await AuditLog.findOne({
        action: 'STUDENT_BULK_IMPORT_COMPLETED',
      });
      assert.ok(auditLog, 'STUDENT_BULK_IMPORT_COMPLETED audit log must be recorded');
      assert.strictEqual(auditLog.details.createdCount, 2);

      // Verify Welcome Emails
      const sentEmails = emailService.getSentEmails();
      const nishaEmail = sentEmails.find((e) => e.to === 'nisha.sundaram@test-uap.edu');
      assert.ok(nishaEmail);
      assert.match(nishaEmail.subject, /Student Account Created/i);
    });
  });
});
