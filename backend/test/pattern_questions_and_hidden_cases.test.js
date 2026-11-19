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
} = require('../src/models');

const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');

describe('UAP Phase 3 — Pattern Questions, Edge Cases & Hidden Test Case Verification', () => {
  let backendServer;
  let backendUrl;
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  let facultyUser;
  let studentUser;
  let facultyToken;
  let studentToken;

  let patternAssessment;
  let problemA_Basic;
  let problemB_NumberInput;
  let problemC_EvenOdd;
  let problemD_SumN;
  let problemE_StarPattern;
  let problemF_InvertedPattern;
  let problemG_NumberPattern;
  let problemH_PyramidPattern;
  let problemI_EdgeCases;

  before(async () => {
    await connectDB();
    await seedDatabase();

    // 1. Start execution service on ephemeral port and bind backend client
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

    // 3. Create test users
    await User.deleteMany({ email: { $in: ['pattern.faculty@uap.edu', 'pattern.student@uap.edu'] } });
    const pass = await hashPassword('Password123');

    facultyUser = await User.create({
      name: 'Professor Pattern',
      email: 'pattern.faculty@uap.edu',
      password: pass,
      role: 'instructor',
      status: 'active',
      isActive: true,
    });

    studentUser = await User.create({
      name: 'Sammy Student',
      email: 'pattern.student@uap.edu',
      password: pass,
      role: 'student',
      status: 'active',
      isActive: true,
    });

    facultyToken = generateAccessToken({
      id: facultyUser._id.toString(),
      email: facultyUser.email,
      role: facultyUser.role,
    });

    studentToken = generateAccessToken({
      id: studentUser._id.toString(),
      email: studentUser.email,
      role: studentUser.role,
    });

    // 4. Create an Assessment for Pattern Questions
    patternAssessment = await Assessment.create({
      title: 'Algorithmic Patterns and Loop Logic Examination',
      category: 'Computer Science',
      instructorId: facultyUser._id,
      durationMinutes: 90,
      totalPoints: 90,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    // Problem A: Basic Output
    problemA_Basic = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Write a program to print Welcome.',
      type: 'code',
      points: 10,
      order: 1,
      codingConfig: {
        problemTitle: 'Problem A – Basic Output',
        problemDescription: 'Print the message "Welcome" exactly as specified.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '', expectedOutput: 'Welcome', isHidden: false, isEnabled: true, weight: 5 },
          { input: '', expectedOutput: 'Welcome', isHidden: true, isEnabled: true, weight: 5 },
        ],
      },
    });

    // Problem B: Number Input
    problemB_NumberInput = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Read an integer and print the same integer.',
      type: 'code',
      points: 10,
      order: 2,
      codingConfig: {
        problemTitle: 'Problem B – Number Input',
        problemDescription: 'Read an integer from standard input and print it.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '25', expectedOutput: '25', isHidden: false, isEnabled: true, weight: 5 },
          { input: '100', expectedOutput: '100', isHidden: true, weight: 5, isEnabled: true },
        ],
      },
    });

    // Problem C: Even or Odd
    problemC_EvenOdd = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Read an integer and print "Even" if even or "Odd" if odd.',
      type: 'code',
      points: 10,
      order: 3,
      codingConfig: {
        problemTitle: 'Problem C – Even or Odd',
        problemDescription: 'Check whether the input integer is Even or Odd.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '7', expectedOutput: 'Odd', isHidden: false, isEnabled: true, weight: 2.5 },
          { input: '10', expectedOutput: 'Even', isHidden: false, isEnabled: true, weight: 2.5 },
          { input: '0', expectedOutput: 'Even', isHidden: true, isEnabled: true, weight: 2.5 },
          { input: '-7', expectedOutput: 'Odd', isHidden: true, isEnabled: true, weight: 2.5 },
        ],
      },
    });

    // Problem D: Sum of N Numbers
    problemD_SumN = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Given integer N followed by N integers, compute their sum.',
      type: 'code',
      points: 10,
      order: 4,
      codingConfig: {
        problemTitle: 'Problem D – Sum of N Numbers',
        problemDescription: 'Sum of N numbers from input.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '5\n1 2 3 4 5', expectedOutput: '15', isHidden: false, isEnabled: true, weight: 5 },
          { input: '4\n10 20 30 40', expectedOutput: '100', isHidden: true, isEnabled: true, weight: 5 },
        ],
      },
    });

    // Problem E: Star Pattern
    problemE_StarPattern = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Given integer N, print a right-angled triangle of stars with height N.',
      type: 'code',
      points: 10,
      order: 5,
      codingConfig: {
        problemTitle: 'Problem E – Star Pattern',
        problemDescription: 'Print increasing stars from 1 to N.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '5', expectedOutput: '*\n**\n***\n****\n*****', isHidden: false, isEnabled: true, weight: 5 },
          { input: '3', expectedOutput: '*\n**\n***', isHidden: true, isEnabled: true, weight: 5 },
        ],
      },
    });

    // Problem F: Inverted Pattern
    problemF_InvertedPattern = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Given integer N, print an inverted right-angled triangle of stars from N down to 1.',
      type: 'code',
      points: 10,
      order: 6,
      codingConfig: {
        problemTitle: 'Problem F – Inverted Pattern',
        problemDescription: 'Print decreasing stars from N to 1.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '4', expectedOutput: '****\n***\n**\n*', isHidden: false, isEnabled: true, weight: 5 },
          { input: '2', expectedOutput: '**\n*', isHidden: true, isEnabled: true, weight: 5 },
        ],
      },
    });

    // Problem G: Number Pattern
    problemG_NumberPattern = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Given integer N, print number pattern where row i contains 1..i.',
      type: 'code',
      points: 10,
      order: 7,
      codingConfig: {
        problemTitle: 'Problem G – Number Pattern',
        problemDescription: 'Print consecutive numbers per row.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '4', expectedOutput: '1\n12\n123\n1234', isHidden: false, isEnabled: true, weight: 5 },
          { input: '3', expectedOutput: '1\n12\n123', isHidden: true, isEnabled: true, weight: 5 },
        ],
      },
    });

    // Problem H: Nested Loop Pattern (Pyramid with leading spaces)
    problemH_PyramidPattern = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Given integer N, print centered pyramid pattern with leading spaces.',
      type: 'code',
      points: 10,
      order: 8,
      codingConfig: {
        problemTitle: 'Problem H – Nested Loop Pattern',
        problemDescription: 'Print pyramid with exact leading spaces.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '3', expectedOutput: '  *\n ***\n*****', isHidden: false, isEnabled: true, weight: 5 },
          { input: '2', expectedOutput: ' *\n***', isHidden: true, isEnabled: true, weight: 5 },
        ],
      },
    });

    // Problem I: Edge Cases
    problemI_EdgeCases = await Question.create({
      assessmentId: patternAssessment._id,
      questionText: 'Handle edge cases: 0, negative numbers, extra whitespace.',
      type: 'code',
      points: 10,
      order: 9,
      codingConfig: {
        problemTitle: 'Problem I – Edge Cases',
        problemDescription: 'Edge case handling and validation.',
        allowedLanguages: ['python', 'javascript'],
        testCases: [
          { input: '  0  \n', expectedOutput: '0', isHidden: false, isEnabled: true, weight: 2.5 },
          { input: '-42', expectedOutput: '-42', isHidden: false, isEnabled: true, weight: 2.5 },
          { input: '1000000000', expectedOutput: '1000000000', isHidden: true, isEnabled: true, weight: 2.5 },
          { input: '1', expectedOutput: '1', isHidden: true, isEnabled: true, weight: 2.5 },
        ],
      },
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

  describe('1. Pattern Questions Evaluation (Problems A through I)', () => {
    it('Problem A: should evaluate basic output "Welcome"', async () => {
      const code = 'print("Welcome")';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemA_Basic.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem B: should evaluate integer input/output (25 -> 25)', async () => {
      const code = 'x = input().strip()\nprint(x)';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemB_NumberInput.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem C: should evaluate Even or Odd (7 -> Odd, 10 -> Even, 0 -> Even, -7 -> Odd)', async () => {
      const code = 'n = int(input().strip())\nprint("Even" if n % 2 == 0 else "Odd")';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemC_EvenOdd.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 4);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem D: should evaluate Sum of N Numbers (5 \\n 1 2 3 4 5 -> 15)', async () => {
      const code = 'n = int(input().strip())\nnums = list(map(int, input().split()))\nprint(sum(nums))';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemD_SumN.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem E: should evaluate Star Pattern (5 -> 1..5 stars)', async () => {
      const code = 'n = int(input().strip())\nfor i in range(1, n + 1):\n    print("*" * i)';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemE_StarPattern.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem F: should evaluate Inverted Pattern (4 -> 4..1 stars)', async () => {
      const code = 'n = int(input().strip())\nfor i in range(n, 0, -1):\n    print("*" * i)';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemF_InvertedPattern.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem G: should evaluate Number Pattern (4 -> 1, 12, 123, 1234)', async () => {
      const code = 'n = int(input().strip())\nfor i in range(1, n + 1):\n    print("".join(str(j) for j in range(1, i + 1)))';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemG_NumberPattern.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem H: should evaluate Pyramid with leading spaces (3 -> "  *", " ***", "*****")', async () => {
      const code = 'n = int(input().strip())\nfor i in range(1, n + 1):\n    spaces = " " * (n - i)\n    stars = "*" * (2 * i - 1)\n    print(spaces + stars)';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemH_PyramidPattern.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 2);
      assert.equal(suite.data.data.scoreFraction, 1);
    });

    it('Problem I: should evaluate Edge Cases (whitespace, negatives, large numbers)', async () => {
      const code = 'val = input().strip()\nprint(val)';
      const suite = await executionClient.executeSuite({
        language: 'python',
        code,
        testCases: problemI_EdgeCases.codingConfig.testCases,
        isFaculty: true,
      });

      assert.equal(suite.ok, true);
      assert.equal(suite.data.data.passedCount, 4);
      assert.equal(suite.data.data.scoreFraction, 1);
    });
  });

  describe('2. Hidden Test Cases Security & Authorization Isolation', () => {
    it('should strictly filter out hidden test cases when student fetches assessment', async () => {
      const res = await fetch(`${backendUrl}/api/assessments/${patternAssessment._id}`, {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify each question only has public test cases for the student
      const questions = data.data.questions;
      assert.ok(questions.length > 0);

      questions.forEach((q) => {
        if (q.codingConfig && q.codingConfig.testCases) {
          const hasHidden = q.codingConfig.testCases.some((tc) => tc.isHidden === true);
          assert.equal(hasHidden, false, `Question ${q.order} must not expose hidden test cases to student`);
        }
      });
    });

    it('should allow faculty to view both public and hidden test cases with full details', async () => {
      const res = await fetch(`${backendUrl}/api/assessments/${patternAssessment._id}`, {
        headers: {
          Authorization: `Bearer ${facultyToken}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      const qPyramid = data.data.questions.find((q) => q._id === problemH_PyramidPattern._id.toString());
      assert.ok(qPyramid);
      assert.equal(qPyramid.codingConfig.testCases.length, 2, 'Faculty must see both public and hidden test cases');
      const hiddenCase = qPyramid.codingConfig.testCases.find((tc) => tc.isHidden);
      assert.ok(hiddenCase);
      assert.equal(hiddenCase.input, '2');
      assert.equal(hiddenCase.expectedOutput, ' *\n***');
    });

    it('should allow faculty to test code via POST /api/assessments/test-code and view unmasked results', async () => {
      const res = await fetch(`${backendUrl}/api/assessments/test-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${facultyToken}`,
        },
        body: JSON.stringify({
          language: 'python',
          code: 'n = int(input().strip())\nfor i in range(1, n + 1):\n    spaces = " " * (n - i)\n    stars = "*" * (2 * i - 1)\n    print(spaces + stars)',
          testCases: problemH_PyramidPattern.codingConfig.testCases,
          runAll: true,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      const suiteData = data.data;
      assert.equal(suiteData.passedCount, 2);
      assert.equal(suiteData.totalCount, 2);

      // Verify unmasked hidden test case for faculty
      const hiddenResult = suiteData.testCases.find((tc) => tc.isHidden);
      assert.ok(hiddenResult);
      assert.notEqual(hiddenResult.input, '[HIDDEN]');
      assert.notEqual(hiddenResult.expectedOutput, '[HIDDEN]');
      assert.equal(hiddenResult.passed, true);
    });

    it('should restrict student run-code during attempt to ONLY public test cases', async () => {
      const studentSub = await Submission.create({
        assessmentId: patternAssessment._id,
        studentId: studentUser._id,
        status: 'in_progress',
        answers: new Map(),
        startedAt: new Date(),
        deadlineAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const res = await fetch(`${backendUrl}/api/submissions/${studentSub._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          questionId: problemH_PyramidPattern._id.toString(),
          code: 'n = int(input().strip())\nfor i in range(1, n + 1):\n    spaces = " " * (n - i)\n    stars = "*" * (2 * i - 1)\n    print(spaces + stars)',
          language: 'python',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify student only ran against 1 public test case (totalCount === 1)
      const runResult = data.data;
      assert.equal(runResult.totalCount, 1, 'Student runCode must evaluate strictly against public test cases');
      assert.equal(runResult.passedCount, 1);
      assert.equal(runResult.sampleResults.length, 1);
      assert.equal(runResult.sampleResults[0].passed, true);
    });
  });
});
