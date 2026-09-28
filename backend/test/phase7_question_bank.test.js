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
  QuestionImportJob,
} = require('../src/models');

const aiClassificationService = require('../src/services/aiClassification.service');
const questionParserService = require('../src/services/questionParser.service');
const googleFormsService = require('../src/services/googleForms.service');
const questionBankService = require('../src/services/questionBank.service');
const questionImportService = require('../src/services/questionImport.service');

describe('Phase 7 Verification Suite: Question Bank, Intelligent Import, Versioning & Randomization', () => {
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

    const passwordHash = await hashPassword('Phase7@Test123');

    instructorA = await User.create({
      name: 'Dr. Phase 7 Instructor A',
      email: 'p7_instructor_a@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P7-001',
      department: 'Computer Science',
    });

    instructorB = await User.create({
      name: 'Dr. Phase 7 Instructor B',
      email: 'p7_instructor_b@uap.edu',
      password: passwordHash,
      role: 'instructor',
      status: 'active',
      isActive: true,
      facultyId: 'FAC-P7-002',
      department: 'Information Science',
    });

    studentUser = await User.create({
      name: 'Phase 7 Student User',
      email: 'p7_student@uap.edu',
      password: passwordHash,
      role: 'student',
      status: 'active',
      isActive: true,
      studentId: 'STU-P7-001',
      department: 'Computer Science',
    });

    adminUser = await User.create({
      name: 'Phase 7 Admin User',
      email: 'p7_admin@uap.edu',
      password: passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
      adminId: 'ADM-P7-001',
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
    await BankQuestion.deleteMany({ createdBy: { $in: [instructorA._id, instructorB._id, adminUser._id] } });
    await QuestionImportJob.deleteMany({ instructorId: { $in: [instructorA._id, instructorB._id] } });
    await Submission.deleteMany({ studentId: studentUser._id });
    await Question.deleteMany({});
    await Assessment.deleteMany({ instructorId: { $in: [instructorA._id, instructorB._id] } });
    await User.deleteMany({ _id: { $in: [instructorA._id, instructorB._id, studentUser._id, adminUser._id] } });
    await disconnectDB();
  });

  // =========================================================================
  // 1. MANUAL QUESTION CREATION & VALIDATION
  // =========================================================================
  describe('1. Manual Question Bank Creation & Validation', () => {
    let createdMcqId;

    it('1.1 should allow instructor to manually create an MCQ in Question Bank', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'What is the worst-case time complexity of QuickSort?',
          type: 'mcq',
          options: [
            { id: 'a', text: 'O(N)' },
            { id: 'b', text: 'O(N log N)' },
            { id: 'c', text: 'O(N^2)' },
            { id: 'd', text: 'O(log N)' },
          ],
          correctAnswer: 'c',
          points: 10,
          difficulty: 'MEDIUM',
          bloomLevel: 'UNDERSTAND',
          category: 'Algorithms',
          tags: ['algorithms', 'quicksort', 'complexity'],
          explanation: 'When partition picks the most extreme element repeatedly, QuickSort degrades to O(N^2).',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.type, 'mcq');
      assert.strictEqual(data.data.version, 1);
      assert.strictEqual(data.data.isLatest, true);
      assert.strictEqual(data.data.status, 'APPROVED');
      assert.ok(data.data.questionBankId);
      createdMcqId = data.data._id;
    });

    it('1.2 should allow instructor to manually create SHORT_ANSWER and LONG_ANSWER questions', async () => {
      const shortRes = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'Define the concept of idempotency in RESTful web services.',
          type: 'short_answer',
          points: 15,
          difficulty: 'EASY',
          bloomLevel: 'REMEMBER',
          category: 'Web Engineering',
          tags: ['rest', 'http', 'idempotent'],
          correctAnswer: 'An operation is idempotent if executing it multiple times leaves the system in the exact same state.',
        }),
      });
      assert.strictEqual(shortRes.status, 201);

      const longRes = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'Critically analyze the CAP theorem in modern distributed architectures.',
          type: 'long_answer',
          points: 30,
          difficulty: 'HARD',
          bloomLevel: 'ANALYZE',
          category: 'Distributed Systems',
          tags: ['distributed-systems', 'cap-theorem', 'databases'],
        }),
      });
      assert.strictEqual(longRes.status, 201);
    });

    it('1.3 should reject creation with invalid bloom level or missing question text with 422', async () => {
      const invalidBloom = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'Valid question text here',
          bloomLevel: 'INVALID_BLOOM',
        }),
      });
      assert.strictEqual(invalidBloom.status, 422);

      const missingText = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'a',
          type: 'mcq',
        }),
      });
      assert.strictEqual(missingText.status, 422);
    });
  });

  // =========================================================================
  // 2. SEARCH, FILTER & DUPLICATE DETECTION
  // =========================================================================
  describe('2. Search, Filter & Duplicate Detection', () => {
    it('2.1 should filter questions by category, bloomLevel, and difficulty', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank?category=Algorithms&bloomLevel=UNDERSTAND&difficulty=MEDIUM`, {
        headers: { Authorization: `Bearer ${instructorAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.length >= 1);
      assert.strictEqual(data.data[0].category, 'Algorithms');
      assert.strictEqual(data.data[0].bloomLevel, 'UNDERSTAND');
    });

    it('2.2 should search questions by keyword matching questionText case-insensitively', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank?search=quicksort`, {
        headers: { Authorization: `Bearer ${instructorAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.some((q) => q.questionText.toLowerCase().includes('quicksort')));
    });

    it('2.3 should retrieve distinct categories and tags for the instructor', async () => {
      const catRes = await fetch(`${baseUrl}/api/question-bank/categories`, {
        headers: { Authorization: `Bearer ${instructorAToken}` },
      });
      assert.strictEqual(catRes.status, 200);
      const catData = await catRes.json();
      assert.ok(catData.data.includes('Algorithms'));

      const tagRes = await fetch(`${baseUrl}/api/question-bank/tags`, {
        headers: { Authorization: `Bearer ${instructorAToken}` },
      });
      assert.strictEqual(tagRes.status, 200);
      const tagData = await tagRes.json();
      assert.ok(tagData.data.includes('quicksort'));
    });

    it('2.4 should detect duplicate question using normalized text matching', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank/check-duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: '  What is the worst-case time complexity of QuickSort?!!  ',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.isDuplicate, true);
      assert.ok(data.duplicateQuestion);
      assert.strictEqual(data.duplicateQuestion.category, 'Algorithms');
    });
  });

  // =========================================================================
  // 3. AI CLASSIFICATION & DETERMINISTIC HEURISTIC FALLBACK
  // =========================================================================
  describe('3. AI Classification & Deterministic Heuristic Fallback', () => {
    it('3.1 should classify Bloom taxonomy and difficulty using deterministic heuristic analysis', async () => {
      const rememberQ = await aiClassificationService.classifyQuestion({
        questionText: 'List and recall the primary HTTP methods.',
        options: [],
      });
      assert.strictEqual(rememberQ.bloomLevel, 'REMEMBER');
      assert.ok(rememberQ.confidence >= 50 && rememberQ.confidence <= 100);

      const createQ = await aiClassificationService.classifyQuestion({
        questionText: 'Design and build a scalable microservice architecture for video processing.',
        options: [],
      });
      assert.strictEqual(createQ.bloomLevel, 'CREATE');
      assert.strictEqual(createQ.difficulty, 'HARD');

      const analyzeQ = await aiClassificationService.classifyQuestion({
        questionText: 'Compare, contrast, and analyze the trade-offs between SQL and NoSQL databases.',
        options: [],
      });
      assert.strictEqual(analyzeQ.bloomLevel, 'ANALYZE');
    });

    it('3.2 should strictly validate AI classification output schema', () => {
      const valid = aiClassificationService.validateClassification({
        bloomLevel: 'APPLY',
        difficulty: 'MEDIUM',
        confidence: 85,
        type: 'short_answer',
        tags: ['web'],
      });
      assert.strictEqual(valid.valid, true);

      const invalid = aiClassificationService.validateClassification({
        bloomLevel: 'SUPER_HARD',
        difficulty: 'EXTREME',
        confidence: 250,
      });
      assert.strictEqual(invalid.valid, false);
      assert.ok(invalid.errors.length > 0);
    });
  });

  // =========================================================================
  // 4. QUESTION DOCUMENT PARSER (PDF/DOCX/TEXT)
  // =========================================================================
  describe('4. Question Document Parser Pipeline', () => {
    it('4.1 should parse structured text document containing MCQs and subjective questions', async () => {
      const rawDocText = `
1. What does ACID stand for in relational database transactions?
a) Atomicity, Consistency, Isolation, Durability
b) Association, Concurrency, Indexing, Data
c) Access, Control, Integrity, Distribution
d) Allocation, Security, Identity, Domain
Answer: A
Points: 10
Explanation: ACID guarantees transactional consistency.

2. Explain the purpose of a reverse proxy in web infrastructure.
Points: 15

3. Discuss the Raft consensus algorithm and leader election mechanics.
      `;

      const parsed = await questionParserService.parseFromRawText(rawDocText, 'test_sample.txt');
      assert.strictEqual(parsed.length, 3);

      // Question 1: MCQ
      assert.strictEqual(parsed[0].type, 'mcq');
      assert.strictEqual(parsed[0].options.length, 4);
      assert.strictEqual(parsed[0].correctAnswer, 'a');
      assert.strictEqual(parsed[0].points, 10);
      assert.ok(parsed[0].explanation.includes('ACID guarantees'));

      // Question 2: Short answer
      assert.strictEqual(parsed[1].type, 'short_answer');
      assert.strictEqual(parsed[1].points, 15);

      // Question 3: Long answer
      assert.strictEqual(parsed[2].type, 'long_answer');
    });
  });

  // =========================================================================
  // 5. GOOGLE FORMS IMPORT PIPELINE
  // =========================================================================
  describe('5. Google Forms Import Pipeline', () => {
    it('5.1 should extract Google Form ID from standard URL formats', () => {
      const url1 = 'https://docs.google.com/forms/d/1FAIpQLSc7zabcdef1234567890/edit';
      const formId1 = googleFormsService.extractFormId(url1);
      assert.strictEqual(formId1, '1FAIpQLSc7zabcdef1234567890');

      const url2 = 'https://docs.google.com/forms/d/e/1FAIpQLSxyz987654321/viewform';
      const formId2 = googleFormsService.extractFormId(url2);
      assert.strictEqual(formId2, '1FAIpQLSxyz987654321');
    });

    it('5.2 should parse structured Google Form JSON object into standard UAP question format', async () => {
      const mockForm = {
        info: { title: 'Computer Science Diagnostic' },
        items: [
          {
            title: 'Which data structure uses LIFO order?',
            questionItem: {
              question: {
                questionId: 'q_lifo',
                choiceQuestion: {
                  type: 'RADIO',
                  options: [{ value: 'Queue' }, { value: 'Stack' }, { value: 'Tree' }],
                },
              },
            },
          },
          {
            title: 'Briefly define Big-O notation.',
            questionItem: {
              question: {
                questionId: 'q_big_o',
                textQuestion: { paragraph: false },
              },
            },
          },
          {
            title: 'Describe the complete architecture of the Linux Kernel virtual file system.',
            questionItem: {
              question: {
                questionId: 'q_kernel',
                textQuestion: { paragraph: true },
              },
            },
          },
        ],
      };

      const parsed = await googleFormsService.parseGoogleFormResponse(mockForm);
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].type, 'mcq');
      assert.strictEqual(parsed[0].options.length, 3);
      assert.strictEqual(parsed[1].type, 'short_answer');
      assert.strictEqual(parsed[2].type, 'long_answer');
    });
  });

  // =========================================================================
  // 6. INSTRUCTOR REVIEW WORKFLOW (ACCEPT / REJECT / BULK REVIEW)
  // =========================================================================
  describe('6. Instructor Review Workflow & Approval Gate', () => {
    let importJobId;
    let tempId1;
    let tempId2;
    let tempId3;

    before(async () => {
      // Create an import job with simulated extracted questions
      const job = await QuestionImportJob.create({
        instructorId: instructorA._id,
        sourceType: 'PDF',
        originalFilename: 'exam_sample.pdf',
        status: 'REVIEW_REQUIRED',
        progress: 100,
        totalDetected: 3,
        extractedQuestions: [
          {
            tempId: 'temp-q1',
            questionText: 'What is the space complexity of binary search on an array?',
            type: 'mcq',
            options: [
              { id: 'a', text: 'O(1)' },
              { id: 'b', text: 'O(N)' },
            ],
            correctAnswer: 'a',
            points: 5,
            difficulty: 'EASY',
            bloomLevel: 'UNDERSTAND',
            category: 'Algorithms',
            tags: ['binary-search'],
            reviewStatus: 'PENDING',
          },
          {
            tempId: 'temp-q2',
            questionText: 'Flawed question to be rejected: foo bar baz?',
            type: 'short_answer',
            points: 2,
            difficulty: 'EASY',
            bloomLevel: 'REMEMBER',
            category: 'Miscellaneous',
            reviewStatus: 'PENDING',
          },
          {
            tempId: 'temp-q3',
            questionText: 'Explain virtual memory paging mechanics.',
            type: 'short_answer',
            points: 10,
            difficulty: 'MEDIUM',
            bloomLevel: 'UNDERSTAND',
            category: 'Operating Systems',
            reviewStatus: 'PENDING',
          },
        ],
      });

      importJobId = job._id.toString();
      tempId1 = 'temp-q1';
      tempId2 = 'temp-q2';
      tempId3 = 'temp-q3';
    });

    it('6.1 should allow instructor to preview pending imported questions', async () => {
      const res = await fetch(`${baseUrl}/api/question-import/jobs/${importJobId}/preview`, {
        headers: { Authorization: `Bearer ${instructorAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.questions.length, 3);
      assert.strictEqual(data.questions[0].reviewStatus, 'PENDING');
    });

    it('6.2 should allow single question ACCEPT and create approved BankQuestion', async () => {
      const res = await fetch(
        `${baseUrl}/api/question-import/jobs/${importJobId}/questions/${tempId1}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${instructorAToken}`,
          },
          body: JSON.stringify({ action: 'ACCEPT' }),
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.bankQuestionId);

      // Verify BankQuestion was actually created
      const bq = await BankQuestion.findById(data.bankQuestionId);
      assert.ok(bq);
      assert.strictEqual(bq.status, 'APPROVED');
      assert.strictEqual(bq.version, 1);
    });

    it('6.3 should allow single question REJECT without creating a BankQuestion', async () => {
      const preCount = await BankQuestion.countDocuments({ createdBy: instructorA._id });

      const res = await fetch(
        `${baseUrl}/api/question-import/jobs/${importJobId}/questions/${tempId2}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${instructorAToken}`,
          },
          body: JSON.stringify({ action: 'REJECT' }),
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.action, 'REJECT');

      const postCount = await BankQuestion.countDocuments({ createdBy: instructorA._id });
      assert.strictEqual(postCount, preCount); // No new question bank item created
    });

    it('6.4 should allow single question ACCEPT with faculty override edits', async () => {
      const res = await fetch(
        `${baseUrl}/api/question-import/jobs/${importJobId}/questions/${tempId3}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${instructorAToken}`,
          },
          body: JSON.stringify({
            action: 'ACCEPT',
            reviewData: {
              questionText: 'Explain virtual memory paging mechanics and TLB hit/miss handling.',
              points: 20,
              bloomLevel: 'ANALYZE',
              difficulty: 'HARD',
            },
          }),
        }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.bankQuestionId);

      const editedBq = await BankQuestion.findById(data.bankQuestionId);
      assert.strictEqual(editedBq.points, 20);
      assert.strictEqual(editedBq.bloomLevel, 'ANALYZE');
      assert.strictEqual(editedBq.difficulty, 'HARD');
    });

    it('6.5 should support BULK REVIEW (bulk ACCEPT)', async () => {
      const bulkJob = await QuestionImportJob.create({
        instructorId: instructorA._id,
        sourceType: 'GOOGLE_FORMS',
        status: 'REVIEW_REQUIRED',
        progress: 100,
        totalDetected: 2,
        extractedQuestions: [
          {
            tempId: 'bulk-1',
            questionText: 'Bulk Question One',
            type: 'short_answer',
            points: 5,
            reviewStatus: 'PENDING',
          },
          {
            tempId: 'bulk-2',
            questionText: 'Bulk Question Two',
            type: 'short_answer',
            points: 5,
            reviewStatus: 'PENDING',
          },
        ],
      });

      const res = await fetch(`${baseUrl}/api/question-import/jobs/${bulkJob._id}/bulk-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          tempIds: ['bulk-1', 'bulk-2'],
          action: 'ACCEPT',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.processedCount, 2);

      const refreshedJob = await QuestionImportJob.findById(bulkJob._id);
      assert.strictEqual(refreshedJob.status, 'COMPLETED');
      assert.strictEqual(refreshedJob.totalAccepted, 2);
    });
  });

  // =========================================================================
  // 7. REAL QUESTION VERSIONING & IMMUTABILITY
  // =========================================================================
  describe('7. Real Question Versioning & Historical Immutability', () => {
    let originalQuestion;
    let assessmentWithV1;
    let studentSubmission;

    it('7.1 should create version 1 of a question and embed it in an assessment', async () => {
      // 1. Create Question Bank item (v1)
      originalQuestion = await questionBankService.createQuestion(instructorA._id, {
        questionText: 'What is the default port for HTTPS communication?',
        type: 'mcq',
        options: [
          { id: '80', text: '80' },
          { id: '443', text: '443' },
          { id: '8080', text: '8080' },
        ],
        correctAnswer: '443',
        points: 10,
        difficulty: 'EASY',
        bloomLevel: 'REMEMBER',
        category: 'Networking',
        tags: ['networking', 'https', 'ports'],
      });
      assert.strictEqual(originalQuestion.version, 1);
      assert.strictEqual(originalQuestion.isLatest, true);

      // 2. Create Assessment using Question Bank item (snapshot embedded)
      const asmtRes = await fetch(`${baseUrl}/api/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          title: 'Networking & Security Exam 2026',
          category: 'Networking',
          durationMinutes: 30,
          totalPoints: 10,
          passingScore: 6,
          status: 'published',
          accessType: 'public',
          questions: [
            {
              questionText: originalQuestion.questionText,
              type: originalQuestion.type,
              options: originalQuestion.options,
              correctAnswer: originalQuestion.correctAnswer,
              points: originalQuestion.points,
              bankQuestionId: originalQuestion._id,
              questionBankId: originalQuestion.questionBankId,
              questionBankVersion: originalQuestion.version,
            },
          ],
        }),
      });
      assert.strictEqual(asmtRes.status, 201);
      const asmtData = await asmtRes.json();
      assessmentWithV1 = asmtData.data;

      // 3. Student takes the exam and submits
      const startRes = await fetch(`${baseUrl}/api/submissions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ assessmentId: assessmentWithV1._id }),
      });
      assert.strictEqual(startRes.status, 200);
      const startData = await startRes.json();
      studentSubmission = startData.data || startData.submission;

      // Submit correct answer
      const qDoc = await Question.findOne({ assessmentId: assessmentWithV1._id });
      const submitRes = await fetch(`${baseUrl}/api/submissions/${studentSubmission._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          answers: { [qDoc._id.toString()]: '443' },
        }),
      });
      assert.strictEqual(submitRes.status, 200);
      const submitData = await submitRes.json();
      const submissionResult = submitData.data || submitData.submission;
      assert.strictEqual(submissionResult.score, 10);
    });

    it('7.2 should create version 2 when instructor edits the referenced Question Bank item', async () => {
      // Instructor updates the question
      const updateRes = await fetch(`${baseUrl}/api/question-bank/${originalQuestion._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorAToken}`,
        },
        body: JSON.stringify({
          questionText: 'What is the standard secure port for TLS/HTTPS communication? (Updated Prompt)',
          points: 20,
          difficulty: 'MEDIUM',
        }),
      });
      assert.strictEqual(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.success, true);
      assert.strictEqual(updateData.data.version, 2);
      assert.strictEqual(updateData.data.isLatest, true);

      // Verify v1 still exists in database as isLatest: false
      const v1 = await BankQuestion.findById(originalQuestion._id);
      assert.strictEqual(v1.version, 1);
      assert.strictEqual(v1.isLatest, false);
    });

    it('7.3 should verify historical assessment and student submission remain strictly bound to version 1', async () => {
      // Check the question on the assessment
      const assessmentQ = await Question.findOne({ assessmentId: assessmentWithV1._id });
      assert.strictEqual(assessmentQ.questionBankVersion, 1);
      assert.strictEqual(assessmentQ.points, 10); // Original points, not 20

      // Check student submission
      const sub = await Submission.findById(studentSubmission._id);
      assert.strictEqual(sub.score, 10); // Unmutated historical score
      assert.strictEqual(sub.status, 'evaluated');
    });
  });

  // =========================================================================
  // 8. CONTROLLED ASSESSMENT RANDOMIZATION
  // =========================================================================
  describe('8. Controlled Assessment Randomization & Stable Question Set', () => {
    let randomAssessmentId;
    let allQuestionIds = [];

    before(async () => {
      // Create assessment with 5 questions, poolCount: 3, shuffleOrder: true
      const asmt = await Assessment.create({
        title: 'Randomized Algorithms Assessment',
        category: 'Algorithms',
        instructorId: instructorA._id,
        durationMinutes: 45,
        totalPoints: 30,
        passingScore: 18,
        status: 'published',
        accessType: 'public',
        randomization: {
          enabled: true,
          poolCount: 3,
          shuffleOrder: true,
        },
      });
      randomAssessmentId = asmt._id;

      for (let i = 1; i <= 5; i++) {
        const q = await Question.create({
          assessmentId: randomAssessmentId,
          questionText: `Random Pool Question ${i}?`,
          type: 'mcq',
          options: [
            { id: 'a', text: `Option A for Q${i}` },
            { id: 'b', text: `Option B for Q${i}` },
          ],
          correctAnswer: 'a',
          points: 10,
          orderIndex: i - 1,
        });
        allQuestionIds.push(q._id.toString());
      }
    });

    it('8.1 should select poolCount questions on student attempt start and persist assignedQuestionIds', async () => {
      const res = await fetch(`${baseUrl}/api/submissions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ assessmentId: randomAssessmentId }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const sub = data.data || data.submission;
      assert.strictEqual(sub.assignedQuestionIds.length, 3);

      // Verify all 3 assigned IDs belong to the assessment's question set
      sub.assignedQuestionIds.forEach((id) => {
        assert.ok(allQuestionIds.includes(id.toString()));
      });
    });

    it('8.2 should return stable assigned questions upon subsequent assessment retrieval', async () => {
      const res = await fetch(`${baseUrl}/api/assessments/${randomAssessmentId}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.questions.length, 3);

      // Resuming / retrieving again yields the EXACT same order and IDs
      const res2 = await fetch(`${baseUrl}/api/assessments/${randomAssessmentId}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const data2 = await res2.json();
      assert.deepStrictEqual(
        data.data.questions.map((q) => q._id.toString()),
        data2.data.questions.map((q) => q._id.toString())
      );
    });

    it('8.3 should score only the student assigned questions upon submission', async () => {
      const sub = await Submission.findOne({
        studentId: studentUser._id,
        assessmentId: randomAssessmentId,
      });

      const assignedQIds = sub.assignedQuestionIds.map((id) => id.toString());
      // Answer 2 out of 3 correctly
      const answers = {
        [assignedQIds[0]]: 'a', // correct (10)
        [assignedQIds[1]]: 'a', // correct (10)
        [assignedQIds[2]]: 'b', // wrong (0)
      };

      const res = await fetch(`${baseUrl}/api/submissions/${sub._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ answers }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const subResult = data.data || data.submission;
      assert.strictEqual(subResult.score, 20);
      assert.strictEqual(subResult.totalPoints, 30);
    });
  });

  // =========================================================================
  // 9. RBAC & SECURITY ISOLATION
  // =========================================================================
  describe('9. RBAC & Security Isolation', () => {
    it('9.1 should block student from accessing Question Bank endpoints with HTTP 403', async () => {
      const listRes = await fetch(`${baseUrl}/api/question-bank`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(listRes.status, 403);

      const createRes = await fetch(`${baseUrl}/api/question-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ questionText: 'Student trying to create a question' }),
      });
      assert.strictEqual(createRes.status, 403);
    });

    it('9.2 should block student from accessing Question Import endpoints with HTTP 403', async () => {
      const jobsRes = await fetch(`${baseUrl}/api/question-import/jobs`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(jobsRes.status, 403);
    });

    it('9.3 should prevent Instructor B from updating Instructor A Question Bank items', async () => {
      // Find question created by Instructor A
      const questionA = await BankQuestion.findOne({ createdBy: instructorA._id });
      assert.ok(questionA);

      const res = await fetch(`${baseUrl}/api/question-bank/${questionA._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorBToken}`,
        },
        body: JSON.stringify({ questionText: 'Hacked question' }),
      });
      // Should be 403 or 404
      assert.ok(res.status === 403 || res.status === 404);
    });

    it('9.4 should allow Admin to view and manage all Question Bank items across instructors', async () => {
      const res = await fetch(`${baseUrl}/api/question-bank`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const list = data.data || data.questions;
      assert.ok(list && list.length >= 1);
    });
  });
});
