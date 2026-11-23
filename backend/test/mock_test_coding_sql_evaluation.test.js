const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../src/config/db');
const executionApp = require('../../code-IDE-service/src/app');
const executionEnv = require('../../code-IDE-service/src/config/env');
const executionClient = require('../src/services/executionClient.service');

const {
  User,
  Subject,
  Topic,
  Question,
  MockTest,
  MockTestAttempt,
} = require('../src/models');
const mockTestService = require('../src/services/mockTest.service');

describe('Mock Test Coding and SQL Evaluation Engine (Phase 1)', () => {
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  let facultyUser;
  let studentUser;
  let testSubject;
  let testTopic;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Start isolated execution server on ephemeral port
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

    facultyUser = await User.create({
      name: 'Faculty Evaluator',
      email: `eval_faculty_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
    });

    studentUser = await User.create({
      name: 'Student Candidate',
      email: `eval_student_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'student',
      isVerified: true,
      approvalStatus: 'approved',
    });

    testSubject = await Subject.create({
      name: 'Computer Systems & SQL',
      code: `CS-SQL-${Date.now().toString(36).toUpperCase()}`,
      description: 'Systems and database testing',
      department: 'Computer Science',
    });

    testTopic = await Topic.create({
      name: 'Algorithms & Database Queries',
      code: 'CS-ALGO-DB',
      subjectId: testSubject._id,
      conceptTags: ['Dynamic Programming', 'SQL Aggregations', 'Sorting'],
    });
  });

  after(async () => {
    executionClient.baseUrl = originalClientUrl;
    executionClient.apiKey = originalApiKey;
    if (executionServer) {
      await new Promise((resolve) => executionServer.close(resolve));
    }
    await disconnectDB();
  });

  // Helper to create and publish a mock test with resolved questions
  async function createMockTestWithQuestions(questionsConfig, mockTestOverrides = {}) {
    const resolvedQuestions = [];
    let totalMarks = 0;

    for (let i = 0; i < questionsConfig.length; i++) {
      const qc = questionsConfig[i];
      const marks = qc.marks !== undefined ? qc.marks : 5;
      const negativeMarks = qc.negativeMarks !== undefined ? qc.negativeMarks : 0;
      totalMarks += marks;

      const qDoc = await Question.create({
        statement: qc.statement || `Question ${i + 1}`,
        questionType: qc.questionType || 'CODING',
        difficulty: qc.difficulty || 'MEDIUM',
        subjectId: testSubject._id,
        topicIds: [testTopic._id],
        conceptTags: qc.conceptTags || ['Algorithms & Database Queries'],
        marks,
        negativeMarks,
        options: qc.options || [],
        answerKey: qc.answerKey,
        codingConfig: qc.codingConfig || {},
        evaluationConfig: qc.evaluationConfig || {},
        status: 'PUBLISHED',
      });

      resolvedQuestions.push({
        questionId: qDoc._id,
        versionNumber: 1,
        orderIndex: i,
        marks,
        negativeMarks,
        questionSnapshot: qDoc.toObject(),
      });
    }

    const mockTest = await MockTest.create({
      title: mockTestOverrides.title || `Mock Test ${Date.now()}`,
      subjectId: testSubject._id,
      topicIds: [testTopic._id],
      durationMinutes: 60,
      totalMarks,
      negativeMarking: Boolean(mockTestOverrides.negativeMarking),
      negativeMarkingRatio: mockTestOverrides.negativeMarkingRatio || 0.33,
      status: 'PUBLISHED',
      ownerFacultyId: facultyUser._id,
      resolvedQuestions,
      selectionMode: 'MANUAL',
    });

    return mockTest;
  }

  // ==========================================
  // SECTION 1: CODING EVALUATION
  // ==========================================
  describe('Coding Evaluation', () => {
    it('1. Correct Python solution awards full configured marks and ACCEPTED verdict', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Write a Python program that prints the square of stdin integer.',
          questionType: 'CODING',
          marks: 10,
          negativeMarks: 2,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: '4', expectedOutput: '16', isHidden: false, weight: 1 },
              { input: '5', expectedOutput: '25', isHidden: true, weight: 1 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'n = int(input())\nprint(n * n)',
            language: 'python',
          },
        ],
      });

      assert.equal(evalResult.score, 10);
      assert.equal(evalResult.correctCount, 1);
      assert.equal(evalResult.incorrectCount, 0);

      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.status, 'EVALUATED');
      assert.equal(attempt.responses[0].isCorrect, true);
      assert.equal(attempt.responses[0].scoreAwarded, 10);
      assert.equal(attempt.responses[0].executionResult.verdict, 'ACCEPTED');
      assert.equal(attempt.responses[0].executionResult.passedCount, 2);
    });

    it('2. Incorrect Python solution awards 0 or negative marks and is marked incorrect', async () => {
      const mockTest = await createMockTestWithQuestions(
        [
          {
            statement: 'Print greeting',
            questionType: 'CODING',
            marks: 10,
            negativeMarks: 3,
            codingConfig: {
              allowedLanguages: ['python'],
              defaultLanguage: 'python',
              testCases: [
                { input: '', expectedOutput: 'Hello World', isHidden: false, weight: 1 },
              ],
            },
          },
        ],
        { negativeMarking: true }
      );

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'print("Wrong Answer")',
            language: 'python',
          },
        ],
      });

      assert.equal(evalResult.correctCount, 0);
      assert.equal(evalResult.incorrectCount, 1);
      assert.equal(evalResult.score, 0); // Total capped at 0

      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.equal(attempt.responses[0].scoreAwarded, -3);
      assert.equal(attempt.responses[0].executionResult.verdict, 'WRONG_ANSWER');
    });

    it('3. Partially passed weighted test suite awards proportional marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Weighted suite test',
          questionType: 'CODING',
          marks: 20,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: '1', expectedOutput: '10', isHidden: false, weight: 1 },
              { input: '2', expectedOutput: '99', isHidden: false, weight: 3 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Code passes TC 1 (output 10), fails TC 2 (expected 99)
      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'print("10")',
            language: 'python',
          },
        ],
      });

      // Total weight: 1 + 3 = 4. Passed weight: 1. Earned marks = 20 * (1/4) = 5.
      assert.equal(evalResult.score, 5);
      assert.equal(evalResult.correctCount, 0);
      assert.equal(evalResult.incorrectCount, 1);

      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.equal(attempt.responses[0].scoreAwarded, 5);
      assert.equal(attempt.responses[0].executionResult.passedWeight, 1);
      assert.equal(attempt.responses[0].executionResult.totalWeight, 4);
    });

    it('4. Correct JavaScript solution evaluates and passes test cases', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Write JS solution',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['javascript'],
            defaultLanguage: 'javascript',
            testCases: [
              { input: '5', expectedOutput: '25', isHidden: false, weight: 1 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'console.log("25");',
            language: 'javascript',
          },
        ],
      });

      assert.equal(evalResult.score, 10);
      assert.equal(evalResult.correctCount, 1);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, true);
      assert.equal(attempt.responses[0].executionResult.verdict, 'ACCEPTED');
    });

    it('5. Compilation or runtime failure awards 0 marks and records error verdict', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Syntax test',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: '', expectedOutput: 'OK', isHidden: false, weight: 1 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: '__TRIGGER_SYNTAX_ERROR__',
            language: 'python',
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      assert.equal(evalResult.correctCount, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.ok(['COMPILATION_ERROR', 'RUNTIME_ERROR'].includes(attempt.responses[0].executionResult.verdict));
    });

    it('6. Timeout (TLE) awards 0 marks and records TIME_LIMIT_EXCEEDED verdict', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Timeout test',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: '', expectedOutput: 'Done', isHidden: false, weight: 1 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: '__TRIGGER_TLE__',
            language: 'python',
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].executionResult.verdict, 'TIME_LIMIT_EXCEEDED');
      assert.equal(attempt.responses[0].scoreAwarded, 0);
    });

    it('7. Executor unavailable: rejects submit with HTTP 503 and leaves attempt IN_PROGRESS', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Infra failure test',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: '1', expectedOutput: '1', isHidden: false, weight: 1 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Temporarily point execution client to unreachable port
      const workingUrl = executionClient.baseUrl;
      executionClient.baseUrl = 'http://127.0.0.1:59999';

      try {
        await assert.rejects(
          async () => {
            await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
              responses: [
                {
                  questionId: qId,
                  code: 'print("1")',
                  language: 'python',
                },
              ],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 503);
            assert.match(err.message, /Execution service unavailable/i);
            return true;
          }
        );

        // Verify attempt was NOT falsely marked EVALUATED
        const attempt = await MockTestAttempt.findById(attemptData.attemptId);
        assert.equal(attempt.status, 'IN_PROGRESS');
      } finally {
        executionClient.baseUrl = workingUrl;
      }
    });

    it('8. Invalid language rejects execution and awards 0 marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Language boundary test',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: '', expectedOutput: 'Hello', isHidden: false, weight: 1 },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'fn main() { println!("Hello"); }',
            language: 'rust', // Not supported
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].executionResult.verdict, 'INVALID_LANGUAGE');
      assert.equal(attempt.responses[0].isCorrect, false);
    });

    it('9. Hidden test cases are not exposed in stored response or analytics', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Hidden test privacy check',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: 'public_in', expectedOutput: 'public_out', isHidden: false, description: 'Public sample' },
              { input: 'SECRET_INPUT_XYZ', expectedOutput: 'SECRET_OUTPUT_123', isHidden: true, description: 'Secret edge case' },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'print("public_out")',
            language: 'python',
          },
        ],
      });

      // Verify stored attempt document
      const storedAttempt = await MockTestAttempt.findById(attemptData.attemptId);
      const hiddenTc = storedAttempt.responses[0].executionResult.testCases.find((tc) => tc.isHidden);
      assert.ok(hiddenTc);
      assert.equal(hiddenTc.input, '[HIDDEN]');
      assert.equal(hiddenTc.expectedOutput, '[HIDDEN]');
      assert.equal(hiddenTc.description, 'Hidden Test Case 2');

      // Verify student analytics endpoint
      const analytics = await mockTestService.getAttemptAnalytics(attemptData.attemptId, studentUser);
      const studentHiddenTc = analytics.responses[0].executionResult.testCases.find((tc) => tc.isHidden);
      assert.equal(studentHiddenTc.input, '[HIDDEN]');
      assert.equal(studentHiddenTc.expectedOutput, '[HIDDEN]');
    });

    it('10. No test cases configured: must not automatically award full marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Question with no test cases',
          questionType: 'CODING',
          marks: 15,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [], // Empty test cases!
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            code: 'def solve(): return 42',
            language: 'python',
          },
        ],
      });

      // Crucial: Must NEVER award marks merely because code is non-empty!
      assert.equal(evalResult.score, 0);
      assert.equal(evalResult.correctCount, 0);

      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.equal(attempt.responses[0].scoreAwarded, 0);
      assert.equal(attempt.responses[0].executionResult.verdict, 'NO_TEST_CASES');
    });
  });

  // ==========================================
  // SECTION 2: SQL EVALUATION
  // ==========================================
  describe('SQL Evaluation', () => {
    it('11. Correct SQL query awards full marks against isolated SQLite schema', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Select all student names with grade A',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: "CREATE TABLE students (id INT, name TEXT, grade TEXT); INSERT INTO students VALUES (1, 'Alice', 'A'), (2, 'Bob', 'B');",
            testCases: [
              {
                input: '',
                expectedOutput: JSON.stringify([{ name: 'Alice' }]),
                isHidden: false,
                weight: 1,
              },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: "SELECT name FROM students WHERE grade = 'A';",
            language: 'sqlite',
          },
        ],
      });

      assert.equal(evalResult.score, 10);
      assert.equal(evalResult.correctCount, 1);

      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, true);
      assert.equal(attempt.responses[0].scoreAwarded, 10);
      assert.equal(attempt.responses[0].executionResult.verdict, 'ACCEPTED');
    });

    it('12. Incorrect SQL query awards 0 marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Select Alice',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: "CREATE TABLE students (id INT, name TEXT); INSERT INTO students VALUES (1, 'Alice');",
            testCases: [
              {
                input: '',
                expectedOutput: JSON.stringify([{ name: 'Alice' }]),
                isHidden: false,
                weight: 1,
              },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: "SELECT 'Bob' AS name;",
            language: 'sqlite',
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      assert.equal(evalResult.correctCount, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.equal(attempt.responses[0].executionResult.verdict, 'WRONG_ANSWER');
    });

    it('13. Structured expected-column/row comparison evaluates correctly', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Structured columns and rows SQL test',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE products (pid INT, price REAL); INSERT INTO products VALUES (101, 29.99), (102, 49.99);',
            testCases: [
              {
                input: '',
                expectedOutput: '29.99',
                expectedColumns: ['pid', 'price'],
                expectedRows: [
                  { pid: 101, price: 29.99 },
                  { pid: 102, price: 49.99 },
                ],
                isHidden: false,
                weight: 1,
              },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: 'SELECT pid, price FROM products ORDER BY pid ASC;',
            language: 'sqlite',
          },
        ],
      });

      assert.equal(evalResult.score, 10);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, true);
      assert.equal(attempt.responses[0].executionResult.verdict, 'ACCEPTED');
    });

    it('14. SQL runtime error awards 0 marks and handles error safely', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'SQL syntax error test',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE tbl (id INT);',
            testCases: [{ input: '', expectedOutput: JSON.stringify([{ id: 1 }]) }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: 'SELECT * FROM completely_missing_table;',
            language: 'sqlite',
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.equal(attempt.responses[0].executionResult.verdict, 'RUNTIME_ERROR');
    });

    it('15. SQL timeout or invalid queries are handled without crashing', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'SQL heavy recursive test',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE dummy (x INT);',
            testCases: [{ input: '', expectedOutput: JSON.stringify([{ x: 1 }]) }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: 'INVALID SQL STATEMENT SYNTAX %$#@!',
            language: 'sqlite',
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      assert.equal(evalResult.correctCount, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
    });

    it('16. Unsupported SQL dialect (postgresql, mysql) is rejected at API boundary', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Dialect boundary test',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE t (id INT);',
            testCases: [{ input: '', expectedOutput: JSON.stringify([{ id: 1 }]) }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: 'SELECT 1;',
            language: 'postgresql', // Prohibited dialect
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].isCorrect, false);
      assert.equal(attempt.responses[0].executionResult.verdict, 'INVALID_DIALECT');
    });

    it('17. SQL executor unavailable: rejects submit with HTTP 503 and leaves attempt IN_PROGRESS', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'SQL infra down test',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE t (id INT);',
            testCases: [{ input: '', expectedOutput: JSON.stringify([{ id: 1 }]) }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const workingUrl = executionClient.baseUrl;
      executionClient.baseUrl = 'http://127.0.0.1:59999';

      try {
        await assert.rejects(
          async () => {
            await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
              responses: [
                {
                  questionId: qId,
                  sqlQuery: 'SELECT 1;',
                  language: 'sqlite',
                },
              ],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 503);
            return true;
          }
        );

        const attempt = await MockTestAttempt.findById(attemptData.attemptId);
        assert.equal(attempt.status, 'IN_PROGRESS');
      } finally {
        executionClient.baseUrl = workingUrl;
      }
    });

    it('18. Student SQL is not executed against the production database or MongoDB', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Dangerous SQL check',
          questionType: 'SQL',
          marks: 10,
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE test_data (val INT);',
            testCases: [{ input: '', expectedOutput: JSON.stringify([{ val: 10 }]) }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Student attempts dangerous DROP / ATTACH operation
      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            sqlQuery: 'ATTACH DATABASE "/tmp/hack.db" AS evil;',
            language: 'sqlite',
          },
        ],
      });

      assert.equal(evalResult.score, 0);
      const attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.responses[0].executionResult.verdict, 'SECURITY_VIOLATION');

      // Verify MongoDB collections remain intact
      const userCount = await User.countDocuments();
      assert.ok(userCount >= 2);
    });
  });

  // ==========================================
  // SECTION 3: ATTEMPT INTEGRITY & CONCURRENCY
  // ==========================================
  describe('Attempt Integrity', () => {
    it('19. Duplicate question response is rejected with HTTP 400', async () => {
      const mockTest = await createMockTestWithQuestions([
        { statement: 'Q1', questionType: 'CODING', marks: 5, codingConfig: { testCases: [] } },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await assert.rejects(
        async () => {
          await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
            responses: [
              { questionId: qId, code: 'print(1)' },
              { questionId: qId, code: 'print(2)' }, // Duplicate entry
            ],
          });
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Duplicate response detected/i);
          return true;
        }
      );
    });

    it('20. Unknown question IDs are rejected with HTTP 400', async () => {
      const mockTest = await createMockTestWithQuestions([
        { statement: 'Q1', questionType: 'CODING', marks: 5, codingConfig: { testCases: [] } },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const fakeQuestionId = new mongoose.Types.ObjectId();

      await assert.rejects(
        async () => {
          await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
            responses: [{ questionId: fakeQuestionId, code: 'print(1)' }],
          });
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Unknown question ID/i);
          return true;
        }
      );
    });

    it('21. Submission retry does not double-credit marks (Atomic CAS lock)', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Objective Q1',
          questionType: 'SINGLE_MCQ',
          marks: 10,
          options: [
            { id: 'opt_1', text: 'Correct', isCorrect: true },
            { id: 'opt_2', text: 'Wrong', isCorrect: false },
          ],
          answerKey: 'opt_1',
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const firstSubmit = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'opt_1' }],
      });
      assert.equal(firstSubmit.score, 10);

      // Attempt second submission
      await assert.rejects(
        async () => {
          await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
            responses: [{ questionId: qId, selectedOption: 'opt_1' }],
          });
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /already been submitted/i);
          return true;
        }
      );

      // Confirm marks are still exactly 10, not doubled
      const finalAttempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(finalAttempt.earnedMarks, 10);
    });

    it('22. Unresolved executor failure does not result in a falsely completed evaluation', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Recovery test',
          questionType: 'CODING',
          marks: 10,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [{ input: '', expectedOutput: 'OK', isHidden: false }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const workingUrl = executionClient.baseUrl;
      executionClient.baseUrl = 'http://127.0.0.1:59999'; // Dead port

      try {
        await assert.rejects(async () => {
          await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
            responses: [{ questionId: qId, code: 'print("OK")', language: 'python' }],
          });
        });
      } finally {
        executionClient.baseUrl = workingUrl;
      }

      // Check attempt is still IN_PROGRESS and NOT falsely evaluated
      let attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.status, 'IN_PROGRESS');

      // Now with executor restored, submission succeeds
      const recoveryResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [{ questionId: qId, code: 'print("OK")', language: 'python' }],
      });

      assert.equal(recoveryResult.score, 10);
      attempt = await MockTestAttempt.findById(attemptData.attemptId);
      assert.equal(attempt.status, 'EVALUATED');
      assert.equal(attempt.earnedMarks, 10);
    });

    it('23. Existing objective-question evaluation still works correctly', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Select correct option',
          questionType: 'SINGLE_MCQ',
          marks: 4,
          negativeMarks: 1,
          options: [
            { id: 'opt_a', text: 'Alpha', isCorrect: true },
            { id: 'opt_b', text: 'Beta', isCorrect: false },
          ],
          answerKey: 'opt_a',
        },
        {
          statement: 'Select all primes',
          questionType: 'MULTI_SELECT',
          marks: 6,
          negativeMarks: 2,
          options: [
            { id: 'opt_2', text: '2', isCorrect: true },
            { id: 'opt_3', text: '3', isCorrect: true },
            { id: 'opt_4', text: '4', isCorrect: false },
          ],
          answerKey: ['opt_2', 'opt_3'],
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const [q1, q2] = mockTest.resolvedQuestions;

      const evalResult = await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [
          { questionId: q1.questionId, selectedOption: 'opt_a' }, // Correct: 4
          { questionId: q2.questionId, selectedOptions: ['opt_2', 'opt_3'] }, // Correct: 6
        ],
      });

      assert.equal(evalResult.score, 10);
      assert.equal(evalResult.correctCount, 2);
      assert.equal(evalResult.incorrectCount, 0);
    });
  });

  // ==========================================
  // SECTION 4: PRIVACY & DATA PROTECTION
  // ==========================================
  describe('Privacy & Hidden Test Protection', () => {
    it('24. Hidden test input is not returned to student', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Input leakage check',
          questionType: 'CODING',
          marks: 5,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: 'TOP_SECRET_INPUT_999', expectedOutput: 'result', isHidden: true },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [{ questionId: qId, code: 'print("result")', language: 'python' }],
      });

      const analytics = await mockTestService.getAttemptAnalytics(attemptData.attemptId, studentUser);
      const tcs = analytics.responses[0].executionResult.testCases;
      assert.equal(tcs[0].input, '[HIDDEN]');
      assert.notEqual(tcs[0].input, 'TOP_SECRET_INPUT_999');
    });

    it('25. Hidden expected output is not returned to student', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Expected output leakage check',
          questionType: 'CODING',
          marks: 5,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [
              { input: 'input_data', expectedOutput: 'SUPER_SECRET_OUTPUT_777', isHidden: true },
            ],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [{ questionId: qId, code: 'print("wrong")', language: 'python' }],
      });

      const analytics = await mockTestService.getAttemptAnalytics(attemptData.attemptId, studentUser);
      const tcs = analytics.responses[0].executionResult.testCases;
      assert.equal(tcs[0].expectedOutput, '[HIDDEN]');
      assert.notEqual(tcs[0].expectedOutput, 'SUPER_SECRET_OUTPUT_777');
    });

    it('26. Internal executor details are not returned to student', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          statement: 'Internal details leakage check',
          questionType: 'CODING',
          marks: 5,
          codingConfig: {
            allowedLanguages: ['python'],
            defaultLanguage: 'python',
            testCases: [{ input: '1', expectedOutput: '1', isHidden: false }],
          },
        },
      ]);

      const attemptData = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attemptData.attemptId, studentUser, {
        responses: [{ questionId: qId, code: 'print("1")', language: 'python' }],
      });

      const analytics = await mockTestService.getAttemptAnalytics(attemptData.attemptId, studentUser);
      const responseStr = JSON.stringify(analytics);
      assert.equal(responseStr.includes(executionClient.apiKey), false);
      assert.equal(responseStr.includes('http://'), false);
      assert.equal(responseStr.includes('/var/run/docker.sock'), false);
    });
  });
});
