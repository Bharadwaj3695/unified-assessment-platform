const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const {
  User,
  Assessment,
  CertificateTemplate,
  Certificate,
} = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Student Certifications: Backend API & Access Controls', () => {
  let server;
  let baseUrl;
  let student1;
  let student2;
  let instructor;
  let student1Token;
  let student2Token;
  let instructorToken;
  let adminToken;
  let testAssessment;
  let testTemplate;
  let student1Cert;

  before(async () => {
    await connectDB();
    await seedDatabase();

    // Start local HTTP server on random available port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.create({
      name: 'Second Student',
      email: 'student2_certs@uap.edu',
      password: 'Password@123',
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-2026-999',
    });
    instructor = await User.findOne({ email: 'instructor@uap.edu' });
    const admin = await User.findOne({ email: 'admin@uap.edu' });

    student1Token = generateAccessToken({ id: student1._id, role: student1.role });
    student2Token = generateAccessToken({ id: student2._id, role: student2.role });
    instructorToken = generateAccessToken({ id: instructor._id, role: instructor.role });
    adminToken = generateAccessToken({ id: admin._id, role: admin.role });

    // Clean existing certificates
    await Certificate.deleteMany({});
    await CertificateTemplate.deleteMany({});

    testTemplate = await CertificateTemplate.create({
      title: 'Institutional Excellence Template',
      name: 'Institutional Excellence Template',
      description: 'Accredited certificate template',
      orientation: 'landscape',
      pageSize: 'A4',
      status: 'published',
      isDefault: true,
      createdBy: instructor._id,
    });

    testAssessment = await Assessment.create({
      title: 'Cloud Architecture & DevOps Certification',
      description: 'Comprehensive evaluation of scalable systems',
      instructions: 'Answer all questions thoroughly',
      category: 'DevOps & Cloud',
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      instructorId: instructor._id,
      status: 'published',
      accessType: 'public',
      scheduledAt: new Date(Date.now() - 3600000),
      deadlineAt: new Date(Date.now() + 86400000),
      certification: {
        enabled: true,
        passingPercentage: 75,
        templateId: testTemplate._id,
        certificateTitle: 'Certified Cloud Architect',
        signatoryName: 'Dr. Jane Smith',
        signatoryTitle: 'Dean of Engineering',
      },
      questions: [],
    });

    const dummySubmissionId = new mongoose.Types.ObjectId();
    const dummyEvaluationId = new mongoose.Types.ObjectId();

    student1Cert = await Certificate.create({
      certificateId: 'CERT-2026-CLOUD01',
      studentId: student1._id,
      assessmentId: testAssessment._id,
      submissionId: dummySubmissionId,
      evaluationId: dummyEvaluationId,
      templateId: testTemplate._id,
      templateVersion: 1,
      templateSnapshot: {
        title: testTemplate.title,
        elements: [],
      },
      academicSnapshot: {
        studentName: student1.name,
        studentIdNumber: student1.studentId,
        studentEmail: student1.email,
        assessmentTitle: testAssessment.title,
        certificateTitle: 'Certified Cloud Architect',
        category: 'DevOps & Cloud',
        score: 92,
        totalPoints: 100,
        percentage: 92,
        grade: 'A',
        gradeLabel: 'Excellent',
        passingPercentage: 75,
        instructorName: instructor.name,
        signatoryName: 'Dr. Jane Smith',
        signatoryTitle: 'Dean of Engineering',
      },
      status: 'active',
      verificationCode: 'VERIFY-CLOUD-001',
      issuedAt: new Date(),
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await Certificate.deleteMany({});
    await CertificateTemplate.deleteMany({});
    await User.deleteMany({ email: 'student2_certs@uap.edu' });
    await Assessment.deleteMany({ title: 'Cloud Architecture & DevOps Certification' });
    await disconnectDB();
  });

  it('1. should return empty array for authenticated student with no earned certificates', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/mine`, {
      headers: {
        Authorization: `Bearer ${student2Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.data.length, 0);
  });

  it('2. should reject unauthenticated requests to /api/certificates/mine with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/mine`);
    assert.strictEqual(res.status, 401);
  });

  it('3. should return populated certificate details for authorized student', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/mine`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 1);

    const cert = body.data[0];
    assert.strictEqual(cert.certificateId, 'CERT-2026-CLOUD01');
    assert.strictEqual(cert.title, 'Certified Cloud Architect');
    assert.strictEqual(cert.assessmentName, 'Cloud Architecture & DevOps Certification');
    assert.strictEqual(cert.grade, 'A');
    assert.strictEqual(cert.percentage, 92);
    assert.strictEqual(cert.status, 'active');
    assert.ok(cert.issuedAt);
    assert.strictEqual(cert.studentEmail, student1.email);
  });

  it('4. should also work via alias /api/assessments/certificates/mine', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/certificates/mine`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 1);
    assert.strictEqual(body.data[0].certificateId, 'CERT-2026-CLOUD01');
  });

  it('5. should prevent student B from accessing student A certificate by ID (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/${student1Cert._id}`, {
      headers: {
        Authorization: `Bearer ${student2Token}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /not authorized|access denied/i);
  });

  it('6. should allow student A to retrieve their own certificate by ID (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/${student1Cert._id}`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.certificateId, 'CERT-2026-CLOUD01');
  });

  it('7. should return documented HTTP 501 when download is requested for an authorized certificate', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/${student1Cert._id}/download`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });

    assert.strictEqual(res.status, 501);
    const body = await res.json();
    assert.match(body.message, /pending backend implementation/i);
  });

  it('8. should reject instructor role from accessing student certificates endpoint (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/mine`, {
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
  });

  it('9. public verification endpoint should verify certificate without exposing student email or internal IDs', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/verify/VERIFY-CLOUD-001`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.valid, true);
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.certificateId, 'CERT-2026-CLOUD01');
    assert.strictEqual(body.data.studentName, student1.name);
    assert.strictEqual(body.data.studentEmail, undefined, 'Must not expose confidential student email');
    assert.strictEqual(body.data.studentIdNumber, undefined, 'Must not expose confidential student ID number');
  });

  it('10. public verification endpoint should return 404 for nonexistent verification token', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/verify/VERIFY-NONEXISTENT`);
    assert.strictEqual(res.status, 404);
  });

  it('11. admin should be able to inspect all certificates', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/admin/all`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.certificates));
    assert.ok(body.data.certificates.length >= 1);
  });

  it('12. admin should be able to revoke a certificate with audit reason', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/admin/${student1Cert._id}/revoke`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Audit investigation' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'revoked');
    assert.strictEqual(body.data.revocation.reason, 'Audit investigation');

    // Public verification should now reflect revoked status
    const verifyRes = await fetch(`${baseUrl}/api/certificates/verify/VERIFY-CLOUD-001`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.strictEqual(verifyBody.data.status, 'revoked');
    assert.strictEqual(verifyBody.data.revocation.reason, 'Audit investigation');
  });

  it('13. non-admin should not be able to revoke certificates (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/certificates/admin/${student1Cert._id}/revoke`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Unauthorized attempt' }),
    });
    assert.strictEqual(res.status, 403);
  });
});
