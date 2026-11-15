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

const submissionService = require('../src/services/submission.service');

describe('UAP Phase 3 — Student Coding & SQL Assessment Interface Verification', () => {
  let backendServer;
  let backendUrl;
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  let instructorUser;
  let studentAlice;
  let studentBob;
  let studentCharlie;

  let instructorToken;
  let studentAliceToken;
  let studentBobToken;
  let studentCharlieToken;

  let testAssessment;
  let pythonCodeQuestion;
  let jsCodeQuestion;
  let sqliteQuestion;
  let mcqQuestion;
  let essayQuestion;

  let activeSubmissionAlice;
  let submittedSubmissionCharlie;
  let activeSubmissionBob;

  before(async () => {
    // 1. Database setup
    await connectDB();
    await seedDatabase();

    // 2. Start Execution Service on ephemeral port and bind backend executionClient
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

    // 3. Start Backend Express App on ephemeral port
    await new Promise((resolve) => {
      backendServer = http.createServer(app);
      backendServer.listen(0, () => {
        const port = backendServer.address().port;
        backendUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 4. Create test users
    const passwordHash = await hashPassword('StudentP3Secure!123');

    instructorUser = await User.create({
      name: 'Dr. Turing Phase3',
      email: 'p3_instructor@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P3-100',
      department: 'Computer Science',
    });

    studentAlice = await User.create({
      name: 'Alice Student P3',
      email: 'p3_alice@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P3-001',
    });

    studentBob = await User.create({
      name: 'Bob Student P3',
      email: 'p3_bob@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P3-002',
    });

    studentCharlie = await User.create({
      name: 'Charlie Student P3',
      email: 'p3_charlie@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P3-003',
    });

    instructorToken = generateAccessToken({ id: instructorUser._id.toString(), role: instructorUser.role, email: instructorUser.email });
    studentAliceToken = generateAccessToken({ id: studentAlice._id.toString(), role: studentAlice.role, email: studentAlice.email });
    studentBobToken = generateAccessToken({ id: studentBob._id.toString(), role: studentBob.role, email: studentBob.email });
    studentCharlieToken = generateAccessToken({ id: studentCharlie._id.toString(), role: studentCharlie.role, email: studentCharlie.email });

    // 5. Create Assessment first to satisfy Question.assessmentId foreign key
    const now = new Date();
    testAssessment = await Assessment.create({
      title: 'CS 101 Midterm — Code & SQL Interface Exam',
      description: 'Phase 3 Verification Assessment',
      instructorId: instructorUser._id,
      status: 'published',
      questions: [],
      durationMinutes: 60,
      passingPercentage: 60,
      totalPoints: 50,
      scheduling: {
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 120 * 60 * 1000),
      },
    });

    // 6. Create Questions with assessmentId
    // Python coding question with public and hidden test cases
    pythonCodeQuestion = await Question.create({
      assessmentId: testAssessment._id,
      instructorId: instructorUser._id,
      questionText: 'Implement a function that reads two space-separated integers and outputs their sum.',
      type: 'code',
      points: 10,
      difficulty: 'EASY',
      codingConfig: {
        executionCategory: 'code',
        allowedLanguages: ['python', 'javascript'],
        defaultLanguage: 'python',
        starterCode: {
          python: 'import sys\n# Read input and print sum\nline = sys.stdin.read().strip()\nif line:\n    a, b = map(int, line.split())\n    print(a + b)\n',
          javascript: 'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf-8").trim();\nif (input) {\n  const [a, b] = input.split(/\\s+/).map(Number);\n  console.log(a + b);\n}\n',
        },
        cpuTimeLimitMs: 2000,
        memoryLimitMb: 128,
        testCases: [
          {
            input: '3 5',
            expectedOutput: '8',
            isHidden: false,
            explanation: '3 + 5 = 8',
            weight: 5,
          },
          {
            input: '100 200',
            expectedOutput: '300',
            isHidden: true, // STRICTLY CONFIDENTIAL HIDDEN CASE
            explanation: 'Hidden boundary test',
            weight: 5,
          },
        ],
      },
    });

    // JavaScript coding question
    jsCodeQuestion = await Question.create({
      assessmentId: testAssessment._id,
      instructorId: instructorUser._id,
      questionText: 'Given an integer N via standard input, print "EVEN" or "ODD".',
      type: 'code',
      points: 10,
      difficulty: 'EASY',
      codingConfig: {
        executionCategory: 'code',
        allowedLanguages: ['javascript', 'python'],
        defaultLanguage: 'javascript',
        starterCode: {
          javascript: 'const fs = require("fs");\nconst n = parseInt(fs.readFileSync(0, "utf-8").trim(), 10);\nconsole.log(n % 2 === 0 ? "EVEN" : "ODD");\n',
        },
        cpuTimeLimitMs: 2000,
        memoryLimitMb: 128,
        testCases: [
          {
            input: '4',
            expectedOutput: 'EVEN',
            isHidden: false,
            explanation: '4 is divisible by 2',
            weight: 5,
          },
        ],
      },
    });

    // SQL Question (SQLite Dialect)
    sqliteQuestion = await Question.create({
      assessmentId: testAssessment._id,
      instructorId: instructorUser._id,
      questionText: 'Select all active students ordered by name ascending.',
      type: 'sql',
      points: 15,
      difficulty: 'MEDIUM',
      codingConfig: {
        executionCategory: 'sql',
        sqlDialect: 'sqlite',
        schemaDdl: `
          CREATE TABLE students (id INT PRIMARY KEY, name TEXT, is_active INT);
          INSERT INTO students VALUES (1, 'Charlie', 1);
          INSERT INTO students VALUES (2, 'Bob', 1);
          INSERT INTO students VALUES (3, 'Alice', 0);
        `,
        testCases: [
          {
            isHidden: false,
            expectedColumns: ['name'],
            expectedRows: [['Bob'], ['Charlie']],
            expectedOutput: JSON.stringify([
              { name: 'Bob' },
              { name: 'Charlie' },
            ]),
            explanation: 'Only active students Bob and Charlie, ordered alphabetically',
          },
          {
            isHidden: true,
            expectedOutput: 'HIDDEN_OUTPUT_SHOULD_NEVER_LEAK',
            explanation: 'Hidden grading query verification',
          },
        ],
      },
    });

    // MCQ question for regression check
    mcqQuestion = await Question.create({
      assessmentId: testAssessment._id,
      instructorId: instructorUser._id,
      questionText: 'What is the time complexity of binary search?',
      type: 'mcq',
      points: 5,
      options: [
        { id: 'opt_1', text: 'O(1)' },
        { id: 'opt_2', text: 'O(log N)' },
        { id: 'opt_3', text: 'O(N)' },
        { id: 'opt_4', text: 'O(N^2)' },
      ],
      correctAnswer: 'opt_2',
    });

    // Essay question for regression check
    essayQuestion = await Question.create({
      assessmentId: testAssessment._id,
      instructorId: instructorUser._id,
      questionText: 'Explain the difference between SQLite in-memory and persistent storage.',
      type: 'long_answer',
      points: 10,
    });

    // Update assessment questions
    testAssessment.questions = [
      pythonCodeQuestion._id,
      jsCodeQuestion._id,
      sqliteQuestion._id,
      mcqQuestion._id,
      essayQuestion._id,
    ];
    await testAssessment.save();

    // 7. Create Submissions
    // Alice's active submission
    activeSubmissionAlice = await Submission.create({
      assessmentId: testAssessment._id,
      studentId: studentAlice._id,
      status: 'in_progress',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      answers: new Map(),
    });

    // Charlie's already-submitted submission (for boundary check)
    submittedSubmissionCharlie = await Submission.create({
      assessmentId: testAssessment._id,
      studentId: studentCharlie._id,
      status: 'submitted',
      startedAt: new Date(Date.now() - 3600000),
      submittedAt: new Date(),
      answers: new Map(),
    });

    // Bob's active submission
    activeSubmissionBob = await Submission.create({
      assessmentId: testAssessment._id,
      studentId: studentBob._id,
      status: 'in_progress',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      answers: new Map(),
    });
  });

  after(async () => {
    // Restore execution client config
    executionClient.baseUrl = originalClientUrl;
    executionClient.apiKey = originalApiKey;

    if (backendServer) {
      await new Promise((resolve) => backendServer.close(resolve));
    }
    if (executionServer) {
      await new Promise((resolve) => executionServer.close(resolve));
    }
    await disconnectDB();
  });

  // ==========================================
  // SECTION 1: Python Code Execution
  // ==========================================
  describe('1. Python Editor & Execution Integration', () => {
    it('should successfully run Python code and match public sample test case (ACCEPTED)', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'import sys\nline = sys.stdin.read().strip()\na, b = map(int, line.split())\nprint(a + b)',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'ACCEPTED');
      assert.equal(json.data.totalCount, 1);
      assert.equal(json.data.passedCount, 1);
      assert.equal(json.data.sampleResults.length, 1);
      assert.equal(json.data.sampleResults[0].passed, true);
      assert.equal(json.data.sampleResults[0].input, '3 5');
      assert.equal(json.data.sampleResults[0].expectedOutput, '8');
      assert.equal(json.data.sampleResults[0].actualOutput.trim(), '8');
    });

    it('should return WRONG_ANSWER when Python code yields incorrect output', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'print(999)',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'WRONG_ANSWER');
      assert.equal(json.data.passedCount, 0);
      assert.equal(json.data.sampleResults[0].passed, false);
      assert.equal(json.data.sampleResults[0].actualOutput.trim(), '999');
    });

    it('should handle Python runtime exceptions gracefully (RUNTIME_ERROR)', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'raise ValueError("Invalid student logic")',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'RUNTIME_ERROR');
      assert.ok(json.data.stderr.includes('ValueError: Invalid student logic'));
    });

    it('should support Custom Stdin run with Python', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'import sys\nprint("CUSTOM:" + sys.stdin.read().strip())',
          customStdin: 'HelloFromAlice',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.customRun, true);
      assert.equal(json.data.stdout.trim(), 'CUSTOM:HelloFromAlice');
    });
  });

  // ==========================================
  // SECTION 2: JavaScript Execution
  // ==========================================
  describe('2. JavaScript Editor & Execution Integration', () => {
    it('should successfully run JavaScript code and pass sample case (ACCEPTED)', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: jsCodeQuestion._id.toString(),
          language: 'javascript',
          code: 'const fs = require("fs"); const n = parseInt(fs.readFileSync(0, "utf-8").trim(), 10); console.log(n % 2 === 0 ? "EVEN" : "ODD");',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'ACCEPTED');
      assert.equal(json.data.sampleResults[0].passed, true);
      assert.equal(json.data.sampleResults[0].actualOutput.trim(), 'EVEN');
    });

    it('should catch JavaScript syntax errors and return RUNTIME_ERROR with stderr', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: jsCodeQuestion._id.toString(),
          language: 'javascript',
          code: 'const broken = {;',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(['RUNTIME_ERROR', 'COMPILATION_ERROR'].includes(json.data.verdict));
      assert.ok(json.data.stderr.includes('SyntaxError') || json.data.verdict === 'COMPILATION_ERROR');
    });
  });

  // ==========================================
  // SECTION 3: SQL Execution (SQLite & Dialects)
  // ==========================================
  describe('3. SQL Dialect Execution (SQLite)', () => {
    it('should execute correct SQL query against SQLite sandbox and return columns and rows', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'sqlite',
          code: 'SELECT name FROM students WHERE is_active = 1 ORDER BY name ASC;',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'ACCEPTED');
      assert.deepEqual(json.data.columns, ['name']);
      assert.deepEqual(json.data.rows, [{ name: 'Bob' }, { name: 'Charlie' }]);
      assert.equal(json.data.rowCount, 2);
    });

    it('should detect WRONG_ANSWER when student SQL query produces different rows', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'sqlite',
          code: 'SELECT name FROM students;', // returns 3 rows instead of 2 active
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'WRONG_ANSWER');
      assert.equal(json.data.sampleResults[0].passed, false);
      assert.equal(json.data.rowCount, 3);
    });

    it('should reject unsupported programming languages or SQL dialects with HTTP 400', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'java', // Java is NOT permitted
          code: 'public class Main {}',
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message.includes('not permitted'));
    });

    it('should reject PostgreSQL and MySQL requests at the API boundary with HTTP 400', async () => {
      const resPg = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'postgresql',
          code: 'SELECT name FROM students;',
        }),
      });

      assert.equal(resPg.status, 400);
      const jsonPg = await resPg.json();
      assert.equal(jsonPg.success, false);
      assert.match(jsonPg.message, /Active SQL examination is restricted to SQLite only/i);

      const resMy = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'mysql',
          code: 'SELECT name FROM students;',
        }),
      });

      assert.equal(resMy.status, 400);
      const jsonMy = await resMy.json();
      assert.equal(jsonMy.success, false);
      assert.match(jsonMy.message, /Active SQL examination is restricted to SQLite only/i);
    });
  });

  // ==========================================
  // SECTION 4: Security & Information Hiding
  // ==========================================
  describe('4. Hidden Test Case Protection & Information Boundaries', () => {
    it('should NEVER include hidden test cases in the runCode response payload', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'print(8)',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      const rawText = JSON.stringify(json);

      // Verify that hidden test case input '100 200', output '300', and explanation are nowhere in response
      assert.ok(!rawText.includes('100 200'), 'Hidden input "100 200" must not be leaked');
      assert.ok(!rawText.includes('300'), 'Hidden expected output "300" must not be leaked');
      assert.ok(!rawText.includes('Hidden boundary test'), 'Hidden explanation must not be leaked');
      assert.equal(json.data.sampleResults.length, 1); // Only 1 public sample case
    });

    it('should NEVER leak hidden SQL test cases or solutions', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'sqlite',
          code: 'SELECT name FROM students WHERE is_active = 1;',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      const rawText = JSON.stringify(json);

      assert.ok(!rawText.includes('HIDDEN_OUTPUT_SHOULD_NEVER_LEAK'), 'Hidden SQL output must never leak');
      assert.ok(!rawText.includes('Hidden grading query verification'), 'Hidden SQL explanation must never leak');
    });
  });

  // ==========================================
  // SECTION 5: Authorization & State Verification
  // ==========================================
  describe('5. Student Authorization & Attempt State Guardrails', () => {
    it('should reject unauthenticated execution requests with HTTP 401', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'print(1)',
        }),
      });

      assert.equal(res.status, 401);
    });

    it('should prevent student Bob from running code on student Alice submission (403/Access Denied)', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBobToken}`, // Bob trying Alice's submission
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'print(1)',
        }),
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message.includes('Access denied. You do not own this submission attempt.'));
    });

    it('should reject execution on an already submitted attempt with HTTP 400', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${submittedSubmissionCharlie._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentCharlieToken}`,
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'print(1)',
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message.includes('Cannot execute code on a submitted or finalized assessment.'));
    });

    it('should reject non-student roles from student run-code endpoint with HTTP 403', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`, // Instructor attempting student endpoint
        },
        body: JSON.stringify({
          questionId: pythonCodeQuestion._id.toString(),
          language: 'python',
          code: 'print(1)',
        }),
      });

      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // SECTION 6: Answer Persistence (Save & Restore)
  // ==========================================
  describe('6. Save Progress & Restoration of Coding Answers', () => {
    it('should persist student code and language via saveProgress endpoint', async () => {
      const answersPayload = {
        [pythonCodeQuestion._id.toString()]: {
          code: 'def fib(n): return n if n <= 1 else fib(n-1) + fib(n-2)',
          language: 'python',
        },
        [sqliteQuestion._id.toString()]: {
          code: 'SELECT name FROM students WHERE is_active = 1 ORDER BY name ASC;',
          language: 'sqlite',
        },
        [mcqQuestion._id.toString()]: 'opt_2',
      };

      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({ answers: answersPayload }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      // Verify directly in DB
      const updatedSubmission = await Submission.findById(activeSubmissionAlice._id).lean();
      const savedAnswers = updatedSubmission.answers instanceof Map
        ? Object.fromEntries(updatedSubmission.answers)
        : updatedSubmission.answers;

      assert.ok(savedAnswers[pythonCodeQuestion._id.toString()]);
      assert.equal(savedAnswers[pythonCodeQuestion._id.toString()].code, 'def fib(n): return n if n <= 1 else fib(n-1) + fib(n-2)');
      assert.equal(savedAnswers[pythonCodeQuestion._id.toString()].language, 'python');
      assert.equal(savedAnswers[sqliteQuestion._id.toString()].language, 'sqlite');
      assert.equal(savedAnswers[mcqQuestion._id.toString()], 'opt_2');
    });

    it('should support autosave answer for a single coding question', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionAlice._id}/answers/${jsCodeQuestion._id.toString()}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          answer: {
            code: 'console.log("autosaved js")',
            language: 'javascript',
          },
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      const dbSub = await Submission.findById(activeSubmissionAlice._id).lean();
      const answers = dbSub.answers instanceof Map ? Object.fromEntries(dbSub.answers) : dbSub.answers;
      assert.equal(answers[jsCodeQuestion._id.toString()].code, 'console.log("autosaved js")');
    });
  });

  // ==========================================
  // SECTION 7: Assessment Lifecycle & Regression
  // ==========================================
  describe('7. Assessment Lifecycle & Non-Regression of Other Question Types', () => {
    it('should mark submission as under_review/submitted with subjective coding questions', async () => {
      // Bob completes and submits his exam containing MCQ, coding, and essay questions
      const submitRes = await fetch(`${backendUrl}/api/submissions/${activeSubmissionBob._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBobToken}`,
        },
        body: JSON.stringify({
          answers: {
            [mcqQuestion._id.toString()]: 'opt_2',
            [pythonCodeQuestion._id.toString()]: {
              code: 'print(8)',
              language: 'python',
            },
            [sqliteQuestion._id.toString()]: {
              code: 'SELECT name FROM students;',
              language: 'sqlite',
            },
            [essayQuestion._id.toString()]: 'SQLite in-memory runs entirely in RAM without disk sync.',
          },
        }),
      });

      assert.equal(submitRes.status, 200);
      const submitJson = await submitRes.json();
      assert.equal(submitJson.success, true);

      const submittedSub = await Submission.findById(activeSubmissionBob._id).lean();
      assert.ok(['submitted', 'under_review'].includes(submittedSub.status));
      assert.ok(submittedSub.submittedAt);
    });

    it('should prevent further answer modifications after final submission', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${activeSubmissionBob._id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBobToken}`,
        },
        body: JSON.stringify({
          answers: { [pythonCodeQuestion._id.toString()]: { code: 'hacked', language: 'python' } },
        }),
      });

      assert.equal(res.status, 404); // Not in_progress
    });
  });
});
