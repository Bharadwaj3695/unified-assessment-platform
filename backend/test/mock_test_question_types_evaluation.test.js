const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../src/config/db');
const {
  User,
  Subject,
  Topic,
  Question,
  MockTest,
  MockTestAttempt,
} = require('../src/models');
const mockTestService = require('../src/services/mockTest.service');
const storageService = require('../src/services/storage.service');

describe('Mock Test Question-Type Evaluation Engine (Phase 2)', () => {
  let facultyUser;
  let unauthorizedFacultyUser;
  let adminUser;
  let studentUser;
  let otherStudentUser;
  let testSubject;
  let testTopic;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    facultyUser = await User.create({
      name: 'Dr. Jane Author',
      email: `author_faculty_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
    });

    unauthorizedFacultyUser = await User.create({
      name: 'Prof. Other Faculty',
      email: `other_faculty_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'instructor',
      isVerified: true,
      approvalStatus: 'approved',
    });

    adminUser = await User.create({
      name: 'System Administrator',
      email: `admin_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'admin',
      isVerified: true,
      approvalStatus: 'approved',
    });

    studentUser = await User.create({
      name: 'Candidate Student',
      email: `candidate_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'student',
      isVerified: true,
    });

    otherStudentUser = await User.create({
      name: 'Intruder Student',
      email: `intruder_${Date.now()}@uap.edu`,
      password: 'Password123!',
      role: 'student',
      isVerified: true,
    });

    testSubject = await Subject.create({
      name: 'Computer Science & Engineering',
      code: `CS-${Date.now()}`,
    });

    testTopic = await Topic.create({
      name: 'Algorithms & Discrete Math',
      code: `ADM-${Date.now()}`,
      subjectId: testSubject._id,
      conceptTags: ['Logic', 'Graphs', 'Sets', 'Recursion'],
    });
  });

  after(async () => {
    await disconnectDB();
  });

  async function createMockTestWithQuestions(questionsConfig, testOverrides = {}) {
    const resolvedQuestions = [];
    let totalMarks = 0;

    for (let i = 0; i < questionsConfig.length; i++) {
      const qc = questionsConfig[i];
      const qDoc = await Question.create({
        statement: qc.statement || `Question ${i + 1}`,
        questionType: qc.questionType || 'SINGLE_MCQ',
        marks: qc.marks !== undefined ? qc.marks : 2,
        negativeMarks: qc.negativeMarks !== undefined ? qc.negativeMarks : 0.5,
        options: qc.options || [],
        answerKey: qc.answerKey !== undefined ? qc.answerKey : null,
        correctAnswer: qc.correctAnswer !== undefined ? qc.correctAnswer : null,
        evaluationConfig: qc.evaluationConfig || {},
        fileUploadConfig: qc.fileUploadConfig || { allowedFileTypes: ['pdf', 'doc', 'docx'], maxFileSizeMb: 10 },
        subjectId: testSubject._id,
        topicIds: [testTopic._id],
        status: 'PUBLISHED',
        ownerFacultyId: testOverrides.ownerFacultyId || facultyUser._id,
      });

      const qMarks = typeof qc.marks === 'number' ? qc.marks : 2;
      const qNeg = typeof qc.negativeMarks === 'number' ? qc.negativeMarks : 0.5;
      totalMarks += qMarks;

      resolvedQuestions.push({
        questionId: qDoc._id,
        versionNumber: 1,
        questionSnapshot: qDoc.toObject(),
        marks: qMarks,
        negativeMarks: qNeg,
        orderIndex: i + 1,
      });
    }

    const test = await MockTest.create({
      title: testOverrides.title || `Mock Test ${Date.now()}`,
      examination: 'GATE',
      subjectId: testSubject._id,
      topicIds: [testTopic._id],
      durationMinutes: 60,
      totalMarks,
      questionCount: questionsConfig.length,
      negativeMarking: testOverrides.negativeMarking !== undefined ? testOverrides.negativeMarking : true,
      negativeMarkingRatio: 0.25,
      resolvedQuestions,
      status: 'PUBLISHED',
      ownerFacultyId: testOverrides.ownerFacultyId || facultyUser._id,
    });

    return test;
  }

  // =========================================================================
  // 1. SINGLE_MCQ Evaluation
  // =========================================================================
  describe('SINGLE_MCQ Evaluation', () => {
    it('1. Correct option selection awards full marks and marks isCorrect true', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SINGLE_MCQ',
          marks: 4,
          negativeMarks: 1,
          options: [
            { id: 'opt_a', text: 'Option A', isCorrect: false },
            { id: 'opt_b', text: 'Option B', isCorrect: true },
          ],
          answerKey: 'opt_b',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'opt_b' }],
      });

      assert.strictEqual(res.score, 4);
      assert.strictEqual(res.autoScore, 4);
      assert.strictEqual(res.status, 'EVALUATED');
      assert.strictEqual(res.evaluationStatus, 'COMPLETED');
      assert.strictEqual(res.correctCount, 1);
    });

    it('2. Incorrect option selection deducts negative marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SINGLE_MCQ',
          marks: 4,
          negativeMarks: 1,
          options: [
            { id: 'opt_a', text: 'Option A', isCorrect: false },
            { id: 'opt_b', text: 'Option B', isCorrect: true },
          ],
          answerKey: 'opt_b',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'opt_a' }],
      });

      assert.strictEqual(res.score, 0); // Floored at 0
      assert.strictEqual(res.status, 'EVALUATED');
      assert.strictEqual(res.incorrectCount, 1);

      const savedAttempt = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(savedAttempt.responses[0].scoreAwarded, -1);
      assert.strictEqual(savedAttempt.responses[0].negativeMarksAwarded, 1);
      assert.strictEqual(savedAttempt.responses[0].isCorrect, false);
    });

    it('3. Non-existent invalid option ID is rejected and penalized', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SINGLE_MCQ',
          marks: 3,
          negativeMarks: 1,
          options: [
            { id: 'opt_1', text: 'Choice 1', isCorrect: true },
            { id: 'opt_2', text: 'Choice 2', isCorrect: false },
          ],
          answerKey: 'opt_1',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'opt_bogus_id' }],
      });

      const savedAttempt = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(savedAttempt.responses[0].isCorrect, false);
      assert.strictEqual(savedAttempt.responses[0].scoreAwarded, -1);
      assert.strictEqual(savedAttempt.responses[0].feedback, 'Invalid option selection.');
    });

    it('4. Feedback never leaks the authoritative answer key or correct option ID', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SINGLE_MCQ',
          marks: 2,
          options: [
            { id: 'opt_secret_x', text: 'Correct Answer', isCorrect: true },
            { id: 'opt_wrong_y', text: 'Wrong Answer', isCorrect: false },
          ],
          answerKey: 'opt_secret_x',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'opt_wrong_y' }],
      });

      const analytics = await mockTestService.getAttemptAnalytics(attempt.attemptId, studentUser);
      const resp = analytics.responses[0];
      assert.strictEqual(resp.feedback.includes('opt_secret_x'), false);
      assert.strictEqual(resp.feedback.includes('Correct Answer'), false);
      assert.strictEqual(resp.feedback, 'Incorrect answer.');
    });

    it('5. Unanswered SINGLE_MCQ receives 0 marks and 0 negative marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SINGLE_MCQ',
          marks: 5,
          negativeMarks: 2,
          options: [{ id: 'opt_1', text: '1', isCorrect: true }],
          answerKey: 'opt_1',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [],
      });

      assert.strictEqual(res.score, 0);
      assert.strictEqual(res.unansweredCount, 1);
      const savedAttempt = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(savedAttempt.responses[0].negativeMarksAwarded, 0);
      assert.strictEqual(savedAttempt.responses[0].scoreAwarded, 0);
    });
  });

  // =========================================================================
  // 2. MULTI_SELECT Evaluation
  // =========================================================================
  describe('MULTI_SELECT Evaluation', () => {
    it('6. ALL_OR_NOTHING: Exact match of multiple correct options awards full marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 6,
          negativeMarks: 2,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
            { id: 'c', text: 'C', isCorrect: false },
          ],
          answerKey: ['a', 'b'],
          evaluationConfig: { partialCreditPolicy: 'ALL_OR_NOTHING' },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a', 'b'] }],
      });

      assert.strictEqual(res.score, 6);
      assert.strictEqual(res.correctCount, 1);
      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].isCorrect, true);
    });

    it('7. ALL_OR_NOTHING: Incomplete selection awards 0 and deducts negative marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 4,
          negativeMarks: 1,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
          ],
          answerKey: ['a', 'b'],
          evaluationConfig: { partialCreditPolicy: 'ALL_OR_NOTHING' },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a'] }],
      });

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].isCorrect, false);
      assert.strictEqual(saved.responses[0].scoreAwarded, -1);
      assert.strictEqual(saved.responses[0].negativeMarksAwarded, 1);
    });

    it('8. PROPORTIONAL_NO_PENALTY: Partial correct selection with NO wrong choices awards proportional marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 10,
          negativeMarks: 2,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
            { id: 'c', text: 'C', isCorrect: false },
          ],
          answerKey: ['a', 'b'],
          evaluationConfig: { partialCreditPolicy: 'PROPORTIONAL_NO_PENALTY' },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a'] }],
      });

      assert.strictEqual(res.score, 5); // 1/2 of 10 marks
      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, 5);
      assert.strictEqual(saved.responses[0].negativeMarksAwarded, 0);
      assert.strictEqual(saved.responses[0].isCorrect, false);
    });

    it('9. PROPORTIONAL_NO_PENALTY: Including an incorrect choice awards 0 and penalizes', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 10,
          negativeMarks: 2,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
            { id: 'c', text: 'C', isCorrect: false },
          ],
          answerKey: ['a', 'b'],
          evaluationConfig: { partialCreditPolicy: 'PROPORTIONAL_NO_PENALTY' },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a', 'c'] }],
      });

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, -2);
      assert.strictEqual(saved.responses[0].negativeMarksAwarded, 2);
    });

    it('10. PROPORTIONAL_WITH_PENALTY: Correct choices minus incorrect choices awards net credit', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 12,
          negativeMarks: 3,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
            { id: 'c', text: 'C', isCorrect: true },
            { id: 'd', text: 'D', isCorrect: false },
          ],
          answerKey: ['a', 'b', 'c'],
          evaluationConfig: { partialCreditPolicy: 'PROPORTIONAL_WITH_PENALTY' },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Student selects 2 correct (a, b) out of 3 = 2/3 credit (8 marks)
      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a', 'b'] }],
      });

      assert.strictEqual(res.score, 8);
      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, 8);
    });

    it('11. Invalid option IDs not in question are rejected as incorrect', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 4,
          negativeMarks: 1,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: false },
          ],
          answerKey: ['a'],
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a', 'xyz_invalid'] }],
      });

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, -1);
      assert.strictEqual(saved.responses[0].feedback, 'Invalid option selection.');
    });

    it('12. Duplicate submitted option IDs are safely deduplicated', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'MULTI_SELECT',
          marks: 4,
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: true },
          ],
          answerKey: ['a', 'b'],
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOptions: ['a', 'a', 'b', 'b'] }],
      });

      assert.strictEqual(res.score, 4);
      assert.strictEqual(res.correctCount, 1);
    });
  });

  // =========================================================================
  // 3. TRUE_FALSE Evaluation
  // =========================================================================
  describe('TRUE_FALSE Evaluation', () => {
    it('13. Boolean primitive true/false match awards full marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'TRUE_FALSE',
          marks: 2,
          answerKey: true,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'true' }],
      });

      assert.strictEqual(res.score, 2);
      assert.strictEqual(res.correctCount, 1);
    });

    it('14. String boolean representations normalize correctly', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'TRUE_FALSE',
          marks: 3,
          negativeMarks: 1,
          answerKey: false,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'False' }],
      });

      assert.strictEqual(res.score, 3);
      assert.strictEqual(res.correctCount, 1);
    });

    it('15. Non-boolean string (e.g. "maybe") is rejected as invalid representation', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'TRUE_FALSE',
          marks: 2,
          negativeMarks: 1,
          answerKey: true,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'maybe' }],
      });

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, -1);
      assert.strictEqual(saved.responses[0].feedback, 'Invalid boolean response.');
    });

    it('16. Option ID binding (opt_true / opt_false) maps to boolean and scores correctly', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'TRUE_FALSE',
          marks: 2,
          options: [
            { id: 'opt_t', text: 'True', isCorrect: true },
            { id: 'opt_f', text: 'False', isCorrect: false },
          ],
          answerKey: 'opt_t',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, selectedOption: 'opt_t' }],
      });

      assert.strictEqual(res.score, 2);
      assert.strictEqual(res.correctCount, 1);
    });
  });

  // =========================================================================
  // 4. FILL_BLANK Evaluation
  // =========================================================================
  describe('FILL_BLANK Evaluation', () => {
    it('17. Matches any configured accepted answer in array', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILL_BLANK',
          marks: 3,
          evaluationConfig: { acceptedAnswers: ['O(n log n)', 'O(nlogn)', 'linearithmic'] },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'linearithmic' }],
      });

      assert.strictEqual(res.score, 3);
      assert.strictEqual(res.correctCount, 1);
    });

    it('18. Whitespace normalization matches internal multiple spaces and trim', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILL_BLANK',
          marks: 2,
          answerKey: 'Binary Search Tree',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: '   binary   search   tree   ' }],
      });

      assert.strictEqual(res.score, 2);
      assert.strictEqual(res.correctCount, 1);
    });

    it('19. Case sensitivity setting enforces exact case matching', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILL_BLANK',
          marks: 4,
          negativeMarks: 1,
          answerKey: 'Eulerian',
          evaluationConfig: { caseSensitive: true },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Lowercase attempt should fail because caseSensitive is true
      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'eulerian' }],
      });

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, -1);
      assert.strictEqual(saved.responses[0].isCorrect, false);
    });

    it('20. Submission feedback never exposes the accepted answers', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILL_BLANK',
          marks: 2,
          answerKey: 'SecretAnswer42',
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'WrongGuess' }],
      });

      const analytics = await mockTestService.getAttemptAnalytics(attempt.attemptId, studentUser);
      const feedback = analytics.responses[0].feedback;
      assert.strictEqual(feedback.includes('SecretAnswer42'), false);
      assert.strictEqual(feedback, 'Incorrect answer.');
    });
  });

  // =========================================================================
  // 5. SHORT_ANSWER Evaluation
  // =========================================================================
  describe('SHORT_ANSWER Evaluation', () => {
    it('21. Rule-based SHORT_ANSWER with configured accepted answers evaluates automatically', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SHORT_ANSWER',
          marks: 5,
          evaluationConfig: { acceptedAnswers: ['Dynamic Programming', 'DP'] },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'dp' }],
      });

      assert.strictEqual(res.score, 5);
      assert.strictEqual(res.status, 'EVALUATED');
      assert.strictEqual(res.evaluationStatus, 'COMPLETED');
    });

    it('22. Subjective SHORT_ANSWER routes to PENDING_MANUAL_REVIEW with 0 negative marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SHORT_ANSWER',
          marks: 5,
          negativeMarks: 2,
          evaluationConfig: { requiresManualReview: true },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'Heuristic analysis is required.' }],
      });

      assert.strictEqual(res.status, 'SUBMITTED');
      assert.strictEqual(res.evaluationStatus, 'PENDING_MANUAL_REVIEW');
      assert.strictEqual(res.score, 0);

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].scoreAwarded, 0);
      assert.strictEqual(saved.responses[0].negativeMarksAwarded, 0);
      assert.strictEqual(saved.responses[0].evaluationStatus, 'PENDING_MANUAL_REVIEW');
    });
  });

  // =========================================================================
  // 6. DESCRIPTIVE Evaluation & Rubric Support
  // =========================================================================
  describe('DESCRIPTIVE Evaluation & Rubrics', () => {
    it('23. Descriptive answer routes to PENDING_MANUAL_REVIEW and bypasses negative marks', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'DESCRIPTIVE',
          marks: 10,
          negativeMarks: 3,
          evaluationConfig: {
            rubric: [
              { criterion: 'Algorithm Correctness', maxMarks: 6 },
              { criterion: 'Time Complexity Justification', maxMarks: 4 },
            ],
          },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const res = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [
          {
            questionId: qId,
            textAnswer: 'We apply Dijkstra algorithm using a Fibonacci heap for O(V log V + E) bound.',
          },
        ],
      });

      assert.strictEqual(res.status, 'SUBMITTED');
      assert.strictEqual(res.evaluationStatus, 'PENDING_MANUAL_REVIEW');
      assert.strictEqual(res.score, 0);

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].negativeMarksAwarded, 0);
      assert.strictEqual(saved.responses[0].evaluationStatus, 'PENDING_MANUAL_REVIEW');
      assert.strictEqual(saved.responses[0].rubricScores.length, 2);
    });

    it('24. Rubric criteria from question config are preserved on attempt responses', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'DESCRIPTIVE',
          marks: 8,
          evaluationConfig: {
            rubric: [
              { criterion: 'Clarity of Proof', maxMarks: 4 },
              { criterion: 'Base Case Handling', maxMarks: 4 },
            ],
          },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'Proof by induction.' }],
      });

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      const rubrics = saved.responses[0].rubricScores;
      assert.strictEqual(rubrics[0].criterion, 'Clarity of Proof');
      assert.strictEqual(rubrics[0].maxMarks, 4);
      assert.strictEqual(rubrics[1].criterion, 'Base Case Handling');
    });
  });

  // =========================================================================
  // 7. FILE_UPLOAD & Security Validation
  // =========================================================================
  describe('FILE_UPLOAD Security & Storage', () => {
    it('25. Valid PDF document upload during active attempt saves securely', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
          fileUploadConfig: { allowedFileTypes: ['pdf'], maxFileSizeMb: 5 },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const pdfBuffer = Buffer.from('%PDF-1.4\n%Valid test PDF stream\n%%EOF');
      const uploadRes = await mockTestService.uploadAttemptFile(
        attempt.attemptId,
        qId,
        studentUser,
        {
          buffer: pdfBuffer,
          originalname: 'diagram_solution.pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        }
      );

      assert.strictEqual(uploadRes.message, 'File uploaded successfully');
      assert.ok(uploadRes.fileAnswer.fileKey);

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(saved.responses[0].fileAnswer.originalFilename, 'diagram_solution.pdf');
    });

    it('26. Valid DOCX document upload verifies ZIP/DOCX file signature', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
          fileUploadConfig: { allowedFileTypes: ['docx'], maxFileSizeMb: 5 },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Valid PK zip signature: 0x50, 0x4B, 0x03, 0x04
      const docxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const uploadRes = await mockTestService.uploadAttemptFile(
        attempt.attemptId,
        qId,
        studentUser,
        {
          buffer: docxBuffer,
          originalname: 'project_report.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: docxBuffer.length,
        }
      );

      assert.strictEqual(uploadRes.message, 'File uploaded successfully');
      assert.ok(uploadRes.fileAnswer.fileKey);
    });

    it('27. Mismatched file signature (executable disguised as PDF) is rejected', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
          fileUploadConfig: { allowedFileTypes: ['pdf'], maxFileSizeMb: 5 },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Executable header: MZ (0x4D, 0x5A) named as PDF
      const fakePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00fake executable disguised');

      await assert.rejects(
        async () => {
          await mockTestService.uploadAttemptFile(
            attempt.attemptId,
            qId,
            studentUser,
            {
              buffer: fakePdfBuffer,
              originalname: 'malicious.pdf',
              mimetype: 'application/pdf',
              size: fakePdfBuffer.length,
            }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('File signature does not match PDF format'));
          return true;
        }
      );
    });

    it('28. Executable file extension (.sh) is strictly rejected', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
          fileUploadConfig: { allowedFileTypes: ['pdf'], maxFileSizeMb: 5 },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const shellBuffer = Buffer.from('#!/bin/bash\nrm -rf /');

      await assert.rejects(
        async () => {
          await mockTestService.uploadAttemptFile(
            attempt.attemptId,
            qId,
            studentUser,
            {
              buffer: shellBuffer,
              originalname: 'exploit.sh',
              mimetype: 'application/x-sh',
              size: shellBuffer.length,
            }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('forbidden'));
          return true;
        }
      );
    });

    it('29. File exceeding maxFileSizeMb is rejected with HTTP 413', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
          fileUploadConfig: { allowedFileTypes: ['pdf'], maxFileSizeMb: 1 },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const oversizedBuffer = Buffer.alloc(2 * 1024 * 1024, '%PDF-1.4 large file content');

      await assert.rejects(
        async () => {
          await mockTestService.uploadAttemptFile(
            attempt.attemptId,
            qId,
            studentUser,
            {
              buffer: oversizedBuffer,
              originalname: 'oversized.pdf',
              mimetype: 'application/pdf',
              size: oversizedBuffer.length,
            }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 413);
          assert.ok(err.message.includes('exceeds maximum allowed size'));
          return true;
        }
      );
    });

    it('30. Student cannot upload a file to another student attempt (HTTP 403)', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const pdfBuffer = Buffer.from('%PDF-1.4\n%...\n%%EOF');

      await assert.rejects(
        async () => {
          await mockTestService.uploadAttemptFile(
            attempt.attemptId,
            qId,
            otherStudentUser, // Intruder
            {
              buffer: pdfBuffer,
              originalname: 'hacked.pdf',
              mimetype: 'application/pdf',
              size: pdfBuffer.length,
            }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.ok(err.message.includes('Access denied'));
          return true;
        }
      );
    });

    it('31. File upload cannot be performed on an attempt that is already SUBMITTED', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      // Submit attempt first
      await mockTestService.submitAttempt(attempt.attemptId, studentUser, { responses: [] });

      const pdfBuffer = Buffer.from('%PDF-1.4\n%...\n%%EOF');

      await assert.rejects(
        async () => {
          await mockTestService.uploadAttemptFile(
            attempt.attemptId,
            qId,
            studentUser,
            {
              buffer: pdfBuffer,
              originalname: 'late.pdf',
              mimetype: 'application/pdf',
              size: pdfBuffer.length,
            }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('already been submitted'));
          return true;
        }
      );
    });

    it('32. Submitted attempt containing FILE_UPLOAD transitions to SUBMITTED and PENDING_MANUAL_REVIEW', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'FILE_UPLOAD',
          marks: 15,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      const pdfBuffer = Buffer.from('%PDF-1.4\n%...\n%%EOF');
      await mockTestService.uploadAttemptFile(
        attempt.attemptId,
        qId,
        studentUser,
        {
          buffer: pdfBuffer,
          originalname: 'my_submission.pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        }
      );

      const submitRes = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [],
      });

      assert.strictEqual(submitRes.status, 'SUBMITTED');
      assert.strictEqual(submitRes.evaluationStatus, 'PENDING_MANUAL_REVIEW');
      assert.strictEqual(submitRes.score, 0);

      const saved = await MockTestAttempt.findById(attempt.attemptId);
      assert.ok(saved.responses[0].fileAnswer.fileKey);
      assert.strictEqual(saved.responses[0].evaluationStatus, 'PENDING_MANUAL_REVIEW');
    });
  });

  // =========================================================================
  // 8. Faculty Manual Evaluation & Attempt Finalization
  // =========================================================================
  describe('Faculty Manual Evaluation & Attempt Finalization', () => {
    it('33. Authorized faculty evaluates subjective questions and finalizes attempt to EVALUATED', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'DESCRIPTIVE',
          marks: 10,
          evaluationConfig: {
            rubric: [{ criterion: 'Depth of analysis', maxMarks: 10 }],
          },
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'Comprehensive analysis.' }],
      });

      const evalRes = await mockTestService.evaluateAttempt(attempt.attemptId, facultyUser, {
        generalFeedback: 'Well structured and rigorous solution.',
        responsesFeedback: [
          {
            questionId: qId,
            marksAwarded: 9,
            comment: 'Excellent argumentation.',
            rubricScores: [{ criterion: 'Depth of analysis', score: 9, maxMarks: 10 }],
          },
        ],
      });

      assert.strictEqual(evalRes.status, 'EVALUATED');
      assert.strictEqual(evalRes.evaluationStatus, 'COMPLETED');
      assert.strictEqual(evalRes.manualScore, 9);
      assert.strictEqual(evalRes.score, 9);

      const finalSaved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(finalSaved.status, 'EVALUATED');
      assert.strictEqual(finalSaved.evaluationStatus, 'COMPLETED');
      assert.strictEqual(finalSaved.evaluatorId.toString(), facultyUser._id.toString());
      assert.ok(finalSaved.gradedAt);
      assert.strictEqual(finalSaved.responses[0].evaluationStatus, 'MANUALLY_EVALUATED');
      assert.strictEqual(finalSaved.responses[0].scoreAwarded, 9);
      assert.strictEqual(finalSaved.responses[0].rubricScores[0].score, 9);
    });

    it('34. Unauthorized faculty or non-owner instructor is rejected with HTTP 403', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'DESCRIPTIVE',
          marks: 10,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'Essay text.' }],
      });

      await assert.rejects(
        async () => {
          await mockTestService.evaluateAttempt(attempt.attemptId, unauthorizedFacultyUser, {
            responsesFeedback: [{ questionId: qId, marksAwarded: 8 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.ok(err.message.includes('not authorized to evaluate'));
          return true;
        }
      );
    });

    it('35. Marks awarded cannot exceed maxMarks for any question (HTTP 400)', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'DESCRIPTIVE',
          marks: 5,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'Short essay.' }],
      });

      await assert.rejects(
        async () => {
          await mockTestService.evaluateAttempt(attempt.attemptId, facultyUser, {
            responsesFeedback: [{ questionId: qId, marksAwarded: 10 }], // Exceeds 5
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('cannot exceed maximum marks'));
          return true;
        }
      );
    });

    it('36. Missing evaluation for any pending question blocks finalization (HTTP 400)', async () => {
      const mockTest = await createMockTestWithQuestions([
        { questionType: 'DESCRIPTIVE', marks: 5 },
        { questionType: 'DESCRIPTIVE', marks: 5 },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId1 = mockTest.resolvedQuestions[0].questionId;
      const qId2 = mockTest.resolvedQuestions[1].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [
          { questionId: qId1, textAnswer: 'Answer 1' },
          { questionId: qId2, textAnswer: 'Answer 2' },
        ],
      });

      // Submit grade for only question 1, leaving question 2 ungraded
      await assert.rejects(
        async () => {
          await mockTestService.evaluateAttempt(attempt.attemptId, facultyUser, {
            responsesFeedback: [{ questionId: qId1, marksAwarded: 4 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('All pending questions must be evaluated'));
          return true;
        }
      );
    });

    it('37. Duplicate evaluation or evaluating an already completed attempt is rejected (Atomic CAS lock)', async () => {
      const mockTest = await createMockTestWithQuestions([
        { questionType: 'DESCRIPTIVE', marks: 5 },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qId = mockTest.resolvedQuestions[0].questionId;

      await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [{ questionId: qId, textAnswer: 'Answer' }],
      });

      // First evaluation succeeds
      await mockTestService.evaluateAttempt(attempt.attemptId, facultyUser, {
        responsesFeedback: [{ questionId: qId, marksAwarded: 4 }],
      });

      // Second evaluation must be rejected
      await assert.rejects(
        async () => {
          await mockTestService.evaluateAttempt(attempt.attemptId, facultyUser, {
            responsesFeedback: [{ questionId: qId, marksAwarded: 5 }],
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('already been evaluated'));
          return true;
        }
      );
    });

    it('38. Mixed attempt (objective + descriptive + file) calculates autoScore and manualScore cleanly', async () => {
      const mockTest = await createMockTestWithQuestions([
        {
          questionType: 'SINGLE_MCQ',
          marks: 4,
          negativeMarks: 1,
          options: [
            { id: 'opt_1', text: 'Correct Opt', isCorrect: true },
            { id: 'opt_2', text: 'Wrong Opt', isCorrect: false },
          ],
          answerKey: 'opt_1',
        },
        {
          questionType: 'DESCRIPTIVE',
          marks: 6,
        },
        {
          questionType: 'FILE_UPLOAD',
          marks: 10,
        },
      ]);

      const attempt = await mockTestService.startAttempt(mockTest._id, studentUser);
      const qMcq = mockTest.resolvedQuestions[0].questionId;
      const qDesc = mockTest.resolvedQuestions[1].questionId;
      const qFile = mockTest.resolvedQuestions[2].questionId;

      // 1. Upload file
      const pdfBuffer = Buffer.from('%PDF-1.4\n%...\n%%EOF');
      await mockTestService.uploadAttemptFile(attempt.attemptId, qFile, studentUser, {
        buffer: pdfBuffer,
        originalname: 'solution.pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      });

      // 2. Submit attempt with correct MCQ and descriptive text
      const submitRes = await mockTestService.submitAttempt(attempt.attemptId, studentUser, {
        responses: [
          { questionId: qMcq, selectedOption: 'opt_1' },
          { questionId: qDesc, textAnswer: 'Descriptive text answer.' },
        ],
      });

      assert.strictEqual(submitRes.status, 'SUBMITTED');
      assert.strictEqual(submitRes.evaluationStatus, 'PENDING_MANUAL_REVIEW');
      assert.strictEqual(submitRes.autoScore, 4);
      assert.strictEqual(submitRes.manualScore, 0);
      assert.strictEqual(submitRes.score, 4); // Only autoScore counted so far

      // 3. Faculty evaluates descriptive (5/6) and file upload (8/10)
      const evalRes = await mockTestService.evaluateAttempt(attempt.attemptId, facultyUser, {
        generalFeedback: 'Good overall performance.',
        responsesFeedback: [
          { questionId: qDesc, marksAwarded: 5, comment: 'Good explanation.' },
          { questionId: qFile, marksAwarded: 8, comment: 'Correct architectural diagram.' },
        ],
      });

      assert.strictEqual(evalRes.status, 'EVALUATED');
      assert.strictEqual(evalRes.evaluationStatus, 'COMPLETED');
      assert.strictEqual(evalRes.autoScore, 4);
      assert.strictEqual(evalRes.manualScore, 13); // 5 + 8
      assert.strictEqual(evalRes.score, 17); // 4 + 13 = 17 out of 20
      assert.strictEqual(evalRes.percentage, 85);

      const finalSaved = await MockTestAttempt.findById(attempt.attemptId);
      assert.strictEqual(finalSaved.status, 'EVALUATED');
      assert.strictEqual(finalSaved.earnedMarks, 17);
      assert.strictEqual(finalSaved.autoScore, 4);
      assert.strictEqual(finalSaved.manualScore, 13);
    });
  });
});
