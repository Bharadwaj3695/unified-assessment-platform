const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const { User, Assessment, Question, Submission, MockTest, MockTestAttempt, Subject } = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Phase 1: Unified Test API Route Facade (/api/tests)', () => {
  let server;
  let baseUrl;
  let studentUser;
  let instructorUser;
  let adminUser;
  let studentToken;
  let instructorToken;
  let adminToken;

  before(async () => {
    await connectDB();
    await seedDatabase();

    studentUser = await User.findOne({ email: 'student@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    assert(studentUser, 'Student seed account must exist');
    assert(instructorUser, 'Instructor seed account must exist');
    assert(adminUser, 'Admin seed account must exist');

    studentToken = generateAccessToken({
      id: studentUser._id.toString(),
      role: studentUser.role,
      email: studentUser.email,
      tokenVersion: studentUser.tokenVersion || 0,
    });
    instructorToken = generateAccessToken({
      id: instructorUser._id.toString(),
      role: instructorUser.role,
      email: instructorUser.email,
      tokenVersion: instructorUser.tokenVersion || 0,
    });
    adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      role: adminUser.role,
      email: adminUser.email,
      tokenVersion: adminUser.tokenVersion || 0,
    });

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

  // --- 1. Root API Endpoint Map ---
  it('Root API catalog lists /api/tests and preserves legacy endpoints', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.endpoints.tests, '/api/tests');
    assert.strictEqual(body.endpoints.assessments, '/api/assessments');
    assert.strictEqual(body.endpoints.submissions, '/api/submissions');
    assert.strictEqual(body.endpoints.evaluations, '/api/evaluations');
  });

  it('Verify /api/v1/tests is no longer mounted (returns 404)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tests/assessments`);
    assert.strictEqual(res.status, 404);
  });

  // --- 2. Assessment Domain Parity ---
  it('GET /api/tests/assessments rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tests/assessments`);
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/assessments and /api/tests/assessments return identical data for student', async () => {
    const [legacyRes, unifiedRes] = await Promise.all([
      fetch(`${baseUrl}/api/assessments`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      }),
      fetch(`${baseUrl}/api/tests/assessments`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      }),
    ]);

    assert.strictEqual(legacyRes.status, 200);
    assert.strictEqual(unifiedRes.status, 200);

    const legacyBody = await legacyRes.json();
    const unifiedBody = await unifiedRes.json();

    assert.strictEqual(unifiedBody.success, true);
    assert.strictEqual(unifiedBody.total, legacyBody.total);
    assert.strictEqual(unifiedBody.data.length, legacyBody.data.length);
  });

  it('GET /api/tests/assessments/certificate-templates enforces RBAC (403 for student, 200 for instructor)', async () => {
    const studentRes = await fetch(`${baseUrl}/api/tests/assessments/certificate-templates`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentRes.status, 403);

    const instructorRes = await fetch(`${baseUrl}/api/tests/assessments/certificate-templates`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(instructorRes.status, 200);
  });

  // --- 3. Assessment Attempts (Submissions) Domain-Nested Parity ---
  it('GET /api/tests/assessments/attempts/mine returns student submissions with 200', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/tests/assessments/attempts/mine`);
    assert.strictEqual(unauthRes.status, 401);

    const authRes = await fetch(`${baseUrl}/api/tests/assessments/attempts/mine`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(authRes.status, 200);
    const body = await authRes.json();
    assert.strictEqual(body.success, true);
    assert(Array.isArray(body.data));
  });

  it('POST /api/tests/assessments/:id/attempts enforces student authorization and authentication', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/tests/assessments/60c72b2f9b1d8b001c8e4f1a/attempts`, {
      method: 'POST',
    });
    assert.strictEqual(unauthRes.status, 401);

    const instructorRes = await fetch(`${baseUrl}/api/tests/assessments/60c72b2f9b1d8b001c8e4f1a/attempts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    // Instructor should be forbidden from taking assessment as student
    assert.strictEqual(instructorRes.status, 403);
  });

  // --- 4. Assessment Evaluations Domain-Nested Parity ---
  it('GET /api/tests/assessments/evaluations/instructor/submissions enforces RBAC and parity', async () => {
    const studentRes = await fetch(`${baseUrl}/api/tests/assessments/evaluations/instructor/submissions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentRes.status, 403);

    const [legacyRes, unifiedRes] = await Promise.all([
      fetch(`${baseUrl}/api/evaluations/instructor/submissions`, {
        headers: { Authorization: `Bearer ${instructorToken}` },
      }),
      fetch(`${baseUrl}/api/tests/assessments/evaluations/instructor/submissions`, {
        headers: { Authorization: `Bearer ${instructorToken}` },
      }),
    ]);

    assert.strictEqual(legacyRes.status, 200);
    assert.strictEqual(unifiedRes.status, 200);

    const legacyBody = await legacyRes.json();
    const unifiedBody = await unifiedRes.json();
    assert.strictEqual(unifiedBody.total, legacyBody.total);
  });

  // --- 5. Mock Test Domain Parity ---
  it('GET /api/tests/mock-tests rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tests/mock-tests`);
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/mock-tests and /api/tests/mock-tests return identical data for student', async () => {
    const [legacyRes, unifiedRes] = await Promise.all([
      fetch(`${baseUrl}/api/mock-tests`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      }),
      fetch(`${baseUrl}/api/tests/mock-tests`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      }),
    ]);

    assert.strictEqual(legacyRes.status, 200);
    assert.strictEqual(unifiedRes.status, 200);

    const legacyBody = await legacyRes.json();
    const unifiedBody = await unifiedRes.json();
    assert.strictEqual(unifiedBody.success, true);
    assert.deepStrictEqual(unifiedBody.data, legacyBody.data);
  });

  it('POST /api/tests/mock-tests enforces RBAC (student rejected with 403)', async () => {
    const res = await fetch(`${baseUrl}/api/tests/mock-tests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Student Illegal Test' }),
    });
    assert.strictEqual(res.status, 403);
  });

  it('POST /api/tests/mock-tests/:id/attempts pluralized alias requires student authentication', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/tests/mock-tests/60c72b2f9b1d8b001c8e4f1a/attempts`, {
      method: 'POST',
    });
    assert.strictEqual(unauthRes.status, 401);
  });

  // --- 6. Future Architectural Placeholders (Interviews) ---
  it('GET /api/tests/ai-interviews returns 501 Not Implemented', async () => {
    const res = await fetch(`${baseUrl}/api/tests/ai-interviews`);
    assert.strictEqual(res.status, 501);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /planned for a future release/i);
  });

  it('POST /api/tests/faculty-interviews returns 501 Not Implemented', async () => {
    const res = await fetch(`${baseUrl}/api/tests/faculty-interviews`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 501);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.message, /planned for a future release/i);
  });

  // --- 7. Question Bank Subsystem Isolation ---
  it('Question Bank APIs remain separate and are NOT mounted under /api/tests', async () => {
    // /api/questions is accessible
    const qLegacyRes = await fetch(`${baseUrl}/api/questions`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(qLegacyRes.status, 200);

    // /api/tests/questions should return 404 Not Found
    const qUnifiedRes = await fetch(`${baseUrl}/api/tests/questions`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(qUnifiedRes.status, 404);

    // /api/subjects is accessible
    const sLegacyRes = await fetch(`${baseUrl}/api/subjects`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(sLegacyRes.status, 200);

    // /api/tests/subjects should return 404 Not Found
    const sUnifiedRes = await fetch(`${baseUrl}/api/tests/subjects`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(sUnifiedRes.status, 404);
  });

  // --- 8. Phase 2: Full Lifecycle Contract Parity & State Mutation Suite ---
  describe('Phase 2: Lifecycle Contract Parity & State Mutation Suite', () => {
    let testSubject;
    let testQuestion;
    let testAssessment;
    let testMockTest;
    let q0;
    let q1;
    let createdAssessmentAttemptId;
    let createdMockAttemptId;

    before(async () => {
      testSubject = await Subject.findOne({ name: 'Computer Science' });
      if (!testSubject) {
        testSubject = await Subject.create({
          name: 'Computer Science',
          code: 'CS',
          createdBy: instructorUser._id,
        });
      }

      testQuestion = await Question.create({
        subjectId: testSubject._id,
        statement: 'What is O(1) time complexity?',
        questionType: 'SINGLE_MCQ',
        options: [
          { id: 'A', text: 'Constant time complexity', isCorrect: true },
          { id: 'B', text: 'Linear time complexity', isCorrect: false },
        ],
        answerKey: 'A',
        status: 'PUBLISHED',
        ownerFacultyId: instructorUser._id,
      });

      testMockTest = await MockTest.create({
        title: 'Phase 2 Parity Mock Test',
        subjectId: testSubject._id,
        ownerFacultyId: instructorUser._id,
        status: 'PUBLISHED',
        durationMinutes: 60,
        totalMarks: 10,
        questionCount: 1,
        resolvedQuestions: [
          {
            questionId: testQuestion._id,
            versionNumber: 1,
            questionSnapshot: {
              questionText: 'What is O(1) time complexity?',
              type: 'SINGLE_MCQ',
              options: [
                { id: 'A', text: 'Constant time complexity', isCorrect: true },
                { id: 'B', text: 'Linear time complexity', isCorrect: false },
              ],
              answerKey: 'A',
              correctAnswer: 'A',
            },
            marks: 10,
            orderIndex: 0,
          },
        ],
      });

      testAssessment = await Assessment.create({
        title: 'Phase 2 Parity Assessment',
        category: 'Computer Science',
        instructorId: instructorUser._id,
        durationMinutes: 60,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
      });

      q0 = await Question.create({
        assessmentId: testAssessment._id,
        questionText: 'Is Node.js event loop single-threaded?',
        type: 'mcq',
        points: 50,
        options: [
          { id: 'opt_a', text: 'Yes, event loop is single-threaded' },
          { id: 'opt_b', text: 'No, it has 100 threads' },
        ],
        correctAnswer: 'opt_a',
      });

      q1 = await Question.create({
        assessmentId: testAssessment._id,
        questionText: 'Explain event loop processing.',
        type: 'short_answer',
        points: 50,
        correctAnswer: 'Processes async callbacks',
      });
    });

    after(async () => {
      if (testAssessment) {
        await Submission.deleteMany({ assessmentId: testAssessment._id });
        await Assessment.deleteOne({ _id: testAssessment._id });
        await Question.deleteMany({ assessmentId: testAssessment._id });
      }
      if (testMockTest) {
        await MockTestAttempt.deleteMany({ mockTestId: testMockTest._id });
        await MockTest.deleteOne({ _id: testMockTest._id });
      }
      if (testQuestion) {
        await Question.deleteOne({ _id: testQuestion._id });
      }
    });

    it('Student starts assessment attempt using route param :id (POST /api/tests/assessments/:id/attempts)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/assessments/${testAssessment._id}/attempts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.message, 'Assessment attempt started');
      assert.strictEqual(body.data.assessmentId.toString(), testAssessment._id.toString());
      assert.strictEqual(body.data.status, 'in_progress');
      createdAssessmentAttemptId = body.data._id;
    });

    it('Student autosaves answer via unified route (PATCH /api/tests/assessments/attempts/:submissionId/answers/:questionId)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/assessments/attempts/${createdAssessmentAttemptId}/answers/${q0._id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answer: 'opt_a', clientTimestamp: Date.now() }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.message, 'Answer autosaved successfully');

      const sub = await Submission.findById(createdAssessmentAttemptId);
      assert.strictEqual(sub.answers.get(q0._id.toString()), 'opt_a');
    });

    it('Student saves progress via unified route (PUT /api/tests/assessments/attempts/:id/progress)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/assessments/attempts/${createdAssessmentAttemptId}/progress`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answers: {
              [q0._id.toString()]: 'opt_a',
              [q1._id.toString()]: 'Non-blocking I/O orchestration',
            },
          }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.message, 'Progress saved successfully');
    });

    it('Student submits assessment via unified route (POST /api/tests/assessments/attempts/:id/submit)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/assessments/attempts/${createdAssessmentAttemptId}/submit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answers: {
              [q0._id.toString()]: 'opt_a',
              [q1._id.toString()]: 'Non-blocking I/O orchestration',
            },
            timeSpentSeconds: 150,
          }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.message, 'Assessment submitted successfully');

      const sub = await Submission.findById(createdAssessmentAttemptId);
      assert.strictEqual(sub.status, 'submitted');
      assert.strictEqual(sub.autoScore, 50);
    });

    it('Instructor retrieves evaluation queue via unified alias (GET /api/tests/assessments/evaluations)', async () => {
      const [legacyRes, unifiedRes] = await Promise.all([
        fetch(`${baseUrl}/api/evaluations/instructor/submissions?assessmentId=${testAssessment._id}`, {
          headers: { Authorization: `Bearer ${instructorToken}` },
        }),
        fetch(`${baseUrl}/api/tests/assessments/evaluations?assessmentId=${testAssessment._id}`, {
          headers: { Authorization: `Bearer ${instructorToken}` },
        }),
      ]);

      assert.strictEqual(legacyRes.status, 200);
      assert.strictEqual(unifiedRes.status, 200);

      const legacyBody = await legacyRes.json();
      const unifiedBody = await unifiedRes.json();

      assert.strictEqual(unifiedBody.success, true);
      assert.strictEqual(unifiedBody.pagination.totalCount, 1);
      assert.strictEqual(unifiedBody.pagination.totalCount, legacyBody.pagination.totalCount);
      assert.strictEqual(unifiedBody.data[0]._id.toString(), createdAssessmentAttemptId.toString());
      assert.strictEqual(unifiedBody.data[0]._id.toString(), legacyBody.data[0]._id.toString());
    });

    it('Instructor manually grades assessment attempt via unified route (POST /api/tests/assessments/attempts/:attemptId/evaluate)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/assessments/attempts/${createdAssessmentAttemptId}/evaluate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${instructorToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            finalScore: 90,
            generalFeedback: 'Clear explanation of asynchronous event handling.',
            questionFeedback: {
              [q1._id.toString()]: {
                pointsAwarded: 40,
                comment: 'Accurate and concise.',
              },
            },
          }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.message, 'Submission evaluated successfully');

      const sub = await Submission.findById(createdAssessmentAttemptId);
      assert.strictEqual(sub.status, 'evaluated');
      assert.strictEqual(sub.score, 90);
    });

    it('Student starts mock test attempt with valid Bearer token via plural alias (POST /api/tests/mock-tests/:id/attempts)', async () => {
      const res = await fetch(`${baseUrl}/api/tests/mock-tests/${testMockTest._id}/attempts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.message, 'Mock test attempt started');
      assert.strictEqual(body.data.mockTest.id.toString(), testMockTest._id.toString());
      createdMockAttemptId = body.data.attemptId;

      const attempt = await MockTestAttempt.findById(createdMockAttemptId);
      assert.strictEqual(attempt.studentId.toString(), studentUser._id.toString());
      assert.strictEqual(attempt.status, 'IN_PROGRESS');
    });

    it('Student submits mock test attempt using :attemptId in path (POST /api/tests/mock-tests/attempts/:attemptId/submit)', async () => {
      const res = await fetch(
        `${baseUrl}/api/tests/mock-tests/attempts/${createdMockAttemptId}/submit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            responses: [
              {
                questionId: testQuestion._id.toString(),
                selectedOption: 'A',
                timeSpentSeconds: 30,
              },
            ],
          }),
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const attempt = await MockTestAttempt.findById(createdMockAttemptId);
      assert(['SUBMITTED', 'EVALUATED'].includes(attempt.status));
      assert.strictEqual(attempt.autoScore, 10);
      assert.strictEqual(attempt.earnedMarks, 10);
    });
  });
});
