const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const {
  User,
  Assessment,
  Question,
  MockTest,
  MockTestAttempt,
  Submission,
  Subject,
} = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Phase 3: Unified Test API Security & Regression Suite', () => {
  let server;
  let baseUrl;

  let studentA;
  let studentB;
  let instructorA;
  let instructorB;
  let adminUser;

  let studentAToken;
  let studentBToken;
  let instructorAToken;
  let instructorBToken;
  let adminToken;

  let testSubject;
  let assessmentA;
  let assessmentB;
  let restrictedAssessment;
  let questionA;
  let testMockTest;

  before(async () => {
    await connectDB();
    await seedDatabase();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Fetch seeded users
    studentA = await User.findOne({ email: 'student@uap.edu' });
    instructorA = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    // 2. Create isolated secondary student & instructor for cross-tenant isolation testing
    studentB = await User.findOne({ email: 'student_b_sec@uap.edu' });
    if (!studentB) {
      studentB = await User.create({
        name: 'Student B',
        email: 'student_b_sec@uap.edu',
        password: 'Password123!',
        role: 'student',
        status: 'active',
        isActive: true,
        isEmailVerified: true,
      });
    } else {
      studentB.status = 'active';
      studentB.isActive = true;
      await studentB.save();
    }

    instructorB = await User.findOne({ email: 'instructor_b_sec@uap.edu' });
    if (!instructorB) {
      instructorB = await User.create({
        name: 'Instructor B',
        email: 'instructor_b_sec@uap.edu',
        password: 'Password123!',
        role: 'instructor',
        status: 'active',
        isActive: true,
        isEmailVerified: true,
      });
    } else {
      instructorB.status = 'active';
      instructorB.isActive = true;
      await instructorB.save();
    }

    // 3. Issue valid JWT tokens
    const makeToken = (user) =>
      generateAccessToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: user.tokenVersion || 0,
      });

    studentAToken = makeToken(studentA);
    studentBToken = makeToken(studentB);
    instructorAToken = makeToken(instructorA);
    instructorBToken = makeToken(instructorB);
    adminToken = makeToken(adminUser);

    // 4. Create test domain entities
    testSubject = await Subject.findOne({ name: 'Computer Science' });
    if (!testSubject) {
      testSubject = await Subject.create({
        name: 'Computer Science',
        code: 'CS',
        createdBy: instructorA._id,
      });
    }

    assessmentA = await Assessment.create({
      title: 'Instructor A Assessment',
      category: 'Computer Science',
      instructorId: instructorA._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 50,
      status: 'published',
      accessType: 'public',
    });

    questionA = await Question.create({
      assessmentId: assessmentA._id,
      statement: 'What does CSS stand for?',
      questionType: 'SINGLE_MCQ',
      options: [
        { id: 'A', text: 'Cascading Style Sheets', isCorrect: true },
        { id: 'B', text: 'Computer Style Sheets', isCorrect: false },
      ],
      correctAnswer: 'A',
      explanation: 'CSS stands for Cascading Style Sheets.',
      points: 100,
      status: 'PUBLISHED',
      ownerFacultyId: instructorA._id,
    });

    assessmentB = await Assessment.create({
      title: 'Instructor B Assessment',
      category: 'Computer Science',
      instructorId: instructorB._id,
      durationMinutes: 30,
      totalPoints: 50,
      passingScore: 25,
      status: 'published',
      accessType: 'public',
    });

    restrictedAssessment = await Assessment.create({
      title: 'Restricted to Student A Only',
      category: 'Computer Science',
      instructorId: instructorA._id,
      durationMinutes: 30,
      totalPoints: 50,
      passingScore: 25,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [studentA._id],
    });

    testMockTest = await MockTest.create({
      title: 'Security Mock Test',
      subjectId: testSubject._id,
      ownerFacultyId: instructorA._id,
      status: 'PUBLISHED',
      durationMinutes: 45,
      totalMarks: 50,
      questionCount: 1,
      resolvedQuestions: [
        {
          questionId: questionA._id,
          versionNumber: 1,
          questionSnapshot: {
            statement: 'What does CSS stand for?',
            questionType: 'SINGLE_MCQ',
            options: [
              { id: 'A', text: 'Cascading Style Sheets', isCorrect: true },
              { id: 'B', text: 'Computer Style Sheets', isCorrect: false },
            ],
            answerKey: 'A',
            correctAnswer: 'A',
          },
          marks: 50,
          orderIndex: 0,
        },
      ],
    });
  });

  after(async () => {
    // Cleanup created test records
    await Submission.deleteMany({
      assessmentId: { $in: [assessmentA?._id, assessmentB?._id, restrictedAssessment?._id] },
    });
    await MockTestAttempt.deleteMany({ mockTestId: testMockTest?._id });
    await Assessment.deleteMany({
      _id: { $in: [assessmentA?._id, assessmentB?._id, restrictedAssessment?._id] },
    });
    await Question.deleteMany({ _id: questionA?._id });
    await MockTest.deleteMany({ _id: testMockTest?._id });
    await User.deleteMany({ email: { $in: ['student_b_sec@uap.edu', 'instructor_b_sec@uap.edu'] } });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // ==========================================
  // 1. Role-Based Access Control (RBAC) Tests
  // ==========================================
  describe('1. Role-Based Access Control (RBAC) & Authorization Boundaries', () => {
    it('Blocks student from creating assessments via POST /api/tests/assessments (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          title: 'Illegal Student Assessment',
          category: 'Computer Science',
          durationMinutes: 30,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('Blocks student from creating mock tests via POST /api/tests/mock-tests (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/mock-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          title: 'Illegal Mock Test',
          subjectId: testSubject._id.toString(),
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('Blocks student from accessing evaluation queues via GET /api/tests/assessments/evaluations (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/evaluations`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Blocks student from accessing certificate templates via GET /api/tests/assessments/certificate-templates (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/certificate-templates`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Blocks instructor from starting an assessment attempt via POST /api/tests/assessments/:id/attempts (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${assessmentA._id}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Blocks instructor from starting a mock test attempt via POST /api/tests/mock-tests/:id/attempts (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/mock-tests/${testMockTest._id}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
      });
      assert.strictEqual(res.status, 403);
    });
  });

  // ==========================================
  // 2. Ownership & Cross-User Security Isolation
  // ==========================================
  describe('2. Ownership Enforcement & Cross-Tenant Data Isolation', () => {
    let studentASubmissionId;
    let studentAMockAttemptId;

    before(async () => {
      // Student A creates an assessment attempt
      const subRes = await fetch(`${baseUrl}/api/tests/assessments/${assessmentA._id}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
      });
      assert.strictEqual(subRes.status, 200);
      const subBody = await subRes.json();
      studentASubmissionId = subBody.data._id;

      // Student A creates a mock test attempt
      const mtRes = await fetch(`${baseUrl}/api/tests/mock-tests/${testMockTest._id}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
      });
      assert.strictEqual(mtRes.status, 200);
      const mtBody = await mtRes.json();
      studentAMockAttemptId = mtBody.data.attemptId;
    });

    it('Prevents Student B from viewing Student A assessment submission (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/attempts/${studentASubmissionId}`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Prevents Student B from saving answers on Student A assessment submission (403)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/assessments/attempts/${studentASubmissionId}/answers/${questionA._id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentBToken}`,
          },
          body: JSON.stringify({ answer: 'B', timeSpentSeconds: 10 }),
        }
      );
      assert.strictEqual(res.status, 403);
    });

    it('Prevents Student B from submitting Student A mock test attempt (403)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/mock-tests/attempts/${studentAMockAttemptId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentBToken}`,
          },
          body: JSON.stringify({
            responses: [{ questionId: questionA._id.toString(), selectedOption: 'A' }],
          }),
        }
      );
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert(body.message.includes('Access denied'));
    });

    it('Prevents Instructor B from modifying Instructor A assessment via PUT /api/tests/assessments/:id (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${assessmentA._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorBToken}`,
        },
        body: JSON.stringify({ title: 'Hijacked Assessment Title' }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('Prevents Instructor B from deleting Instructor A assessment via DELETE /api/tests/assessments/:id (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${assessmentA._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${instructorBToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Prevents unassigned Student B from viewing restricted assessment details (403)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${restrictedAssessment._id}`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Permits assigned Student A to view restricted assessment details (200)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${restrictedAssessment._id}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 200);
    });
  });

  // ==========================================
  // 3. Information Sanitization & Leak Prevention
  // ==========================================
  describe('3. Student Information Sanitization & Answer Key Protection', () => {
    it('Never exposes correctAnswer or explanation in student assessment details (GET /api/tests/assessments/:id)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${assessmentA._id}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const questions = body.data.questions || [];
      assert(questions.length > 0, 'Assessment questions must be populated');
      for (const q of questions) {
        assert.strictEqual(q.correctAnswer, undefined, 'correctAnswer must be stripped for students');
        assert.strictEqual(q.explanation, undefined, 'explanation must be stripped for students');
      }
    });

    it('Never exposes answerKey or correctOption in student mock test attempt payload', async () => {
      const res = await fetch(`${baseUrl}/api/tests/mock-tests/${testMockTest._id}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const questions = body.data.mockTest.questions || [];
      assert(questions.length > 0, 'Mock test questions must be populated');
      for (const q of questions) {
        assert.strictEqual(q.answerKey, undefined, 'answerKey must be stripped');
        assert.strictEqual(q.correctAnswer, undefined, 'correctAnswer must be stripped');
        assert.strictEqual(q.correctOption, undefined, 'correctOption must be stripped');
        if (q.options) {
          for (const opt of q.options) {
            assert.strictEqual(opt.isCorrect, undefined, 'isCorrect must be stripped in options');
          }
        }
      }
    });
  });

  // ==========================================
  // 4. Input Tampering, Malicious Route Params & NoSQL Safety
  // ==========================================
  describe('4. Input Tampering, Malicious Route Params & NoSQL Injection Safety', () => {
    it('Gracefully rejects non-ObjectId string in assessment ID path parameter with 400 or 404', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/invalid-object-id/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
      });
      assert([400, 404].includes(res.status), `Expected 400 or 404, got ${res.status}`);
    });

    it('Gracefully rejects non-ObjectId string in mock test ID path parameter with 400 or 404', async () => {
      const res = await fetch(`${baseUrl}/api/tests/mock-tests/nonexistent-id-xyz/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
      });
      assert([400, 404].includes(res.status), `Expected 400 or 404, got ${res.status}`);
    });

    it('Gracefully rejects attempt submission on non-existent attemptId with 404', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await fetch(`${baseUrl}/api/tests/mock-tests/attempts/${nonExistentId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({ responses: [] }),
      });
      assert.strictEqual(res.status, 404);
    });

    it('Rejects production requests with x-test-bypass header (403)', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await fetch(`${baseUrl}/api/tests/assessments`, {
          headers: {
            Authorization: `Bearer ${studentAToken}`,
            'x-test-bypass': 'true',
          },
        });
        assert.strictEqual(res.status, 403);
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });

  // ==========================================
  // 5. Future Placeholders & Subsystem Separation
  // ==========================================
  describe('5. Extensible Domain Placeholders & Subsystem Separation', () => {
    it('Returns 501 Not Implemented across HTTP methods on /api/tests/ai-interviews', async () => {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
        const res = await fetch(`${baseUrl}/api/tests/ai-interviews/sessions`, {
          method,
          headers: { Authorization: `Bearer ${studentAToken}` },
        });
        assert.strictEqual(res.status, 501, `${method} /ai-interviews must return 501`);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      }
    });

    it('Returns 501 Not Implemented across HTTP methods on /api/tests/faculty-interviews', async () => {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
        const res = await fetch(`${baseUrl}/api/tests/faculty-interviews/slots`, {
          method,
          headers: { Authorization: `Bearer ${instructorAToken}` },
        });
        assert.strictEqual(res.status, 501, `${method} /faculty-interviews must return 501`);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      }
    });

    it('Question Bank endpoints remain separate and are not accessible under /api/tests', async () => {
      const forbiddenUnifiedPaths = [
        '/api/tests/questions',
        '/api/tests/question-banks',
        '/api/tests/subjects',
        '/api/tests/topics',
      ];
      for (const path of forbiddenUnifiedPaths) {
        const res = await fetch(`${baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${instructorAToken}` },
        });
        assert.strictEqual(res.status, 404, `Path ${path} must return 404 under /api/tests`);
      }
    });
  });
});
