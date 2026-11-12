const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const http = require('node:http');

const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');

const {
  User,
  Assessment,
  Question,
  Submission,
  BankQuestion,
} = require('../src/models');

const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');

describe('Question Bank Phase 2 Refinement Verification Suite', () => {
  let server;
  let baseUrl;

  let instructorA;
  let instructorB;
  let studentUser;
  let adminUser;

  let instructorAToken;
  let instructorBToken;
  let studentToken;
  let adminToken;

  before(async () => {
    await connectDB();
    await seedDatabase();

    const passwordHash = await hashPassword('Phase2@Test123');

    instructorA = await User.create({
      name: 'Prof. Ada Lovelace',
      email: 'p2_instructor_a@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P2-001',
      department: 'Computer Science',
    });

    instructorB = await User.create({
      name: 'Prof. Alan Turing',
      email: 'p2_instructor_b@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P2-002',
      department: 'Data Science',
    });

    studentUser = await User.create({
      name: 'Grace Hopper',
      email: 'p2_student@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P2-001',
      department: 'Computer Science',
    });

    adminUser = await User.create({
      name: 'System Admin',
      email: 'p2_admin@uap.edu',
      password: passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
      adminId: 'ADM-P2-001',
    });

    instructorAToken = generateAccessToken({ id: instructorA._id.toString(), role: instructorA.role, email: instructorA.email });
    instructorBToken = generateAccessToken({ id: instructorB._id.toString(), role: instructorB.role, email: instructorB.email });
    studentToken = generateAccessToken({ id: studentUser._id.toString(), role: studentUser.role, email: studentUser.email });
    adminToken = generateAccessToken({ id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email });

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
    await disconnectDB();
  });

  describe('1. Programming Language Runtimes (Python & JavaScript)', () => {
    let createdCodeQuestionId;

    it('should create a code question with only Python and JavaScript as runtimes', async () => {
      const payload = {
        questionText: 'Write a function to compute the Fibonacci sequence up to N.',
        type: 'code',
        points: 10,
        difficulty: 'MEDIUM',
        bloomLevel: 'APPLY',
        category: 'Algorithms',
        tags: ['fibonacci', 'recursion', 'dynamic-programming'],
        codingConfig: {
          executionCategory: 'code',
          allowedLanguages: ['python', 'javascript'],
          defaultLanguage: 'python',
          starterCode: {
            python: 'def fibonacci(n):\n    pass\n',
            javascript: 'function fibonacci(n) {\n}\n',
          },
          cpuTimeLimitMs: 2000,
          memoryLimitMb: 256,
          testCases: [
            {
              input: '5',
              expectedOutput: '5',
              isHidden: false,
              weight: 2,
              explanation: 'Sample case N=5',
            },
            {
              input: '10',
              expectedOutput: '55',
              isHidden: true,
              weight: 3,
              explanation: 'Hidden grading case N=10',
            },
          ],
        },
      };

      const res = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      const qData = body.data?.question || body.data;
      assert.equal(qData.type, 'code');
      assert.equal(qData.codingConfig.executionCategory, 'code');
      assert.deepEqual(qData.codingConfig.allowedLanguages, ['python', 'javascript']);
      assert.equal(qData.codingConfig.defaultLanguage, 'python');
      assert.equal(qData.codingConfig.testCases.length, 2);
      assert.equal(qData.codingConfig.testCases[0].isHidden, false);
      assert.equal(qData.codingConfig.testCases[1].isHidden, true);

      createdCodeQuestionId = qData._id || qData.id;
    });

    it('should reject coding questions if an unapproved runtime language is specified', async () => {
      const badPayload = {
        questionText: 'Invalid language configuration test question prompt',
        type: 'code',
        points: 5,
        difficulty: 'EASY',
        bloomLevel: 'REMEMBER',
        codingConfig: {
          allowedLanguages: ['ruby', 'csharp'],
          defaultLanguage: 'ruby',
          testCases: [{ input: '1', expectedOutput: '1' }],
        },
      };

      const res = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify(badPayload),
      });

      assert.equal(res.status, 422);
      const body = await res.json();
      assert.equal(body.success, false);
    });
  });

  describe('2. SQL Execution Category & Structured Expected Results', () => {
    let createdSqlQuestionId;

    it('should create a SQL question with dialect SQLite and structured columns & rows', async () => {
      const payload = {
        questionText: 'Select all active students majoring in Computer Science ordered by GPA descending.',
        type: 'sql',
        points: 15,
        difficulty: 'MEDIUM',
        bloomLevel: 'APPLY',
        category: 'Databases',
        tags: ['sql', 'select', 'filtering', 'ordering'],
        codingConfig: {
          executionCategory: 'sql',
          sqlDialect: 'sqlite',
          allowedLanguages: ['sqlite'],
          defaultLanguage: 'sqlite',
          schemaDdl: `
            CREATE TABLE students (
              id INT PRIMARY KEY,
              name VARCHAR(50),
              major VARCHAR(50),
              gpa DECIMAL(3,2),
              is_active BOOLEAN
            );
            INSERT INTO students VALUES (1, 'Alice Smith', 'Computer Science', 3.90, 1);
            INSERT INTO students VALUES (2, 'Bob Jones', 'Electrical Engineering', 3.40, 1);
            INSERT INTO students VALUES (3, 'Charlie Brown', 'Computer Science', 3.75, 1);
            INSERT INTO students VALUES (4, 'Diana Prince', 'Computer Science', 3.85, 0);
          `,
          starterCode: {
            sqlite: '-- Write your SQL query below\nSELECT name, gpa FROM students;\n',
          },
          cpuTimeLimitMs: 2500,
          memoryLimitMb: 256,
          testCases: [
            {
              input: '',
              expectedColumns: ['name', 'gpa'],
              expectedRows: [
                ['Alice Smith', 3.90],
                ['Charlie Brown', 3.75],
              ],
              expectedOutput: JSON.stringify({
                columns: ['name', 'gpa'],
                rows: [
                  ['Alice Smith', 3.90],
                  ['Charlie Brown', 3.75],
                ],
              }),
              isHidden: false,
              weight: 5,
              explanation: 'Verify filtering active CS students and ordering by GPA desc',
            },
            {
              input: '',
              expectedColumns: ['name', 'gpa'],
              expectedRows: [
                ['Alice Smith', 3.90],
                ['Charlie Brown', 3.75],
              ],
              expectedOutput: JSON.stringify({
                columns: ['name', 'gpa'],
                rows: [
                  ['Alice Smith', 3.90],
                  ['Charlie Brown', 3.75],
                ],
              }),
              isHidden: true,
              weight: 10,
              explanation: 'Grading evaluation case',
            },
          ],
        },
      };

      const res = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      const qData = body.data?.question || body.data;
      assert.equal(qData.type, 'sql');
      assert.equal(qData.codingConfig.executionCategory, 'sql');
      assert.equal(qData.codingConfig.sqlDialect, 'sqlite');
      assert.deepEqual(qData.codingConfig.allowedLanguages, ['sqlite']);
      assert.equal(qData.codingConfig.defaultLanguage, 'sqlite');
      assert.equal(qData.codingConfig.testCases.length, 2);
      assert.deepEqual(qData.codingConfig.testCases[0].expectedColumns, ['name', 'gpa']);
      assert.equal(qData.codingConfig.testCases[0].isHidden, false);
      assert.equal(qData.codingConfig.testCases[1].isHidden, true);

      createdSqlQuestionId = qData._id || qData.id;
    });

    it('should create a SQL question supporting SQLite dialect and reject PostgreSQL', async () => {
      const payload = {
        questionText: 'Find average salary by department with SQLite syntax.',
        type: 'sql',
        points: 10,
        difficulty: 'HARD',
        bloomLevel: 'ANALYZE',
        category: 'Databases',
        codingConfig: {
          executionCategory: 'sql',
          sqlDialect: 'sqlite',
          allowedLanguages: ['sqlite'],
          defaultLanguage: 'sqlite',
          schemaDdl: 'CREATE TABLE emp (dept text, sal int);',
          testCases: [
            {
              expectedColumns: ['dept', 'avg_sal'],
              expectedRows: [['Engineering', 95000]],
              expectedOutput: JSON.stringify({ columns: ['dept', 'avg_sal'], rows: [['Engineering', 95000]] }),
              isHidden: false,
              weight: 5,
            },
          ],
        },
      };

      const res = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      const qData = body.data?.question || body.data;
      assert.equal(qData.codingConfig.sqlDialect, 'sqlite');
      assert.equal(qData.codingConfig.defaultLanguage, 'sqlite');

      // Verify that requesting postgresql or mysql is rejected at API boundary
      const rejectedRes = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          ...payload,
          codingConfig: {
            ...payload.codingConfig,
            sqlDialect: 'postgresql',
            allowedLanguages: ['postgresql'],
          },
        }),
      });
      assert.equal(rejectedRes.status, 422);
      const rejectedBody = await rejectedRes.json();
      assert.equal(rejectedBody.success, false);
      assert.match(JSON.stringify(rejectedBody), /sqlite/i);
    });

    it('should update a SQL question and preserve structured columns & rows', async () => {
      const updatePayload = {
        questionText: 'Select all active students majoring in Computer Science ordered by GPA descending (Updated).',
        points: 20,
        codingConfig: {
          executionCategory: 'sql',
          sqlDialect: 'sqlite',
          allowedLanguages: ['sqlite'],
          defaultLanguage: 'sqlite',
          testCases: [
            {
              expectedColumns: ['name', 'gpa', 'major'],
              expectedRows: [['Alice Smith', 3.90, 'Computer Science']],
              expectedOutput: JSON.stringify({
                columns: ['name', 'gpa', 'major'],
                rows: [['Alice Smith', 3.90, 'Computer Science']],
              }),
              isHidden: false,
              weight: 10,
            },
          ],
        },
      };

      const res = await fetch(`${baseUrl}/api/question-bank/${createdSqlQuestionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      const qData = body.data?.question || body.data;
      assert.equal(qData.points, 20);
      assert.deepEqual(qData.codingConfig.testCases[0].expectedColumns, ['name', 'gpa', 'major']);
    });

    it('should verify expectedColumns, expectedRows and expectedOutput remain synchronized on create and reload', async () => {
      const createRes = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'Test persistence consistency of expectedColumns, expectedRows and expectedOutput.',
          type: 'sql',
          points: 10,
          difficulty: 'MEDIUM',
          bloomLevel: 'APPLY',
          category: 'Databases',
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            schemaDdl: 'CREATE TABLE t (id int, val text);',
            testCases: [
              {
                expectedColumns: ['id', 'val'],
                expectedRows: [[1, 'Alpha'], [2, 'Beta']],
                expectedOutput: JSON.stringify({
                  columns: ['id', 'val'],
                  rows: [[1, 'Alpha'], [2, 'Beta']],
                }),
                isHidden: false,
                weight: 5,
              },
            ],
          },
        }),
      });

      assert.equal(createRes.status, 201);
      const createBody = await createRes.json();
      const createdQ = createBody.data?.question || createBody.data;
      const qId = createdQ._id || createdQ.id;

      const fetchRes = await fetch(`${baseUrl}/api/question-bank/${qId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${instructorAToken}`,
        },
      });
      assert.equal(fetchRes.status, 200);
      const fetchedBody = await fetchRes.json();
      const fetchedQ = fetchedBody.data?.question || fetchedBody.data;

      const tc = fetchedQ.codingConfig.testCases[0];
      assert.deepEqual(tc.expectedColumns, ['id', 'val']);
      assert.deepEqual(tc.expectedRows, [[1, 'Alpha'], [2, 'Beta']]);
      const parsedOutput = JSON.parse(tc.expectedOutput);
      assert.deepEqual(parsedOutput.columns, tc.expectedColumns);
      assert.deepEqual(parsedOutput.rows, tc.expectedRows);

      const updateRes = await fetch(`${baseUrl}/api/question-bank/${qId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          codingConfig: {
            executionCategory: 'sql',
            sqlDialect: 'sqlite',
            testCases: [
              {
                expectedColumns: ['id', 'val', 'status'],
                expectedRows: [[1, 'Alpha', 'ACTIVE'], [2, 'Beta', 'INACTIVE']],
                expectedOutput: JSON.stringify({
                  columns: ['id', 'val', 'status'],
                  rows: [[1, 'Alpha', 'ACTIVE'], [2, 'Beta', 'INACTIVE']],
                }),
                isHidden: true,
                weight: 5,
              },
            ],
          },
        }),
      });
      assert.equal(updateRes.status, 200);

      const reloadRes = await fetch(`${baseUrl}/api/question-bank/${qId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${instructorAToken}`,
        },
      });
      assert.equal(reloadRes.status, 200);
      const reloadBody = await reloadRes.json();
      const reloadedQ = reloadBody.data?.question || reloadBody.data;

      const updatedTc = reloadedQ.codingConfig.testCases[0];
      assert.deepEqual(updatedTc.expectedColumns, ['id', 'val', 'status']);
      assert.deepEqual(updatedTc.expectedRows, [[1, 'Alpha', 'ACTIVE'], [2, 'Beta', 'INACTIVE']]);
      assert.equal(updatedTc.isHidden, true);
      const updatedParsed = JSON.parse(updatedTc.expectedOutput);
      assert.deepEqual(updatedParsed.columns, updatedTc.expectedColumns);
      assert.deepEqual(updatedParsed.rows, updatedTc.expectedRows);
    });
  });

  describe('3. Student Privacy: Strict Hidden Test-Case Masking', () => {
    let testAssessment;

    before(async () => {
      // Create assessment with both a coding and a SQL question with hidden test cases
      testAssessment = await Assessment.create({
        title: 'Phase 2 Coding & SQL Verification Assessment',
        description: 'Comprehensive test for hidden test-case protection',
        category: 'Computer Science',
        instructorId: instructorA._id,
        status: 'published',
        durationMinutes: 60,
        passingScore: 60,
        totalPoints: 20,
      });

      await Question.create({
        assessmentId: testAssessment._id,
        questionText: 'Compute the factorial of an integer N.',
        type: 'code',
        points: 10,
        orderIndex: 0,
        codingConfig: {
          executionCategory: 'code',
          allowedLanguages: ['python', 'javascript'],
          defaultLanguage: 'python',
          testCases: [
            {
              input: '4',
              expectedOutput: '24',
              isHidden: false,
              weight: 2,
              explanation: 'Sample case 4! = 24',
            },
            {
              input: '6',
              expectedOutput: '720',
              isHidden: true,
              weight: 4,
              explanation: 'Hidden grading case 6! = 720',
            },
            {
              input: '8',
              expectedOutput: '40320',
              isHidden: true,
              weight: 4,
              explanation: 'Hidden edge case 8!',
            },
          ],
        },
      });

      await Question.create({
        assessmentId: testAssessment._id,
        questionText: 'Write a SQL query to list all employee names.',
        type: 'sql',
        points: 10,
        orderIndex: 1,
        codingConfig: {
          executionCategory: 'sql',
          sqlDialect: 'sqlite',
          allowedLanguages: ['sqlite'],
          defaultLanguage: 'sqlite',
          schemaDdl: 'CREATE TABLE emp (id int, name text); INSERT INTO emp VALUES (1, "Alice");',
          testCases: [
            {
              expectedColumns: ['name'],
              expectedRows: [['Alice']],
              expectedOutput: JSON.stringify({ columns: ['name'], rows: [['Alice']] }),
              isHidden: false,
              weight: 5,
            },
            {
              expectedColumns: ['name'],
              expectedRows: [['Alice']],
              expectedOutput: JSON.stringify({ columns: ['name'], rows: [['Alice']] }),
              isHidden: true,
              weight: 5,
            },
          ],
        },
      });
    });

    it('should NEVER expose hidden test cases when a student retrieves the assessment', async () => {
      const studentData = await assessmentService.getAssessmentById(
        testAssessment._id.toString(),
        { id: studentUser._id.toString(), role: 'student' }
      );

      assert.equal(studentData.questions.length, 2);

      // Question 1 (code): 3 test cases originally, 2 were hidden -> student must receive ONLY 1
      const codeQ = studentData.questions[0];
      assert.equal(codeQ.codingConfig.testCases.length, 1);
      assert.equal(codeQ.codingConfig.testCases[0].isHidden, false);
      assert.equal(codeQ.codingConfig.testCases[0].expectedOutput, '24');

      // Question 2 (sql): 2 test cases originally, 1 was hidden -> student must receive ONLY 1
      const sqlQ = studentData.questions[1];
      assert.equal(sqlQ.codingConfig.testCases.length, 1);
      assert.equal(sqlQ.codingConfig.testCases[0].isHidden, false);
    });

    it('should preserve all hidden test cases when an instructor retrieves the assessment', async () => {
      const instructorData = await assessmentService.getAssessmentById(
        testAssessment._id.toString(),
        { id: instructorA._id.toString(), role: 'instructor' }
      );

      assert.equal(instructorData.questions.length, 2);
      assert.equal(instructorData.questions[0].codingConfig.testCases.length, 3);
      assert.equal(instructorData.questions[1].codingConfig.testCases.length, 2);
    });

    it('should NEVER expose hidden test cases when student views their submission via getSubmissionById', async () => {
      // Start an attempt for the student
      const sub = await submissionService.startAttempt(studentUser._id.toString(), testAssessment._id.toString());

      // Fetch submission as student
      const subJson = await submissionService.getSubmissionById(
        sub._id.toString(),
        studentUser._id.toString(),
        'student'
      );

      assert.ok(subJson.assessment);
      assert.ok(subJson.assessment.questions);
      for (const q of subJson.assessment.questions) {
        if (q.codingConfig && Array.isArray(q.codingConfig.testCases)) {
          const hasHidden = q.codingConfig.testCases.some((tc) => tc.isHidden === true);
          assert.equal(hasHidden, false, 'Student submission view must never contain hidden test cases');
        }
      }
    });
  });

  describe('4. Question Bank RBAC & Cross-Instructor Isolation', () => {
    let instructorAQuestionId;

    before(async () => {
      const bq = await BankQuestion.create({
        questionBankId: `qb_rbac_${Date.now()}`,
        version: 1,
        isLatest: true,
        questionText: 'Explain the difference between primary key and foreign key.',
        normalizedText: 'explain the difference between primary key and foreign key',
        type: 'short_answer',
        points: 5,
        difficulty: 'EASY',
        bloomLevel: 'UNDERSTAND',
        category: 'Databases',
        createdBy: instructorA._id,
        reviewedBy: instructorA._id,
        reviewedAt: new Date(),
        isActive: true,
      });
      instructorAQuestionId = bq._id.toString();
    });

    it('should allow Instructor A to fetch and update their own question', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank/${instructorAQuestionId}`, {
        headers: { Authorization: `Bearer ${instructorAToken}` },
      });
      assert.equal(res.status, 200);
    });

    it('should prevent Instructor B from updating Instructor A question with 403', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank/${instructorAQuestionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorBToken}`,
        },
        body: JSON.stringify({ points: 10 }),
      });
      assert.equal(res.status, 403);
    });

    it('should allow Admin to update any question regardless of creator', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank/${instructorAQuestionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ points: 12 }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      const qData = body.data?.question || body.data;
      assert.equal(qData.points, 12);
    });

    it('should block students from any Question Bank endpoint with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(res.status, 403);
    });
  });
});
