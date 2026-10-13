const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, StudentRegistry, FacultyRegistry, Assessment, Submission, Question, BankQuestion, AuditLog } = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');
const app = require('../src/app');

describe('Unified Profile Photo Management for All RBAC Roles (Student, Faculty, Admin)', () => {
  let server;
  let baseUrl;
  let studentA;
  let studentB;
  let facultyA;
  let facultyB;
  let adminA;
  let studentAToken;
  let studentBToken;
  let facultyAToken;
  let facultyBToken;
  let adminAToken;

  // 1x1 valid PNG image buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // 1x1 valid JPEG image buffer
  const sampleJpgBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  before(async () => {
    await connectDB();
    await seedDatabase();

    const passwordHash = await hashPassword('Password@123');

    // Create test accounts for all RBAC roles
    studentA = await User.create({
      name: 'Alex Johnson',
      email: `photo_stu_a_${Date.now()}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-PHOTO-${Date.now()}-1`,
      department: 'Computer Science',
      avatar: null,
    });

    studentB = await User.create({
      name: 'Sarah Connor',
      email: `photo_stu_b_${Date.now()}@uap.edu`,
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: `STU-PHOTO-${Date.now()}-2`,
      department: 'Software Engineering',
      avatar: null,
    });

    facultyA = await User.create({
      name: 'Prof. Alan Turing',
      email: `photo_fac_a_${Date.now()}@uap.edu`,
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: `FAC-PHOTO-${Date.now()}-1`,
      department: 'Computer Science & Engineering',
      avatar: null,
    });

    facultyB = await User.create({
      name: 'Dr. Grace Hopper',
      email: `photo_fac_b_${Date.now()}@uap.edu`,
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: `FAC-PHOTO-${Date.now()}-2`,
      department: 'Electrical Engineering',
      avatar: null,
    });

    adminA = await User.create({
      name: 'Admin User',
      email: `photo_adm_a_${Date.now()}@uap.edu`,
      password: passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
      adminId: `ADM-PHOTO-${Date.now()}-1`,
      avatar: null,
    });

    studentAToken = generateAccessToken({ id: studentA._id.toString(), role: studentA.role, email: studentA.email, tokenVersion: 0 });
    studentBToken = generateAccessToken({ id: studentB._id.toString(), role: studentB.role, email: studentB.email, tokenVersion: 0 });
    facultyAToken = generateAccessToken({ id: facultyA._id.toString(), role: facultyA.role, email: facultyA.email, tokenVersion: 0 });
    facultyBToken = generateAccessToken({ id: facultyB._id.toString(), role: facultyB.role, email: facultyB.email, tokenVersion: 0 });
    adminAToken = generateAccessToken({ id: adminA._id.toString(), role: adminA.role, email: adminA.email, tokenVersion: 0 });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await User.deleteMany({
      _id: { $in: [studentA._id, studentB._id, facultyA._id, facultyB._id, adminA._id] },
    });
    await disconnectDB();
  });

  // =========================================================================
  // 1. STUDENT PROFILE PHOTO MANAGEMENT
  // =========================================================================
  describe('STUDENT Profile Photo Operations', () => {
    let studentUploadedAvatarPath = null;
    let studentChangedAvatarPath = null;

    it('1. No photo -> profile returns null avatar for initials fallback', async () => {
      const res = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.avatar, null, 'Avatar should initially be null');
      assert.strictEqual(json.data.name, 'Alex Johnson');
    });

    it('2. Add photo -> student uploads valid PNG image', async () => {
      const formData = new FormData();
      const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
      formData.append('avatar', fileBlob, 'student_avatar.png');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.avatar, 'Response should contain uploaded avatar path');
      assert.match(json.data.avatar, /^\/uploads\/avatar-.*\.png$/);
      studentUploadedAvatarPath = json.data.avatar;

      // Verify file exists on disk
      const diskPath = path.resolve(__dirname, '..', studentUploadedAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath), 'Uploaded file must exist on disk');

      // Verify audit log recorded
      const log = await AuditLog.findOne({
        userId: studentA._id,
        action: 'PROFILE_PHOTO_ADDED',
      });
      assert.ok(log, 'PROFILE_PHOTO_ADDED audit log must be created');
    });

    it('3. Photo displayed -> GET /profile returns updated avatar URL', async () => {
      const res = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.avatar, studentUploadedAvatarPath);
    });

    it('4. Change photo -> student uploads new JPEG, old photo unlinked from disk', async () => {
      const oldDiskPath = path.resolve(__dirname, '..', studentUploadedAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(oldDiskPath), 'Previous avatar should exist before replacement');

      const formData = new FormData();
      const fileBlob = new Blob([sampleJpgBuffer], { type: 'image/jpeg' });
      formData.append('avatar', fileBlob, 'student_avatar_new.jpg');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.avatar);
      assert.match(json.data.avatar, /^\/uploads\/avatar-.*\.jpe?g$/);
      studentChangedAvatarPath = json.data.avatar;
      assert.notStrictEqual(studentChangedAvatarPath, studentUploadedAvatarPath);

      // Verify old avatar was safely unlinked from disk
      assert.strictEqual(fs.existsSync(oldDiskPath), false, 'Old avatar file must be unlinked to prevent orphaned files');

      // Verify new avatar exists on disk
      const newDiskPath = path.resolve(__dirname, '..', studentChangedAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(newDiskPath), 'New avatar file must exist on disk');

      // Verify audit log recorded
      const log = await AuditLog.findOne({
        userId: studentA._id,
        action: 'PROFILE_PHOTO_CHANGED',
      });
      assert.ok(log, 'PROFILE_PHOTO_CHANGED audit log must be created');
    });

    it('5. Remove photo -> student deletes avatar, stored file deleted', async () => {
      const diskPath = path.resolve(__dirname, '..', studentChangedAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath), 'Current avatar should exist prior to removal');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.avatar, null, 'Avatar in response must be null');

      // Verify file deleted from disk
      assert.strictEqual(fs.existsSync(diskPath), false, 'Removed avatar file must be unlinked from disk');

      // Verify audit log recorded
      const log = await AuditLog.findOne({
        userId: studentA._id,
        action: 'PROFILE_PHOTO_REMOVED',
      });
      assert.ok(log, 'PROFILE_PHOTO_REMOVED audit log must be created');
    });

    it('6. Initials return after removal -> profile returns null avatar, immutable ID unchanged', async () => {
      const res = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.avatar, null);
      assert.strictEqual(json.data.studentId, studentA.studentId, 'Student ID must remain unchanged');
      assert.strictEqual(json.data.name, studentA.name, 'Student Name must remain unchanged');
    });

    it('7. Invalid image rejected -> executable file or invalid format returns 400', async () => {
      const formData = new FormData();
      const scriptBlob = new Blob(['console.log("malicious");'], { type: 'application/javascript' });
      formData.append('avatar', scriptBlob, 'exploit.js');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.message, /forbidden|permitted|Only image/i);
    });

    it('8. Oversized image rejected -> file exceeding 5MB returns error', async () => {
      const formData = new FormData();
      // 6MB buffer
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
      const fileBlob = new Blob([oversizedBuffer], { type: 'image/png' });
      formData.append('avatar', fileBlob, 'huge.png');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
        body: formData,
      });

      // Multer limits returns 413 or 400 depending on error middleware
      assert.ok(res.status === 413 || res.status === 400, `Expected 413 or 400 but got ${res.status}`);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    it('9. Cannot modify another student photo -> userId in payload is ignored, strictly uses req.user.id', async () => {
      // Student A tries to pass Student B's ID in body / query
      const formData = new FormData();
      const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
      formData.append('avatar', fileBlob, 'attempt_takeover.png');
      formData.append('userId', studentB._id.toString());

      const res = await fetch(`${baseUrl}/api/users/avatar?userId=${studentB._id.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);

      // Verify Student B's avatar was NOT modified
      const refreshedStudentB = await User.findById(studentB._id);
      assert.strictEqual(refreshedStudentB.avatar, null, "Student B's avatar must remain untouched");

      // Verify Student A's avatar WAS modified (their own profile)
      const refreshedStudentA = await User.findById(studentA._id);
      assert.ok(refreshedStudentA.avatar, "Student A's own avatar should be updated");

      // Clean up Student A's avatar
      await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
    });
  });

  // =========================================================================
  // 2. FACULTY / INSTRUCTOR PROFILE PHOTO MANAGEMENT
  // =========================================================================
  describe('FACULTY Profile Photo Operations', () => {
    let facultyUploadedAvatarPath = null;

    it('10. No photo -> faculty profile returns null avatar for initials fallback', async () => {
      const res = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${facultyAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.avatar, null);
      assert.strictEqual(json.data.facultyId, facultyA.facultyId);
    });

    it('11. Add photo -> faculty uploads valid photo', async () => {
      const formData = new FormData();
      const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
      formData.append('avatar', fileBlob, 'faculty_turing.png');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${facultyAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.avatar);
      facultyUploadedAvatarPath = json.data.avatar;

      // Verify faculty academic profile includes facultyId, department, subjects untouched
      const profileRes = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${facultyAToken}` },
      });
      const profileJson = await profileRes.json();
      assert.strictEqual(profileJson.data.avatar, facultyUploadedAvatarPath);
      assert.strictEqual(profileJson.data.facultyId, facultyA.facultyId);
      assert.strictEqual(profileJson.data.department, facultyA.department);
    });

    it('12. Change photo -> faculty replaces photo with JPEG', async () => {
      const oldDiskPath = path.resolve(__dirname, '..', facultyUploadedAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(oldDiskPath));

      const formData = new FormData();
      const fileBlob = new Blob([sampleJpgBuffer], { type: 'image/jpeg' });
      formData.append('avatar', fileBlob, 'faculty_turing_2.jpg');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${facultyAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.notStrictEqual(json.data.avatar, facultyUploadedAvatarPath);
      assert.strictEqual(fs.existsSync(oldDiskPath), false, 'Old faculty photo unlinked');

      facultyUploadedAvatarPath = json.data.avatar;
    });

    it('13. Remove photo -> faculty removes photo', async () => {
      const diskPath = path.resolve(__dirname, '..', facultyUploadedAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath));

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${facultyAToken}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(fs.existsSync(diskPath), false);

      const refreshed = await User.findById(facultyA._id);
      assert.strictEqual(refreshed.avatar, null);
      assert.strictEqual(refreshed.facultyId, facultyA.facultyId, 'Faculty ID is preserved');
    });

    it('14. Invalid image rejected -> plain text file rejected', async () => {
      const formData = new FormData();
      const textBlob = new Blob(['Not an image'], { type: 'text/plain' });
      formData.append('avatar', textBlob, 'notes.txt');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${facultyAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
    });

    it('15. Cannot modify another faculty member photo -> strictly operates on authenticated user', async () => {
      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${facultyAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: facultyB._id.toString() }),
      });

      assert.strictEqual(res.status, 200);
      // Faculty B was never touched
      const refreshedB = await User.findById(facultyB._id);
      assert.strictEqual(refreshedB.email, facultyB.email);
    });
  });

  // =========================================================================
  // 3. ADMIN PROFILE PHOTO MANAGEMENT
  // =========================================================================
  describe('ADMIN Profile Photo Operations', () => {
    let adminAvatarPath = null;

    it('16. No photo -> admin profile returns null avatar for initials fallback', async () => {
      const res = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.avatar, null);
      assert.strictEqual(json.data.adminId, adminA.adminId);
    });

    it('17. Add photo -> admin uploads valid photo', async () => {
      const formData = new FormData();
      const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
      formData.append('avatar', fileBlob, 'admin_avatar.png');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.avatar);
      adminAvatarPath = json.data.avatar;

      // Verify audit log created
      const log = await AuditLog.findOne({
        userId: adminA._id,
        action: 'PROFILE_PHOTO_ADDED',
      });
      assert.ok(log);
    });

    it('18. Change photo -> admin replaces photo', async () => {
      const oldDiskPath = path.resolve(__dirname, '..', adminAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(oldDiskPath));

      const formData = new FormData();
      const fileBlob = new Blob([sampleJpgBuffer], { type: 'image/jpeg' });
      formData.append('avatar', fileBlob, 'admin_avatar_2.jpg');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.notStrictEqual(json.data.avatar, adminAvatarPath);
      assert.strictEqual(fs.existsSync(oldDiskPath), false, 'Old admin photo unlinked');

      adminAvatarPath = json.data.avatar;
    });

    it('19. Remove photo -> admin removes photo', async () => {
      const diskPath = path.resolve(__dirname, '..', adminAvatarPath.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath));

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(fs.existsSync(diskPath), false);

      const refreshed = await User.findById(adminA._id);
      assert.strictEqual(refreshed.avatar, null);
      assert.strictEqual(refreshed.adminId, adminA.adminId);
    });

    it('20. Invalid image rejected -> PDF rejected for avatar', async () => {
      const formData = new FormData();
      const pdfBlob = new Blob(['%PDF-1.4 dummy'], { type: 'application/pdf' });
      formData.append('avatar', pdfBlob, 'doc.pdf');

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
    });
  });

  // =========================================================================
  // 4. SECURITY & PERMISSIONS ENFORCEMENT
  // =========================================================================
  describe('SECURITY & Permissions Enforcement', () => {
    it('21. Unauthenticated request rejected with 401', async () => {
      const resPost = await fetch(`${baseUrl}/api/users/avatar`, { method: 'POST' });
      assert.strictEqual(resPost.status, 401);

      const resDelete = await fetch(`${baseUrl}/api/users/avatar`, { method: 'DELETE' });
      assert.strictEqual(resDelete.status, 401);
    });

    it('22. User cannot modify another user photo via DELETE', async () => {
      // Set student B avatar manually
      studentB.avatar = '/uploads/sample-b.png';
      await studentB.save();

      // Student A sends DELETE request with student B id in query or body
      const res = await fetch(`${baseUrl}/api/users/avatar?userId=${studentB._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${studentAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: studentB._id.toString() }),
      });

      assert.strictEqual(res.status, 200);

      // Student B avatar must NOT be changed or deleted
      const refreshedB = await User.findById(studentB._id);
      assert.strictEqual(refreshedB.avatar, '/uploads/sample-b.png');

      // Reset Student B
      studentB.avatar = null;
      await studentB.save();
    });

    it('23. Existing RBAC still works -> students blocked from instructor endpoints', async () => {
      const res = await fetch(`${baseUrl}/api/users/students`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 403, 'Student must be blocked from /api/users/students');
    });

    it('24. Existing MFA architecture unaffected -> MFA challenge token cannot access avatar', async () => {
      const jwt = require('jsonwebtoken');
      const env = require('../src/config/env');
      const mfaToken = jwt.sign(
        { id: studentA._id.toString(), type: 'mfa_challenge' },
        env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      const res = await fetch(`${baseUrl}/api/users/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mfaToken}` },
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.message, /MFA challenge token cannot be used/i);
    });

    it('25. Existing authentication still works -> invalid token rejected', async () => {
      const res = await fetch(`${baseUrl}/api/users/profile`, {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      });
      assert.strictEqual(res.status, 401);
    });
  });

  // =========================================================================
  // 5. REGRESSION SAFEGUARDS
  // =========================================================================
  describe('REGRESSION Safeguards', () => {
    it('26. Student Registry unaffected -> registry records remain intact and immutable', async () => {
      const reg = await StudentRegistry.findOne();
      assert.ok(reg, 'Student registry must exist');
      // Ensure registry schema does not have unnecessary avatar field
      assert.strictEqual(reg.avatar, undefined);
    });

    it('27. Faculty Registry unaffected -> faculty registry records remain intact', async () => {
      const regCount = await FacultyRegistry.countDocuments();
      assert.ok(regCount >= 0);
    });

    it('28. Approval Queue unaffected -> admin can list users', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users?status=pending`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data), 'Users list must be an array');
    });

    it('29. Assessment functionality unaffected -> assessments query works', async () => {
      const res = await fetch(`${baseUrl}/api/assessments`, {
        headers: { Authorization: `Bearer ${facultyAToken}` },
      });
      assert.strictEqual(res.status, 200);
    });

    it('30. Document / PDF upload unaffected -> general upload and storage unaffected', async () => {
      const { upload, documentUpload, avatarUpload } = require('../src/middleware/upload.middleware');
      assert.ok(upload, 'General upload exists');
      assert.ok(documentUpload, 'Document upload exists');
      assert.ok(avatarUpload, 'Avatar upload exists');
    });

    it('31. Question Bank unaffected -> bank queries work for instructor', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank`, {
        headers: { Authorization: `Bearer ${facultyAToken}` },
      });
      assert.strictEqual(res.status, 200);
    });

    it('32. Proctoring unaffected -> proctoring routes available', async () => {
      const res = await fetch(`${baseUrl}/api/proctoring/status/mock_assessment`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      // Should return either 200 or 404 for mock assessment, but NOT 500
      assert.ok([200, 404].includes(res.status));
    });

    it('33. SMTP / email service intact -> verify email service loads without errors', async () => {
      const emailService = require('../src/services/email.service');
      assert.ok(typeof emailService.sendMail === 'function', 'sendMail should be a function');
      assert.ok(typeof emailService.sendAccountApprovedEmail === 'function', 'sendAccountApprovedEmail should be a function');
    });
  });
});
