const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const executionApp = require('../../code-IDE-service/src/app');
const executionEnv = require('../../code-IDE-service/src/config/env');
const executionClient = require('../src/services/executionClient.service');
const { generateAccessToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');

const {
  User,
  Assessment,
  Question,
  Submission,
  Evaluation,
} = require('../src/models');

describe('UAP Phase 4 — Evaluation and Scoring Bug Investigation & Fix Verification', () => {
  let backendServer;
  let backendUrl;
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  let instructor;
  let student1;
  let student2;
  let student3;
  let student4;
  let instructorToken;

  let codingAssessment;
  let codingQuestion;
  let studentSubmission;

  before(async () => {
    await connectDB();
    await seedDatabase();

    // 1. Start execution service on ephemeral port
    await new Promise((resolve) => {
      executionServer = http.createServer(executionApp);
      executionServer.listen(0, () => {
        const port = executionServer.address().port;
        originalClientUrl = executionClient.baseUrl;
        originalApiKey = executionClient.apiKey;
        executionClient.baseUrl = `http://127.0.0.1:${port}`;
        executionClient.apiKey = executionEnv.INTERNAL_API_KEY;
        resolve();
      });
    });

    // 2. Start backend Express server on ephemeral port
    await new Promise((resolve) => {
      backendServer = http.createServer(app);
      backendServer.listen(0, () => {
        const port = backendServer.address().port;
        backendUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 3. Setup test users
    await User.deleteMany({ email: { $in: [
      'scoring.eval.inst@uap.edu',
      'scoring.eval.stud1@uap.edu',
      'scoring.eval.stud2@uap.edu',
      'scoring.eval.stud3@uap.edu',
      'scoring.eval.stud4@uap.edu',
    ] } });
    const pass = await hashPassword('Password123');

    instructor = await User.create({
      name: 'Dr. Scoring Evaluator',
      email: 'scoring.eval.inst@uap.edu',
      password: pass,
      role: 'instructor',
      status: 'active',
      isActive: true,
    });

    student1 = await User.create({
      name: 'Alex Student',
      email: 'scoring.eval.stud1@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    student2 = await User.create({
      name: 'Beth Student',
      email: 'scoring.eval.stud2@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    student3 = await User.create({
      name: 'Carl Student',
      email: 'scoring.eval.stud3@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    student4 = await User.create({
      name: 'Dana Student',
      email: 'scoring.eval.stud4@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    instructorToken = generateAccessToken({
      id: instructor._id.toString(),
      email: instructor.email,
      role: instructor.role,
    });

    // 4. Create an Assessment with a 25-point coding question and 60% passing threshold
    codingAssessment = await Assessment.create({
      title: 'Advanced Algorithms Lab Exam',
      category: 'Computer Science',
      instructorId: instructor._id,
      durationMinutes: 60,
      totalPoints: 25,
      passingScore: 60, // 60% required to pass = 15 points
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    codingQuestion = await Question.create({
      assessmentId: codingAssessment._id,
      questionText: 'Implement an algorithm to compute the sum of N numbers.',
      type: 'code',
      points: 25,
      order: 1,
      codingConfig: {
        problemTitle: 'Sum of N Numbers',
        problemDescription: 'Given N integers, compute their sum.',
        inputFormat: 'First line integer N, second line N space-separated integers.',
        outputFormat: 'Single integer denoting sum.',
        allowedLanguages: ['python', 'javascript'],
        cpuTimeLimitMs: 2000,
        memoryLimitMb: 256,
        testCases: [
          { input: '5\n1 2 3 4 5', expectedOutput: '15', isHidden: false, weight: 10, isEnabled: true },
          { input: '3\n10 20 30', expectedOutput: '60', isHidden: true, weight: 15, isEnabled: true },
        ],
      },
    });

    // 5. Create a submitted student submission for student1
    studentSubmission = await Submission.create({
      assessmentId: codingAssessment._id,
      studentId: student1._id,
      status: 'submitted',
      answers: new Map([
        [codingQuestion._id.toString(), {
          code: 'n = int(input())\nnums = list(map(int, input().split()))\nprint(sum(nums))',
          language: 'python',
        }],
      ]),
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
      submittedAt: new Date(),
    });
  });

  after(async () => {
    if (backendServer) {
      await new Promise((resolve) => backendServer.close(resolve));
    }
    if (executionServer) {
      await new Promise((resolve) => executionServer.close(resolve));
    }
    executionClient.baseUrl = originalClientUrl;
    executionClient.apiKey = originalApiKey;
    await disconnectDB();
  });

  describe('BUG 1: Award Score Exceeds Maximum Marks Validation', () => {
    it('should reject awarded score greater than question max marks with HTTP 400 (55 points for 25 max)', async () => {
      const res = await fetch(`${backendUrl}/api/evaluations/submission/${studentSubmission._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Attempting to award 55 points on a 25-point question.',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 55,
              feedback: 'Great effort but over-scored',
            },
          },
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /cannot exceed maximum (points|marks)|pointsAwarded/i);
    });

    it('should reject negative awarded score with HTTP 400/422 (-5 points for 25 max)', async () => {
      const res = await fetch(`${backendUrl}/api/evaluations/submission/${studentSubmission._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Negative score test',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: -5,
              feedback: 'Negative points not allowed',
            },
          },
        }),
      });

      assert.ok([400, 422].includes(res.status), `Expected 400 or 422 but got ${res.status}`);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(JSON.stringify(data), /cannot be negative|greater than or equal to 0|Validation failed/i);
    });

    it('should reject score with more than 2 decimal places with HTTP 400 (15.123 for 25 max)', async () => {
      const res = await fetch(`${backendUrl}/api/evaluations/submission/${studentSubmission._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Too many decimal places',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 15.123,
              feedback: 'Invalid decimal precision',
            },
          },
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /decimal places/i);
    });

    it('should accept score exactly equal to 0 (minimum boundary)', async () => {
      const subZero = await Submission.create({
        assessmentId: codingAssessment._id,
        studentId: student2._id,
        status: 'submitted',
        answers: new Map([[codingQuestion._id.toString(), { code: 'pass', language: 'python' }]]),
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const res = await fetch(`${backendUrl}/api/evaluations/submission/${subZero._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Zero points boundary test',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 0,
              feedback: 'Zero marks awarded',
            },
          },
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      const subData = data.data.submission;
      assert.equal(subData.finalScore, 0);
      assert.equal(subData.percentage, 0);
      assert.equal(subData.passed, false);
      assert.equal(subData.resultStatus, 'failed');
    });

    it('should accept valid score with 1 or 2 decimal places (18.5 for 25 max)', async () => {
      const subDecimal = await Submission.create({
        assessmentId: codingAssessment._id,
        studentId: student3._id,
        status: 'submitted',
        answers: new Map([[codingQuestion._id.toString(), { code: 'print(15)', language: 'python' }]]),
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const res = await fetch(`${backendUrl}/api/evaluations/submission/${subDecimal._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Decimal score test',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 18.5,
              feedback: '18.5 points awarded',
            },
          },
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      const subData = data.data.submission;
      assert.equal(subData.finalScore, 18.5);
      assert.equal(subData.percentage, 74);
      assert.equal(subData.passed, true);
      assert.equal(subData.resultStatus, 'passed');
    });
  });

  describe('BUG 2: Full Marks Showing Failed Evaluation Investigation & Fix', () => {
    it('should compute 100% score, passed=true, and resultStatus=passed when awarded 25/25 on coding question', async () => {
      const res = await fetch(`${backendUrl}/api/evaluations/submission/${studentSubmission._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Excellent work. Perfect solution.',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 25,
              feedback: 'All test cases passed. Full marks.',
            },
          },
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify the evaluation and submission data
      const subData = data.data.submission;
      const evalData = data.data.evaluation;
      assert.equal(subData.manualScore, 25, 'Manual score must be 25 for coding question');
      assert.equal(subData.finalScore, 25, 'Final score must equal 25/25');
      assert.equal(subData.percentage, 100, 'Percentage must be 100%');
      assert.equal(subData.passed, true, 'passed must be true when score >= 60%');
      assert.equal(subData.resultStatus, 'passed', 'resultStatus must be passed, NOT failed!');
      assert.equal(evalData.finalScore, 25);
      assert.equal(evalData.passed, true);

      // Verify the submission status is updated in database
      const updatedSub = await Submission.findById(studentSubmission._id);
      assert.equal(updatedSub.status, 'evaluated');
      assert.equal(updatedSub.score, 25);
      assert.equal(updatedSub.passed, true);
      assert.equal(updatedSub.resultStatus, 'passed');
    });

    it('should compute partial pass when score meets passing threshold (15/25 = 60%)', async () => {
      const subPartial = await Submission.create({
        assessmentId: codingAssessment._id,
        studentId: student4._id,
        status: 'submitted',
        answers: new Map([[codingQuestion._id.toString(), { code: 'print(15)', language: 'python' }]]),
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const res = await fetch(`${backendUrl}/api/evaluations/submission/${subPartial._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Passing with minimum score',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 15,
              feedback: 'Passed sample cases but missed one hidden case',
            },
          },
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      const subData = data.data.submission;
      assert.equal(subData.finalScore, 15);
      assert.equal(subData.percentage, 60);
      assert.equal(subData.passed, true);
      assert.equal(subData.resultStatus, 'passed');
    });

    it('should compute fail when score is below passing threshold (10/25 = 40% < 60%)', async () => {
      const student5 = await User.create({
        name: 'Evan Student',
        email: 'scoring.eval.stud5@uap.edu',
        password: await hashPassword('Password123'),
        role: 'student',
        status: 'active',
        isActive: true,
      });

      const subFail = await Submission.create({
        assessmentId: codingAssessment._id,
        studentId: student5._id,
        status: 'submitted',
        answers: new Map([[codingQuestion._id.toString(), { code: 'print(10)', language: 'python' }]]),
        startedAt: new Date(),
        submittedAt: new Date(),
      });

      const res = await fetch(`${backendUrl}/api/evaluations/submission/${subFail._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          feedback: 'Fails to meet passing threshold',
          questionFeedback: {
            [codingQuestion._id.toString()]: {
              pointsAwarded: 10,
              feedback: 'Only 10/25 awarded',
            },
          },
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      const subData = data.data.submission;
      assert.equal(subData.finalScore, 10);
      assert.equal(subData.percentage, 40);
      assert.equal(subData.passed, false);
      assert.equal(subData.resultStatus, 'failed');
    });
  });
});
