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
  QuestionVersion,
  QuestionBank,
  MockTest,
  MockTestAttempt,
  QuestionGenerationJob,
  QuestionImportJob,
} = require('../src/models');
const subjectTopicService = require('../src/services/subjectTopic.service');
const questionManagementService = require('../src/services/questionManagement.service');
const questionBankGroupService = require('../src/services/questionBankGroup.service');
const aiQuestionGenerationService = require('../src/services/aiQuestionGeneration.service');
const questionBulkImportService = require('../src/services/questionBulkImport.service');
const mockTestService = require('../src/services/mockTest.service');
const {
  serializeQuestionForFaculty,
  serializeQuestionForStudent,
} = require('../src/utils/questionSerializer');

describe('UAP Question Bank Technical Architecture Suite', () => {
  let facultyA;
  let facultyB;
  let studentUser;
  let createdSubject;
  let createdTopic;
  let executionServer;
  let originalClientUrl;
  let originalApiKey;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

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

    facultyA = await User.create({
      name: 'Dr. Alan Turing',
      email: `alan_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
    });

    facultyB = await User.create({
      name: 'Dr. Ada Lovelace',
      email: `ada_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
    });

    studentUser = await User.create({
      name: 'Student Alice',
      email: `alice_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'student',
      isVerified: true,
      approvalStatus: 'approved',
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

  describe('1. Subject and Syllabus Hierarchy', () => {
    it('1.1 should create reusable Subject with units and exam categories', async () => {
      createdSubject = await subjectTopicService.createSubject(facultyA._id, {
        name: 'Data Structures & Algorithms',
        code: `CS-DSA-${Date.now().toString(36).toUpperCase()}`,
        description: 'Core computer science subject',
        department: 'Computer Science',
        examCategories: ['COMPETITIVE', 'INSTITUTIONAL'],
        examIds: ['GATE', 'BTECH_CSE'],
        units: [
          { unitNumber: 1, name: 'Linear Structures' },
          { unitNumber: 2, name: 'Trees & Graphs' },
        ],
      });

      assert.ok(createdSubject._id);
      assert.equal(createdSubject.name, 'Data Structures & Algorithms');
      assert.equal(createdSubject.units.length, 2);
    });

    it('1.2 should create Topic with subtopic concepts under Subject', async () => {
      createdTopic = await subjectTopicService.createTopic(facultyA._id, {
        name: 'Binary Search Trees',
        code: 'DSA-BST',
        subjectId: createdSubject._id,
        unitNumber: 2,
        concepts: [
          { name: 'BST Insertion and Traversal', code: 'BST-TRAV' },
          { name: 'BST Deletion and Rebalancing', code: 'BST-DEL' },
        ],
        conceptTags: ['BST Insertion and Traversal', 'BST Deletion and Rebalancing'],
      });

      assert.ok(createdTopic._id);
      assert.equal(createdTopic.subjectId.toString(), createdSubject._id.toString());
      assert.equal(createdTopic.conceptTags.length, 2);
    });

    it('1.3 should retrieve topic hierarchy for a subject', async () => {
      const hierarchy = await subjectTopicService.getTopicHierarchy(createdSubject._id);
      assert.ok(hierarchy.subject);
      assert.ok(Array.isArray(hierarchy.topics));
      assert.ok(hierarchy.topics.length >= 1);
    });
  });

  describe('2. Question Data Model & Lifecycle (DRAFT -> PUBLISHED -> ARCHIVED)', () => {
    let questionDoc;

    it('2.1 should create a draft question with concept mapping', async () => {
      questionDoc = await questionManagementService.createQuestion(facultyA, {
        statement: 'What is the worst-case search time complexity in an unbalanced Binary Search Tree?',
        questionType: 'SINGLE_MCQ',
        difficulty: 'MEDIUM',
        subjectId: createdSubject._id,
        topicIds: [createdTopic._id],
        conceptTags: ['BST Insertion and Traversal'],
        options: [
          { id: 'opt_1', text: 'O(log N)', isCorrect: false },
          { id: 'opt_2', text: 'O(N)', isCorrect: true },
          { id: 'opt_3', text: 'O(1)', isCorrect: false },
          { id: 'opt_4', text: 'O(N log N)', isCorrect: false },
        ],
        answerKey: 'opt_2',
        explanation: 'In the worst case (skewed tree), BST degrades into a linked list with O(N) search.',
        marks: 2,
        negativeMarks: 0.66,
      });

      assert.ok(questionDoc.id);
      assert.equal(questionDoc.status, 'DRAFT');
      assert.equal(questionDoc.currentVersion, 1);
    });

    it('2.2 should run validation on question before publishing', async () => {
      const report = await questionManagementService.validateQuestion(questionDoc.id);
      assert.equal(report.valid, true);
      assert.equal(report.errors.length, 0);
    });

    it('2.3 should publish question, locking version 1 snapshot', async () => {
      const published = await questionManagementService.publishQuestion(questionDoc.id, facultyA);
      assert.equal(published.status, 'PUBLISHED');
      assert.equal(published.currentVersion, 1);

      const v1 = await QuestionVersion.findOne({
        questionId: questionDoc.id,
        versionNumber: 1,
      });
      assert.ok(v1);
      assert.equal(v1.questionSnapshot.statement, questionDoc.statement);
    });

    it('2.4 editing a published question should create an immutable Version 2', async () => {
      const updated = await questionManagementService.updateQuestion(questionDoc.id, facultyA, {
        statement: 'What is the worst-case search time complexity in a degenerated/skewed Binary Search Tree?',
        changeSummary: 'Clarified skewed tree condition',
      });

      assert.equal(updated.currentVersion, 2);

      const v1 = await QuestionVersion.findOne({ questionId: questionDoc.id, versionNumber: 1 });
      const v2 = await QuestionVersion.findOne({ questionId: questionDoc.id, versionNumber: 2 });

      assert.ok(v1);
      assert.ok(v2);
      assert.notEqual(v1.questionSnapshot.statement, v2.questionSnapshot.statement);
    });

    it('2.5 should prevent unauthorized faculty from editing another faculty question', async () => {
      await assert.rejects(
        async () => {
          await questionManagementService.updateQuestion(questionDoc.id, facultyB, {
            statement: 'Malicious modification attempt',
          });
        },
        (err) => {
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    it('2.6 should archive question without deleting historical records', async () => {
      const archived = await questionManagementService.archiveQuestion(questionDoc.id, facultyA);
      assert.equal(archived.status, 'ARCHIVED');
    });
  });

  describe('3. Student Privacy & Response Serializers', () => {
    let publishedCodingQuestion;

    before(async () => {
      publishedCodingQuestion = await questionManagementService.createQuestion(facultyA, {
        statement: 'Write a function to return the sum of all node values in a tree.',
        questionType: 'CODING',
        difficulty: 'EASY',
        subjectId: createdSubject._id,
        topicIds: [createdTopic._id],
        conceptTags: ['BST Insertion and Traversal'],
        evaluationConfig: {
          allowedLanguages: ['python', 'javascript'],
          defaultLanguage: 'python',
          testCases: [
            { input: '1 2 3', expectedOutput: '6', isHidden: false, weight: 1, description: 'Sample' },
            { input: '10 20 30 40', expectedOutput: '100', isHidden: true, weight: 4, description: 'Secret stress test' },
          ],
        },
        marks: 5,
        status: 'PUBLISHED',
      });
      // Publish it
      await questionManagementService.publishQuestion(publishedCodingQuestion.id, facultyA);
    });

    it('3.1 faculty serializer should expose answerKey, hidden test cases, and explanation', () => {
      const facultyView = serializeQuestionForFaculty(publishedCodingQuestion);
      assert.ok(facultyView.evaluationConfig.testCases.some((tc) => tc.isHidden === true));
    });

    it('3.2 student serializer should NEVER expose hidden test cases or answer keys', () => {
      const studentView = serializeQuestionForStudent(publishedCodingQuestion);
      assert.equal(studentView.answerKey, undefined);
      assert.equal(studentView.correctAnswer, undefined);

      const hasHidden = studentView.evaluationConfig.testCases.some((tc) => tc.isHidden === true);
      assert.equal(hasHidden, false);
      assert.equal(studentView.evaluationConfig.testCases.length, 1);
      assert.equal(studentView.evaluationConfig.testCases[0].expectedOutput, '6');
    });
  });

  describe('4. AI-Assisted Question Generation & Faculty Gate', () => {
    let genJob;

    it('4.1 should generate structured draft questions in PENDING_REVIEW status', async () => {
      genJob = await aiQuestionGenerationService.createGenerationJob(facultyA, {
        subjectId: createdSubject._id,
        topicId: createdTopic._id,
        questionType: 'SINGLE_MCQ',
        difficulty: 'MEDIUM',
        count: 3,
        learningObjective: 'Analyze tree balance',
      });

      assert.ok(genJob._id);
      assert.equal(genJob.status, 'COMPLETED');
      assert.equal(genJob.generatedQuestions.length, 3);
      assert.equal(genJob.generatedQuestions[0].reviewStatus, 'PENDING_REVIEW');
    });

    it('4.2 faculty approval gate should approve draft question and create Question in Question Bank', async () => {
      const firstDraftId = genJob.generatedQuestions[0]._id;
      const res = await aiQuestionGenerationService.approveGeneratedQuestion(
        genJob._id,
        firstDraftId,
        facultyA,
        { marks: 2 }
      );

      assert.ok(res.question);
      assert.equal(res.question.source, 'AI_GENERATED');
      assert.equal(res.question.marks, 2);

      const reloadedJob = await QuestionGenerationJob.findById(genJob._id);
      assert.equal(reloadedJob.approvedCount, 1);
      assert.equal(reloadedJob.generatedQuestions[0].reviewStatus, 'APPROVED');
    });

    it('4.3 faculty rejection gate should mark draft as REJECTED without creating bank item', async () => {
      const secondDraftId = genJob.generatedQuestions[1]._id;
      await aiQuestionGenerationService.rejectGeneratedQuestion(
        genJob._id,
        secondDraftId,
        facultyA,
        'Ambiguous phrasing'
      );

      const reloadedJob = await QuestionGenerationJob.findById(genJob._id);
      assert.equal(reloadedJob.rejectedCount, 1);
      assert.equal(reloadedJob.generatedQuestions[1].reviewStatus, 'REJECTED');
    });
  });

  describe('5. Bulk Question Import', () => {
    it('5.1 should parse JSON structured records into staging preview', async () => {
      const rawRecords = [
        {
          statement: 'Which data structure enforces FIFO order?',
          questionType: 'SINGLE_MCQ',
          difficulty: 'EASY',
          options: [
            { id: 'opt_1', text: 'Queue', isCorrect: true },
            { id: 'opt_2', text: 'Stack', isCorrect: false },
          ],
          answerKey: 'opt_1',
          marks: 1,
        },
        {
          statement: 'Stack uses LIFO order.',
          questionType: 'TRUE_FALSE',
          difficulty: 'EASY',
          answerKey: true,
          marks: 1,
        },
      ];

      const job = await questionBulkImportService.processImportUpload(facultyA, null, {
        jsonData: rawRecords,
        subjectId: createdSubject._id,
      });

      assert.ok(job._id);
      assert.equal(job.totalDetected, 2);
      assert.equal(job.extractedQuestions.length, 2);
      assert.equal(job.status, 'REVIEW_REQUIRED');
    });

    it('5.2 should commit valid staged questions into Question Bank drafts', async () => {
      const stagedJob = await QuestionImportJob.findOne({ instructorId: facultyA._id }).sort({ createdAt: -1 });
      const result = await questionBulkImportService.commitImportJob(stagedJob._id, facultyA, {
        subjectId: createdSubject._id,
      });

      assert.equal(result.committedCount, 2);
      assert.equal(result.questions.length, 2);
    });
  });

  describe('6. Mock Test Blueprint, Locked Snapshots & Concept Performance Analytics', () => {
    let mockTestDoc;
    let publishedQuestions = [];

    before(async () => {
      // Seed 4 published questions for the mock test
      for (let i = 1; i <= 4; i++) {
        const q = await questionManagementService.createQuestion(facultyA, {
          statement: `Mock Test Seed Question #${i}: What is property of Tree?`,
          questionType: 'SINGLE_MCQ',
          difficulty: i % 2 === 0 ? 'HARD' : 'EASY',
          subjectId: createdSubject._id,
          topicIds: [createdTopic._id],
          conceptTags: ['BST Insertion and Traversal'],
          options: [
            { id: 'opt_1', text: 'Correct Answer', isCorrect: true },
            { id: 'opt_2', text: 'Wrong Answer', isCorrect: false },
          ],
          answerKey: 'opt_1',
          marks: 2,
          negativeMarks: 0.66,
        });
        const pub = await questionManagementService.publishQuestion(q.id, facultyA);
        publishedQuestions.push(pub);
      }
    });

    it('6.1 should create Mock Test with blueprint rules and generate questions', async () => {
      mockTestDoc = await mockTestService.createMockTest(facultyA, {
        title: 'GATE 2026 CS Mock Test 1',
        examination: 'GATE',
        subjectId: createdSubject._id,
        topicIds: [createdTopic._id],
        durationMinutes: 45,
        negativeMarking: true,
        negativeMarkingRatio: 0.33,
        blueprint: {
          rules: [
            {
              subjectId: createdSubject._id,
              topicId: createdTopic._id,
              count: 3,
              marksPerQuestion: 2,
            },
          ],
        },
      });

      assert.ok(mockTestDoc._id);

      const generated = await mockTestService.generateFromBlueprint(mockTestDoc._id, facultyA);
      assert.ok(generated.resolvedQuestions.length >= 3);
      assert.ok(generated.resolvedQuestions[0].questionSnapshot);
    });

    it('6.2 should publish Mock Test and verify immutable version snapshots', async () => {
      mockTestDoc = await mockTestService.publishMockTest(mockTestDoc._id, facultyA);
      assert.equal(mockTestDoc.status, 'PUBLISHED');
      assert.ok(mockTestDoc.resolvedQuestions.length >= 3);
    });

    it('6.3 student should start attempt and receive sanitized questions without answer keys', async () => {
      const attemptData = await mockTestService.startAttempt(mockTestDoc._id, studentUser);
      assert.ok(attemptData.attemptId);
      assert.ok(attemptData.mockTest.questions.length >= 3);

      attemptData.mockTest.questions.forEach((q) => {
        assert.equal(q.questionSnapshot.answerKey, undefined);
        q.questionSnapshot.options?.forEach((opt) => {
          assert.equal(opt.isCorrect, undefined);
        });
      });
    });

    it('6.4 student should submit attempt and receive Concept-wise Analytics', async () => {
      const activeAttempt = await MockTestAttempt.findOne({
        mockTestId: mockTestDoc._id,
        studentId: studentUser._id,
      });

      // Submit responses: answer first 2 correct, 3rd incorrect
      const responses = mockTestDoc.resolvedQuestions.map((rq, idx) => {
        const correctOpt = rq.questionSnapshot.answerKey || rq.questionSnapshot.options?.find((o) => o.isCorrect)?.id || 'opt_1';
        const wrongOpt = rq.questionSnapshot.options?.find((o) => o.id !== correctOpt)?.id || 'opt_2';
        return {
          questionId: rq.questionId,
          selectedOption: idx < 2 ? correctOpt : wrongOpt,
          code: idx < 2 ? 'def solve(): return 6' : '',
          sqlQuery: idx < 2 ? 'SELECT 1' : '',
        };
      });

      const evalResult = await mockTestService.submitAttempt(activeAttempt._id, studentUser, {
        responses,
      });

      assert.equal(evalResult.correctCount, 2);
      assert.ok(evalResult.incorrectCount >= 1);
      assert.ok(evalResult.score > 0);

      // Verify Concept-wise analytics with confidence ratings
      assert.ok(Array.isArray(evalResult.conceptWiseAnalytics));
      assert.ok(evalResult.conceptWiseAnalytics.length > 0);
      assert.ok(evalResult.conceptWiseAnalytics[0].concept);
      assert.ok(evalResult.conceptWiseAnalytics[0].confidenceScore);

      // Verify Difficulty-wise analytics
      assert.ok(evalResult.difficultyWiseAnalytics.easy || evalResult.difficultyWiseAnalytics.medium);
    });
  });

  describe('7. Question Bank Groupings', () => {
    it('7.1 should create QuestionBank group and add questions', async () => {
      const bank = await questionBankGroupService.createBank(facultyA, {
        title: 'GATE CS 2026 Core Questions Pool',
        code: `QB-GATE-${Date.now().toString(36).toUpperCase()}`,
        subjectId: createdSubject._id,
        description: 'Curated pool of high-yield questions',
      });

      assert.ok(bank._id);

      const anyQuestions = await Question.find({ subjectId: createdSubject._id }).limit(3);
      const qIds = anyQuestions.map((q) => q._id);

      const updatedBank = await questionBankGroupService.addQuestionsToBank(bank._id, qIds, facultyA);
      assert.equal(updatedBank.questionCount, qIds.length);
    });
  });
});
