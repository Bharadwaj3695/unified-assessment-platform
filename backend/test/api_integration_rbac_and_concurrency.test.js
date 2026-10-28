const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const { User, Assessment, Submission, Question } = require('../src/models');
const authService = require('../src/services/auth.service');

describe('API Integration, RBAC Enforcement & Submission Concurrency Verification', () => {
  let server;
  let baseUrl;
  let studentUser;
  let instructorUser;
  let adminUser;
  let studentToken;
  let instructorToken;
  let adminToken;
  let publishedAssessment;

  before(async () => {
    await connectDB();
    await seedDatabase();

    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    // Authenticate users to acquire JWT tokens
    const studentAuth = await authService.login({ email: 'student@uap.edu', password: 'Student@123' });
    studentToken = studentAuth.accessToken;

    const instructorAuth = await authService.login({ email: 'instructor@uap.edu', password: 'Instructor@123' });
    instructorToken = instructorAuth.accessToken;

    const adminAuth = await authService.login({ email: 'admin@uap.edu', password: 'Admin@123' });
    adminToken = adminAuth.accessToken;

    // Retrieve or seed a published assessment with questions
    publishedAssessment = await Assessment.findOne({ status: 'published' });
    if (!publishedAssessment) {
      const q = await Question.create({
        type: 'mcq',
        text: 'API Test Question 1',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctAnswer: 'Opt A',
        points: 10,
        difficulty: 'easy',
      });
      publishedAssessment = await Assessment.create({
        title: 'API Integration Test Assessment',
        description: 'Verifying submission CAS and RBAC boundaries',
        category: 'Computer Science',
        durationMinutes: 30,
        totalMarks: 10,
        passingMarks: 5,
        instructorId: instructorUser._id,
        status: 'published',
        questions: [q._id],
      });
    }

    // Start ephemeral server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  describe('1. Express Validator & Failure Paths', () => {
    it('should return 422 with validation errors when login payload is malformed', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email-format', password: '' }),
      });
      assert.strictEqual(res.status, 422);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.ok(json.errors || json.message, 'Should return validation errors');
    });

    it('should return 422 when registration omits mandatory fields', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@uap.edu' }),
      });
      assert.strictEqual(res.status, 422);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });
  });

  describe('2. Strict RBAC Boundary Enforcement', () => {
    it('should reject unauthenticated request to protected endpoints with 401', async () => {
      const res = await fetch(`${baseUrl}/api/assessments`);
      assert.strictEqual(res.status, 401);
    });

    it('should forbid student from accessing administrative user management (403)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    it('should forbid instructor from accessing administrative audit logs (403)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/logs`, {
        headers: { Authorization: `Bearer ${instructorToken}` },
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    it('should allow admin to access administrative audit logs (200)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    it('should forbid student from creating assessments (403)', async () => {
      const res = await fetch(`${baseUrl}/api/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          title: 'Illegal Student Exam',
          category: 'Hacking',
          durationMinutes: 10,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('should allow instructor to view their assessment list (200)', async () => {
      const res = await fetch(`${baseUrl}/api/assessments`, {
        headers: { Authorization: `Bearer ${instructorToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });
  });

  describe('3. Submission Concurrency & Atomic CAS Verification', () => {
    let testSubmissionId;

    it('3.1 Should initialize assessment attempt via HTTP POST /api/submissions/start', async () => {
      const res = await fetch(`${baseUrl}/api/submissions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          assessmentId: publishedAssessment._id.toString(),
        }),
      });

      assert.ok(res.status === 200 || res.status === 201, `Status expected 200/201, got ${res.status}`);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data?._id, 'Submission ID should be returned');
      testSubmissionId = json.data._id;
    });

    it('3.2 Concurrent repeated submission clicks should result in exactly one successful submission and reject duplicates', async () => {
      assert.ok(testSubmissionId, 'Prior submission ID must exist');

      const submitPayload = {
        answers: [
          {
            questionId: publishedAssessment.questions?.[0]?._id?.toString() || new mongoose.Types.ObjectId().toString(),
            answer: 'Opt A',
          },
        ],
      };

      // Dispatch 3 concurrent HTTP submit requests to simulate rapid double-clicks
      const promises = [1, 2, 3].map(() =>
        fetch(`${baseUrl}/api/submissions/${testSubmissionId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify(submitPayload),
        })
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      // Exactly one request must succeed (HTTP 200). All others must be rejected (HTTP 400 or 409).
      const successCount = statuses.filter((s) => s === 200).length;
      const rejectedCount = statuses.filter((s) => s === 400 || s === 409).length;

      assert.strictEqual(successCount, 1, `Exactly one submission must succeed; got statuses: ${statuses.join(', ')}`);
      assert.strictEqual(rejectedCount, 2, `Duplicate submissions must be rejected; got statuses: ${statuses.join(', ')}`);

      // Verify database record has status 'submitted' or 'evaluated'
      const finalSubmission = await Submission.findById(testSubmissionId);
      assert.ok(
        finalSubmission.status === 'submitted' || finalSubmission.status === 'evaluated',
        `Submission status should be submitted or evaluated, found: ${finalSubmission?.status}`
      );
    });

    it('3.3 Subsequent submit request after assessment is closed must return HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${testSubmissionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ answers: [] }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.message, /already.*submitted|not in progress|cannot be resubmitted/i);
    });
  });

  describe('4. Frontend/Backend Path & HTTP Method Contract Check', () => {
    it('GET /api/announcements/active should be accessible without auth for student banners', async () => {
      const res = await fetch(`${baseUrl}/api/announcements/active`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data !== undefined, 'Announcements data envelope should exist');
    });

    it('GET /api/certificates/mine should be accessible for student', async () => {
      const res = await fetch(`${baseUrl}/api/certificates/mine`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    it('GET /api/admin/student-registry should require admin authorization', async () => {
      const resForbidden = await fetch(`${baseUrl}/api/admin/student-registry`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(resForbidden.status, 403);

      const resAllowed = await fetch(`${baseUrl}/api/admin/student-registry`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAllowed.status, 200);
      const json = await resAllowed.json();
      assert.strictEqual(json.success, true);
    });
  });
});
