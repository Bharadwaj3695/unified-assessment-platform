const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const executionApp = require('../../code-IDE-service/src/app');
const executionEnv = require('../../code-IDE-service/src/config/env');
const executionClient = require('../src/services/executionClient.service');
const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');
const { generateAccessToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');

const {
  User,
  Assessment,
  Question,
  Submission,
} = require('../src/models');

describe('UAP Assignment 01 — Programming & SQL Assessment End-to-End Suite', () => {
  let backendServer;
  let backendUrl;
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  let instructor;
  let studentAlice;
  let studentBob;

  let instructorToken;
  let studentAliceToken;
  let studentBobToken;

  let createdAssessment;
  let pythonQuestion;
  let jsQuestion;
  let sqliteQuestion;

  let aliceSubmission;

  before(async () => {
    // 1. Database setup
    await connectDB();
    await seedDatabase();

    // 2. Start Execution Service on ephemeral port
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

    // 4. Retrieve or create Instructor and Students
    instructor = await User.findOne({ email: 'ins01@uap.edu' });
    if (!instructor) {
      instructor = await User.create({
        name: 'Demo Instructor 01',
        email: 'ins01@uap.edu',
        password: await hashPassword('Instructor@123'),
        role: 'instructor',
        status: 'active',
        isActive: true,
        facultyId: 'FAC-001',
        department: 'Computer Science & Engineering',
      });
    }

    studentAlice = await User.findOne({ email: 'std01@uap.edu' });
    if (!studentAlice) {
      studentAlice = await User.create({
        name: 'Demo Student 01',
        email: 'std01@uap.edu',
        password: await hashPassword('Student@123'),
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: 'STU-001',
        department: 'Computer Science',
      });
    }

    studentBob = await User.findOne({ email: 'std02@uap.edu' });
    if (!studentBob) {
      studentBob = await User.create({
        name: 'Demo Student 02',
        email: 'std02@uap.edu',
        password: await hashPassword('Student@123'),
        role: 'student',
        status: 'active',
        isActive: true,
        studentId: 'STU-002',
        department: 'Computer Science',
      });
    }

    instructorToken = generateAccessToken({ id: instructor._id.toString(), role: instructor.role, email: instructor.email });
    studentAliceToken = generateAccessToken({ id: studentAlice._id.toString(), role: studentAlice.role, email: studentAlice.email });
    studentBobToken = generateAccessToken({ id: studentBob._id.toString(), role: studentBob.role, email: studentBob.email });
  });

  after(async () => {
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

  // ========================================================
  // SECTION 1: Assessment & Question Creation Verification
  // ========================================================
  describe('1. Assessment Creation with Public and Hidden Test Cases', () => {
    it('should create "UAP – Programming & SQL Assessment 01" with all 3 questions and test cases', async () => {
      const assessmentPayload = {
        title: 'UAP – Programming & SQL Assessment 01',
        description: 'Practical assessment covering Python programming, JavaScript problem-solving and SQLite query writing.',
        category: 'Computer Science',
        durationMinutes: 60,
        totalPoints: 30,
        passingScore: 60,
        status: 'draft', // Prepared in draft status awaiting audience selection
        accessType: 'public',
        allowReview: true,
        questions: [
          // Question 1: Python — Second Largest Distinct Number (10 marks)
          {
            questionText: 'Given an array of integers, find the second-largest distinct element.\n\nInput:\n- First line: integer N.\n- Second line: N space-separated integers.\n\nOutput:\n- Print the second-largest distinct integer.\n\nConstraint:\nAt least two distinct values are guaranteed.',
            type: 'code',
            points: 10,
            difficulty: 'MEDIUM',
            bloomLevel: 'APPLY',
            category: 'Computer Science',
            tags: ['python', 'arrays', 'algorithms'],
            codingConfig: {
              executionCategory: 'code',
              allowedLanguages: ['python'],
              defaultLanguage: 'python',
              starterCode: {
                python: '# Python 3.11 Starter Template\nimport sys\n\ndef main():\n    input_data = sys.stdin.read().split()\n    if not input_data:\n        return\n    n = int(input_data[0])\n    nums = [int(x) for x in input_data[1:n+1]]\n    \n    # TODO: Find and print the second-largest distinct integer\n    pass\n\nif __name__ == "__main__":\n    main()\n',
              },
              cpuTimeLimitMs: 2000,
              memoryLimitMb: 256,
              testCases: [
                {
                  input: '5\n10 5 8 10 3',
                  expectedOutput: '8',
                  isHidden: false,
                  weight: 2,
                  explanation: 'Distinct elements are 10, 8, 5, 3. Second largest is 8.',
                },
                {
                  input: '6\n1 2 3 4 5 6',
                  expectedOutput: '5',
                  isHidden: false,
                  weight: 2,
                  explanation: 'Distinct elements are 6, 5, 4, 3, 2, 1. Second largest is 5.',
                },
                {
                  input: '5\n9 9 7 7 5',
                  expectedOutput: '7',
                  isHidden: false,
                  weight: 2,
                  explanation: 'Distinct elements are 9, 7, 5. Second largest is 7.',
                },
                {
                  input: '5\n-10 -20 -5 -30 -15',
                  expectedOutput: '-10',
                  isHidden: true,
                  weight: 2,
                  explanation: 'Hidden: Negative numbers test case. Distinct elements are -5, -10, -15, -20, -30. Second largest is -10.',
                },
                {
                  input: '7\n100 50 100 75 25 75 10',
                  expectedOutput: '75',
                  isHidden: true,
                  weight: 2,
                  explanation: 'Hidden: Multiple duplicates test case. Distinct elements are 100, 75, 50, 25, 10. Second largest is 75.',
                },
              ],
            },
          },

          // Question 2: JavaScript — Word Frequency Counter (10 marks)
          {
            questionText: 'Given a sentence, calculate the frequency of each word.\n\nRules:\n- Case-insensitive comparison.\n- Ignore punctuation.\n- Sort words alphabetically.\n- Print each word followed by its frequency, separated by one space.\n- Print one word per line.',
            type: 'code',
            points: 10,
            difficulty: 'MEDIUM',
            bloomLevel: 'APPLY',
            category: 'Computer Science',
            tags: ['javascript', 'strings', 'hashmap', 'sorting'],
            codingConfig: {
              executionCategory: 'code',
              allowedLanguages: ['javascript'],
              defaultLanguage: 'javascript',
              starterCode: {
                javascript: '// JavaScript (Node.js 20) Starter Template\nconst fs = require("fs");\n\nfunction main() {\n  const input = fs.readFileSync(0, "utf-8");\n  if (!input || !input.trim()) return;\n\n  // TODO: Calculate word frequencies ignoring case and punctuation\n  // Print each word and its frequency sorted alphabetically\n}\n\nmain();\n',
              },
              cpuTimeLimitMs: 2000,
              memoryLimitMb: 256,
              testCases: [
                {
                  input: 'Hello world hello JavaScript world',
                  expectedOutput: 'hello 2\njavascript 1\nworld 2',
                  isHidden: false,
                  weight: 2,
                  explanation: 'Counts words case-insensitively and sorts alphabetically.',
                },
                {
                  input: 'apple banana apple',
                  expectedOutput: 'apple 2\nbanana 1',
                  isHidden: false,
                  weight: 2,
                  explanation: 'Counts frequencies and outputs in alphabetical order.',
                },
                {
                  input: 'Cat cat DOG dog dog',
                  expectedOutput: 'cat 2\ndog 3',
                  isHidden: false,
                  weight: 2,
                  explanation: 'Verifies case-insensitivity.',
                },
                {
                  input: 'Hello, HELLO! World.',
                  expectedOutput: 'hello 2\nworld 1',
                  isHidden: true,
                  weight: 2,
                  explanation: 'Hidden: Punctuation characters must be stripped.',
                },
                {
                  input: 'one two three two one one',
                  expectedOutput: 'one 3\nthree 1\ntwo 2',
                  isHidden: true,
                  weight: 2,
                  explanation: 'Hidden: Multi-word counts with correct alphabetical ordering.',
                },
              ],
            },
          },

          // Question 3: SQLite — Employees Earning Above Department Average (10 marks)
          {
            questionText: 'Write an SQLite query to retrieve employees whose salary is greater than the average salary of their own department.\n\nRequired output columns, in order:\n- name\n- department\n- salary\n\nRequired ordering:\n- department ascending\n- salary descending\n- name ascending',
            type: 'sql',
            points: 10,
            difficulty: 'HARD',
            bloomLevel: 'ANALYZE',
            category: 'Databases',
            tags: ['sqlite', 'subqueries', 'aggregation', 'sorting'],
            codingConfig: {
              executionCategory: 'sql',
              sqlDialect: 'sqlite',
              allowedLanguages: ['sqlite'],
              defaultLanguage: 'sqlite',
              starterCode: {
                sqlite: '-- SQLite 3 Starter Template\nSELECT name, department, salary\nFROM employees\nWHERE 1=0;\n',
              },
              schemaDdl: `CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    salary REAL NOT NULL
);

INSERT INTO employees VALUES
(1, 'Alice', 'IT', 60000),
(2, 'Bob', 'IT', 40000),
(3, 'Charlie', 'IT', 80000),
(4, 'David', 'HR', 30000),
(5, 'Eva', 'HR', 50000),
(6, 'Frank', 'HR', 40000);`,
              cpuTimeLimitMs: 2500,
              memoryLimitMb: 256,
              testCases: [
                {
                  input: '', // Base sample data from schemaDdl
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [
                    ['Eva', 'HR', 50000],
                    ['Charlie', 'IT', 80000],
                  ],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [
                      ['Eva', 'HR', 50000],
                      ['Charlie', 'IT', 80000],
                    ],
                    ordered: true,
                  }),
                  isHidden: false,
                  weight: 2,
                  explanation: 'Sample data: Eva qualifies in HR and Charlie qualifies in IT.',
                },
                {
                  input: `DELETE FROM employees;\nINSERT INTO employees VALUES (1, 'John', 'Sales', 20000), (2, 'Jane', 'Sales', 40000), (3, 'Jack', 'Sales', 60000);`,
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [
                    ['Jack', 'Sales', 60000],
                  ],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [
                      ['Jack', 'Sales', 60000],
                    ],
                    ordered: true,
                  }),
                  isHidden: false,
                  weight: 2,
                  explanation: 'Single department with salaries 20000, 40000, 60000. Avg is 40000; only Jack qualifies.',
                },
                {
                  input: `DELETE FROM employees;\nINSERT INTO employees VALUES (1, 'Liam', 'Finance', 50000), (2, 'Carol', 'Finance', 70000), (3, 'Mia', 'Marketing', 30000), (4, 'Noah', 'Marketing', 30000), (5, 'Dan', 'Marketing', 90000), (6, 'Grace', 'Operations', 100000), (7, 'Heidi', 'Operations', 100000);`,
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [
                    ['Carol', 'Finance', 70000],
                    ['Dan', 'Marketing', 90000],
                  ],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [
                      ['Carol', 'Finance', 70000],
                      ['Dan', 'Marketing', 90000],
                    ],
                    ordered: true,
                  }),
                  isHidden: false,
                  weight: 2,
                  explanation: 'Multiple departments with different averages: Carol in Finance, Dan in Marketing.',
                },
                {
                  input: `DELETE FROM employees;\nINSERT INTO employees VALUES (1, 'Paul', 'Logistics', 55000), (2, 'Quinn', 'Logistics', 55000), (3, 'Rachel', 'Logistics', 55000);`,
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [],
                    ordered: true,
                  }),
                  isHidden: true,
                  weight: 1,
                  explanation: 'Hidden: Equal salaries within department; none strictly exceed average.',
                },
                {
                  input: `DELETE FROM employees;\nINSERT INTO employees VALUES (1, 'SoloA', 'Legal', 95000), (2, 'SoloB', 'Security', 85000);`,
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [],
                    ordered: true,
                  }),
                  isHidden: true,
                  weight: 1,
                  explanation: 'Hidden: Single employee per department cannot exceed own average.',
                },
                {
                  input: `DELETE FROM employees;\nINSERT INTO employees VALUES (1, 'Dave', 'DeptA', 60000), (2, 'Don', 'DeptA', 20000), (3, 'Victor', 'DeptB', 60000), (4, 'Walter', 'DeptB', 100000);`,
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [
                    ['Dave', 'DeptA', 60000],
                    ['Walter', 'DeptB', 100000],
                  ],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [
                      ['Dave', 'DeptA', 60000],
                      ['Walter', 'DeptB', 100000],
                    ],
                    ordered: true,
                  }),
                  isHidden: true,
                  weight: 1,
                  explanation: 'Hidden: Overlapping salary values across departments.',
                },
                {
                  input: `DELETE FROM employees;\nINSERT INTO employees VALUES (1, 'Zara', 'R&D', 75000), (2, 'Alex', 'R&D', 75000), (3, 'Ben', 'R&D', 40000);`,
                  expectedColumns: ['name', 'department', 'salary'],
                  expectedRows: [
                    ['Alex', 'R&D', 75000],
                    ['Zara', 'R&D', 75000],
                  ],
                  expectedOutput: JSON.stringify({
                    columns: ['name', 'department', 'salary'],
                    rows: [
                      ['Alex', 'R&D', 75000],
                      ['Zara', 'R&D', 75000],
                    ],
                    ordered: true,
                  }),
                  isHidden: true,
                  weight: 1,
                  explanation: 'Hidden: Duplicate salary tie-break by name ascending (Alex before Zara).',
                },
              ],
            },
          },
        ],
      };

      const res = await fetch(`${backendUrl}/api/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify(assessmentPayload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      createdAssessment = body.data;

      assert.ok(createdAssessment._id);
      assert.equal(createdAssessment.title, 'UAP – Programming & SQL Assessment 01');
      assert.equal(createdAssessment.durationMinutes, 60);
      assert.equal(createdAssessment.totalPoints, 30);
      assert.equal(createdAssessment.status, 'draft');

      const questions = await Question.find({ assessmentId: createdAssessment._id }).sort({ orderIndex: 1 });
      assert.equal(questions.length, 3);

      pythonQuestion = questions[0];
      jsQuestion = questions[1];
      sqliteQuestion = questions[2];

      assert.equal(pythonQuestion.type, 'code');
      assert.equal(pythonQuestion.points, 10);
      assert.equal(pythonQuestion.codingConfig.allowedLanguages[0], 'python');
      assert.equal(pythonQuestion.codingConfig.testCases.length, 5);

      assert.equal(jsQuestion.type, 'code');
      assert.equal(jsQuestion.points, 10);
      assert.equal(jsQuestion.codingConfig.allowedLanguages[0], 'javascript');
      assert.equal(jsQuestion.codingConfig.testCases.length, 5);

      assert.equal(sqliteQuestion.type, 'sql');
      assert.equal(sqliteQuestion.points, 10);
      assert.equal(sqliteQuestion.codingConfig.sqlDialect, 'sqlite');
      assert.equal(sqliteQuestion.codingConfig.testCases.length, 7);
    });
  });

  // ========================================================
  // SECTION 2: Student Privacy & Hidden Case Protection
  // ========================================================
  describe('2. Student Privacy & Hidden Test Case Masking', () => {
    it('should reject student access to draft assessment with 403', async () => {
      const res = await fetch(`${backendUrl}/api/assessments/${createdAssessment._id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${studentAliceToken}`,
        },
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message.includes('not open for student access'));
    });

    it('should preserve all 17 public & hidden test cases for the authoring instructor', async () => {
      const res = await fetch(`${backendUrl}/api/assessments/${createdAssessment._id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${instructorToken}`,
        },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      const fetchedPyQ = json.data.questions.find((q) => q._id === pythonQuestion._id.toString());
      assert.equal(fetchedPyQ.codingConfig.testCases.length, 5);

      const fetchedSqlQ = json.data.questions.find((q) => q._id === sqliteQuestion._id.toString());
      assert.equal(fetchedSqlQ.codingConfig.testCases.length, 7);
    });
  });

  // ========================================================
  // SECTION 3: Live Code Execution (Python 3.11 & Node.js 20)
  // ========================================================
  describe('3. Live Student Code Execution via Sandboxed Microservice', () => {
    before(async () => {
      // Create student Alice active submission to exercise run-code
      aliceSubmission = await Submission.create({
        assessmentId: createdAssessment._id,
        studentId: studentAlice._id,
        status: 'in_progress',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        answers: new Map(),
      });
    });

    it('should execute Python 3.11 solution and ACCEPT all public sample test cases', async () => {
      const pythonSolution = `
import sys

def main():
    lines = sys.stdin.read().split()
    if not lines:
        return
    n = int(lines[0])
    nums = [int(x) for x in lines[1:n+1]]
    distinct = sorted(list(set(nums)), reverse=True)
    if len(distinct) >= 2:
        print(distinct[1])

if __name__ == '__main__':
    main()
`;

      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: pythonQuestion._id.toString(),
          language: 'python',
          code: pythonSolution,
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'ACCEPTED');
      assert.equal(json.data.totalCount, 3);
      assert.equal(json.data.passedCount, 3);
      assert.equal(json.data.sampleResults[0].actualOutput.trim(), '8');
      assert.equal(json.data.sampleResults[1].actualOutput.trim(), '5');
      assert.equal(json.data.sampleResults[2].actualOutput.trim(), '7');
    });

    it('should execute Node.js 20 JavaScript solution and ACCEPT all public sample test cases', async () => {
      const jsSolution = `
const fs = require('fs');

function main() {
  const input = fs.readFileSync(0, 'utf-8');
  if (!input || !input.trim()) return;

  const cleaned = input.toLowerCase().replace(/[^\\w\\s]/g, ' ');
  const words = cleaned.trim().split(/\\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  const sortedWords = Object.keys(freq).sort();
  for (const w of sortedWords) {
    console.log(\`\${w} \${freq[w]}\`);
  }
}

main();
`;

      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: jsQuestion._id.toString(),
          language: 'javascript',
          code: jsSolution,
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'ACCEPTED');
      assert.equal(json.data.totalCount, 3);
      assert.equal(json.data.passedCount, 3);
      assert.equal(json.data.sampleResults[0].actualOutput.trim(), 'hello 2\njavascript 1\nworld 2');
      assert.equal(json.data.sampleResults[1].actualOutput.trim(), 'apple 2\nbanana 1');
      assert.equal(json.data.sampleResults[2].actualOutput.trim(), 'cat 2\ndog 3');
    });

    it('should execute SQLite query solution and evaluate all 3 public test cases with structured columns', async () => {
      const sqliteSolution = `
SELECT e.name, e.department, e.salary
FROM employees e
WHERE e.salary > (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.department = e.department
)
ORDER BY e.department ASC, e.salary DESC, e.name ASC;
`;

      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'sqlite',
          code: sqliteSolution,
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'ACCEPTED');
      assert.deepEqual(json.data.columns, ['name', 'department', 'salary']);
      assert.equal(json.data.totalCount, 3);
      assert.equal(json.data.passedCount, 3);

      // Verify Case 1 (Eva, Charlie)
      assert.equal(json.data.sampleResults[0].passed, true);
      assert.deepEqual(json.data.sampleResults[0].actualRows, [
        { name: 'Eva', department: 'HR', salary: 50000 },
        { name: 'Charlie', department: 'IT', salary: 80000 },
      ]);

      // Verify Case 2 (Jack, Sales)
      assert.equal(json.data.sampleResults[1].passed, true);
      assert.deepEqual(json.data.sampleResults[1].actualRows, [
        { name: 'Jack', department: 'Sales', salary: 60000 },
      ]);

      // Verify Case 3 (Carol, Dan)
      assert.equal(json.data.sampleResults[2].passed, true);
      assert.deepEqual(json.data.sampleResults[2].actualRows, [
        { name: 'Carol', department: 'Finance', salary: 70000 },
        { name: 'Dan', department: 'Marketing', salary: 90000 },
      ]);
    });
  });

  // ========================================================
  // SECTION 4: Structured SQL Result Comparison Scenarios
  // ========================================================
  describe('4. Structured SQLite Result Comparison Verification (Phase 2 Scenarios)', () => {
    it('should reject incorrect SQL query with WRONG_ANSWER and show actual vs expected difference', async () => {
      const wrongSql = `SELECT name, department, salary FROM employees WHERE salary > 50000;`;

      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'sqlite',
          code: wrongSql,
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.verdict, 'WRONG_ANSWER');
      assert.equal(json.data.sampleResults[0].passed, false);
    });

    it('should reject dangerous administrative SQL commands with SECURITY_VIOLATION', async () => {
      const maliciousSql = `ATTACH DATABASE '/tmp/pwn.db' AS pwn; SELECT * FROM pwn;`;

      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({
          questionId: sqliteQuestion._id.toString(),
          language: 'sqlite',
          code: maliciousSql,
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.verdict, 'SECURITY_VIOLATION');
      assert.match(json.data.stderr, /Prohibited SQL statement/i);
    });
  });

  // ========================================================
  // SECTION 5: Student Progress Persistence & Final Submission
  // ========================================================
  describe('5. Student Progress Persistence & Submission Lifecycle', () => {
    it('should save student answers for Python, JavaScript and SQLite via saveProgress', async () => {
      const answersPayload = {
        [pythonQuestion._id.toString()]: {
          code: 'import sys\nprint(sorted(list(set(map(int, sys.stdin.read().split()[1:]))), reverse=True)[1])',
          language: 'python',
        },
        [jsQuestion._id.toString()]: {
          code: 'const fs = require("fs"); const w = fs.readFileSync(0, "utf-8").toLowerCase().replace(/[^\\w\\s]/g, " ").trim().split(/\\s+/).filter(Boolean); const f = {}; w.forEach(x => f[x] = (f[x]||0)+1); Object.keys(f).sort().forEach(k => console.log(k + " " + f[k]));',
          language: 'javascript',
        },
        [sqliteQuestion._id.toString()]: {
          code: 'SELECT e.name, e.department, e.salary FROM employees e WHERE e.salary > (SELECT AVG(e2.salary) FROM employees e2 WHERE e2.department = e.department) ORDER BY e.department ASC, e.salary DESC, e.name ASC;',
          language: 'sqlite',
        },
      };

      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/progress`, {
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

      // Verify answers in DB
      const dbSub = await Submission.findById(aliceSubmission._id).lean();
      const answers = dbSub.answers instanceof Map ? Object.fromEntries(dbSub.answers) : dbSub.answers;
      assert.ok(answers[pythonQuestion._id.toString()]);
      assert.equal(answers[pythonQuestion._id.toString()].language, 'python');
      assert.equal(answers[jsQuestion._id.toString()].language, 'javascript');
      assert.equal(answers[sqliteQuestion._id.toString()].language, 'sqlite');
    });

    it('should submit assessment, transition status to submitted, and calculate provisional score', async () => {
      const res = await fetch(`${backendUrl}/api/submissions/${aliceSubmission._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAliceToken}`,
        },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);

      const finalizedSub = await Submission.findById(aliceSubmission._id).lean();
      assert.equal(finalizedSub.status, 'submitted');
      assert.ok(finalizedSub.submittedAt);
      assert.equal(finalizedSub.submittedReason, 'USER_SUBMITTED');
    });
  });

  // ========================================================
  // SECTION 6: Audience Guardrail & Publication Workflow
  // ========================================================
  describe('6. Publication Workflow & Audience Guardrail Enforcement', () => {
    it('should verify assessment is in draft and unassigned students cannot start attempt when restricted', async () => {
      // Create a restricted draft assessment without assigned students
      const restrictedAsmt = await Assessment.create({
        title: 'Restricted Audience Verification Assessment',
        instructorId: instructor._id,
        durationMinutes: 60,
        totalPoints: 10,
        status: 'draft',
        accessType: 'restricted',
        assignedStudents: [], // Audience NOT configured
      });

      // Student Bob tries to start attempt
      const res = await fetch(`${backendUrl}/api/submissions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBobToken}`,
        },
        body: JSON.stringify({ assessmentId: restrictedAsmt._id.toString() }),
      });

      // Draft assessment must be rejected for students
      assert.ok([400, 403, 404].includes(res.status));
    });

    it('should safely publish assessment once audience is configured', async () => {
      // Configure publication audience (e.g. public or assigned students)
      const updateRes = await fetch(`${backendUrl}/api/assessments/${createdAssessment._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          status: 'published',
          accessType: 'public',
        }),
      });

      assert.equal(updateRes.status, 200);
      const json = await updateRes.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'published');
      assert.equal(json.data.accessType, 'public');

      // Verify that after publication, student retrieval succeeds AND strictly masks hidden test cases
      const studentGetRes = await fetch(`${backendUrl}/api/assessments/${createdAssessment._id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${studentAliceToken}`,
        },
      });

      assert.equal(studentGetRes.status, 200);
      const studentJson = await studentGetRes.json();
      const rawText = JSON.stringify(studentJson);

      // Verify that confidential hidden test data does not leak to student caller
      assert.ok(!rawText.includes('-10 -20 -5'), 'Hidden negative input must not leak');
      assert.ok(!rawText.includes('one two three two one one'), 'Hidden JS input must not leak');
      assert.ok(!rawText.includes('Logistics'), 'Hidden SQL seed table must not leak');
      assert.ok(!rawText.includes('SoloA'), 'Hidden Legal seed must not leak');
      assert.ok(!rawText.includes('Hidden:'), 'Hidden explanations must not leak');

      const fetchedPyQ = studentJson.data.questions.find((q) => q._id === pythonQuestion._id.toString());
      assert.ok(fetchedPyQ);
      assert.equal(fetchedPyQ.codingConfig.testCases.length, 3);

      const fetchedSqlQ = studentJson.data.questions.find((q) => q._id === sqliteQuestion._id.toString());
      assert.ok(fetchedSqlQ);
      assert.equal(fetchedSqlQ.codingConfig.testCases.length, 3);
    });
  });
});
