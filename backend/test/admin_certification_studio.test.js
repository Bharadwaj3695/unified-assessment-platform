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
  SystemSetting,
  AuditLog,
} = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Admin Certification Studio: Backend API & End-to-End Controls', () => {
  let server;
  let baseUrl;
  let admin;
  let instructor;
  let student;
  let adminToken;
  let instructorToken;
  let studentToken;
  let defaultTemplate;
  let overrideTemplate;
  let sampleAssessment;
  let testCertificate;

  before(async () => {
    await connectDB();
    await seedDatabase();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    admin = await User.findOne({ email: 'admin@uap.edu' });
    instructor = await User.findOne({ email: 'instructor@uap.edu' });
    student = await User.findOne({ email: 'student@uap.edu' });

    adminToken = generateAccessToken({ id: admin._id, role: admin.role });
    instructorToken = generateAccessToken({ id: instructor._id, role: instructor.role });
    studentToken = generateAccessToken({ id: student._id, role: student.role });

    await Certificate.deleteMany({});
    await CertificateTemplate.deleteMany({});

    // Create institutional default template
    defaultTemplate = await CertificateTemplate.create({
      title: 'Global Institutional Excellence Template',
      name: 'Global Institutional Excellence Template',
      orientation: 'landscape',
      pageSize: 'A4',
      status: 'published',
      isDefault: true,
      createdBy: admin._id,
      canvas: {
        borderStyle: 'classic-gold',
        borderColor: '#D4AF37',
      },
    });

    // Create assessment-specific template
    overrideTemplate = await CertificateTemplate.create({
      title: 'DevOps Masterclass Custom Template',
      name: 'DevOps Masterclass Custom Template',
      orientation: 'landscape',
      pageSize: 'A4',
      status: 'published',
      isDefault: false,
      createdBy: admin._id,
      canvas: {
        borderStyle: 'modern-slate',
        borderColor: '#475569',
      },
    });

    sampleAssessment = await Assessment.create({
      title: 'Advanced Kubernetes & DevOps Certification',
      category: 'DevOps',
      instructorId: instructor._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      certification: {
        enabled: true,
        passingPercentage: 70,
        templateId: overrideTemplate._id,
        certificateTitle: 'Certified Kubernetes Architect',
        signatoryName: 'Dr. Robert Vance',
        signatoryTitle: 'Dean of Engineering',
      },
    });

    testCertificate = await Certificate.create({
      certificateId: 'CERT-2026-K8S-001',
      studentId: student._id,
      assessmentId: sampleAssessment._id,
      submissionId: new mongoose.Types.ObjectId(),
      evaluationId: new mongoose.Types.ObjectId(),
      templateId: overrideTemplate._id,
      templateVersion: 1,
      templateSnapshot: {
        title: overrideTemplate.title,
        orientation: 'landscape',
        pageSize: 'A4',
      },
      academicSnapshot: {
        studentName: student.name,
        studentIdNumber: 'STU-K8S-777',
        studentEmail: student.email,
        assessmentTitle: sampleAssessment.title,
        certificateTitle: 'Certified Kubernetes Architect',
        category: 'DevOps',
        score: 88,
        totalPoints: 100,
        percentage: 88,
        grade: 'A',
        gradeLabel: 'Excellent',
        passingPercentage: 70,
        instructorName: instructor.name,
        signatoryName: 'Dr. Robert Vance',
        signatoryTitle: 'Dean of Engineering',
      },
      status: 'active',
      verificationCode: 'VERIFY-K8S-777',
      issuedAt: new Date(),
      issuance: {
        status: 'issued',
        retryCount: 0,
      },
      emailDelivery: {
        status: 'pending',
        retryCount: 0,
      },
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await Certificate.deleteMany({});
    await CertificateTemplate.deleteMany({});
    await Assessment.deleteMany({ title: 'Advanced Kubernetes & DevOps Certification' });
    await disconnectDB();
  });

  describe('Part 1: Admin Certificate Template Management', () => {
    it('1.1 should list all templates for admin with optional status filter', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/templates?status=published`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.strictEqual(body.data.length, 2);
    });

    it('1.2 should reject non-admin from accessing admin templates', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/templates`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('1.3 should create a new template in draft status and log to AuditLog', async () => {
      const payload = {
        title: 'Cybersecurity Specialization Template',
        orientation: 'landscape',
        pageSize: 'A4',
        status: 'draft',
        canvas: {
          borderStyle: 'minimal-navy',
          borderColor: '#1E3A8A',
        },
      };

      const res = await fetch(`${baseUrl}/api/certificates/admin/templates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.data.title, payload.title);
      assert.strictEqual(body.data.status, 'draft');
      assert.strictEqual(body.data.version, 1);

      const audit = await AuditLog.findOne({
        action: 'CERTIFICATE_TEMPLATE_CREATED',
        entityId: body.data._id || body.data.id,
      });
      assert.ok(audit, 'Must record audit log for template creation');
    });

    it('1.4 should update a template and increment its version counter', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/templates/${overrideTemplate._id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'DevOps Masterclass Premium Template',
          status: 'published',
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.title, 'DevOps Masterclass Premium Template');
      assert.strictEqual(body.data.version, 2, 'Version must increment on published template update');
    });

    it('1.5 should atomically set a template as default and demote previous default', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/templates/${overrideTemplate._id}/set-default`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.isDefault, true);

      // Verify previous default was atomically demoted
      const prev = await CertificateTemplate.findById(defaultTemplate._id);
      assert.strictEqual(prev.isDefault, false, 'Previous default must be demoted');
    });

    it('1.6 should generate live preview PDF for a template payload', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/templates/preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Preview Live Template Award',
          orientation: 'landscape',
          pageSize: 'A4',
        }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
      const buffer = Buffer.from(await res.arrayBuffer());
      assert.ok(buffer.length > 1000);
      assert.strictEqual(buffer.toString('utf-8', 0, 5), '%PDF-');
    });
  });

  describe('Part 2: Admin Certificate Registry, Details & Revocation', () => {
    it('2.1 should retrieve all issued certificates with pagination and search', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/all?search=Kubernetes`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.total, 1);
      assert.strictEqual(body.data.certificates[0].certificateId, 'CERT-2026-K8S-001');
    });

    it('2.2 should retrieve full certificate details by ID for admin', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/${testCertificate._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.certificateId, 'CERT-2026-K8S-001');
      assert.strictEqual(body.data.academicSnapshot.studentName, student.name);
    });

    it('2.3 should reject revocation request without mandatory reason (min 3 chars)', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/${testCertificate._id}/revoke`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: ' ' }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /validation failed/i);
    });

    it('2.4 should revoke certificate with valid reason and record AuditLog', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/${testCertificate._id}/revoke`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Academic integrity investigation confirmed violation' }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.status, 'revoked');
      assert.strictEqual(body.data.revocation.reason, 'Academic integrity investigation confirmed violation');

      const audit = await AuditLog.findOne({
        action: 'CERTIFICATE_REVOKED',
        entityId: testCertificate._id.toString(),
      });
      assert.ok(audit, 'AuditLog record must exist for revocation');
    });
  });

  describe('Part 3: Retries, Recovery & Issuance Analytics', () => {
    it('3.1 should retry email delivery for a certificate', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/${testCertificate._id}/retry-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.emailDelivery.retryCount >= 1);
    });

    it('3.2 should retry PDF issuance for a certificate', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/${testCertificate._id}/retry-issuance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.issuance.status, 'issued');
      assert.ok(body.data.pdf?.fileKey, 'PDF fileKey must be generated');
    });

    it('3.3 should return aggregated issuance analytics', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/analytics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(typeof body.data.overview.totalCertificates === 'number');
      assert.ok(typeof body.data.emailDelivery.sent === 'number');
      assert.ok(Array.isArray(body.data.topAssessments));
    });
  });

  describe('Part 4: Institutional Certification Settings', () => {
    it('4.1 should retrieve institutional certification settings', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.institutionName);
    });

    it('4.2 should update institutional certification settings and log to AuditLog', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/admin/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          institutionName: 'Global Institute of Advanced Technologies',
          defaultSignatoryName: 'Chancellor Marcus Aurelius',
          autoEmailCertificates: true,
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.institutionName, 'Global Institute of Advanced Technologies');
      assert.strictEqual(body.data.defaultSignatoryName, 'Chancellor Marcus Aurelius');

      const audit = await AuditLog.findOne({
        action: 'CERTIFICATION_SETTINGS_UPDATED',
      });
      assert.ok(audit, 'AuditLog must record settings update');
    });
  });

  describe('Part 5: Public Verification Privacy & Security', () => {
    it('5.1 public verification should verify credential without exposing student email or internal ID', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/verify/VERIFY-K8S-777`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.valid, true);
      assert.strictEqual(body.data.status, 'revoked');
      assert.strictEqual(body.data.studentEmail, undefined, 'Must not expose confidential email');
      assert.strictEqual(body.data.studentIdNumber, undefined, 'Must not expose confidential student ID');
      assert.strictEqual(body.data.revocation.reason, 'Academic integrity investigation confirmed violation');
    });
  });
});
