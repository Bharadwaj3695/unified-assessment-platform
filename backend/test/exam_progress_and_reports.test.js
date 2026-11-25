const test = require('node:test');
const assert = require('node:assert/strict');
const { connectDB, disconnectDB } = require('../src/config/db');
const {
  User,
  Subject,
  Assessment,
  Question,
  Submission,
  Evaluation,
  MockTest,
  MockTestAttempt,
} = require('../src/models');
const examReportService = require('../src/services/examReport.service');
const aiPredictorService = require('../src/services/aiPredictor.service');
const pdfGenerator = require('../src/utils/pdfGenerator');

test('UAP Exam-Wise Progress, Individual Performance Reports, PDF & AI Predictor Suite', async (t) => {
  let studentA;
  let studentB;
  let facultyOwner;
  let facultyOther;
  let subject;
  let evaluatedAssessment;
  let pendingAssessment;
  let evaluatedSubmission;
  let pendingSubmission;
  let inProgressSubmission;
  let mockTest;
  let evaluatedMockAttempt;
  let pendingMockAttempt;

  t.before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await Promise.all([
      User.deleteMany({}),
      Subject.deleteMany({}),
      Assessment.deleteMany({}),
      Question.deleteMany({}),
      Submission.deleteMany({}),
      Evaluation.deleteMany({}),
      MockTest.deleteMany({}),
      MockTestAttempt.deleteMany({}),
    ]);

    facultyOwner = await User.create({
      name: 'Prof. Elena Vance',
      email: 'elena.vance@university.edu',
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      department: 'Computer Science',
    });

    facultyOther = await User.create({
      name: 'Prof. Marcus Cole',
      email: 'marcus.cole@university.edu',
      password: 'Password@123',
      role: 'instructor',
      status: 'active',
      department: 'Mathematics',
    });

    studentA = await User.create({
      name: 'Aarav Mehta',
      email: 'aarav.mehta@university.edu',
      password: 'Password@123',
      role: 'student',
      status: 'active',
      studentId: 'STU-2026-001',
      department: 'Computer Science',
    });

    studentB = await User.create({
      name: 'Priya Nair',
      email: 'priya.nair@university.edu',
      password: 'Password@123',
      role: 'student',
      status: 'active',
      studentId: 'STU-2026-002',
      department: 'Computer Science',
    });

    subject = await Subject.create({
      name: 'Operating Systems',
      code: 'CS401',
      department: 'Computer Science',
      createdBy: facultyOwner._id,
    });

    evaluatedAssessment = await Assessment.create({
      title: 'Distributed Systems Midterm',
      category: 'Systems Engineering',
      instructorId: facultyOwner._id,
      totalPoints: 20,
      passingScore: 60,
      status: 'published',
    });

    const q1 = await Question.create({
      assessmentId: evaluatedAssessment._id,
      type: 'mcq',
      questionText: 'Which consensus protocol uses leader leases and log replication?',
      options: [
        { id: 'opt_1', text: 'Raft' },
        { id: 'opt_2', text: 'ARP' },
      ],
      correctAnswer: 'opt_1',
      points: 10,
      topics: ['Consensus'],
      orderIndex: 0,
    });

    const q2 = await Question.create({
      assessmentId: evaluatedAssessment._id,
      type: 'short_answer',
      questionText: 'Explain the CAP theorem trade-off during network partitions.',
      points: 10,
      topics: ['CAP Theorem'],
      orderIndex: 1,
    });

    evaluatedSubmission = await Submission.create({
      assessmentId: evaluatedAssessment._id,
      studentId: studentA._id,
      answers: {
        [q1._id.toString()]: 'opt_1',
        [q2._id.toString()]: 'Consistency or availability must be chosen under partition.',
      },
      autoScore: 10,
      manualScore: 6,
      score: 16,
      finalScore: 16,
      totalPoints: 20,
      percentage: 80,
      passed: true,
      status: 'evaluated',
      resultStatus: 'passed',
      evaluationStatus: 'completed',
      submittedAt: new Date(Date.now() - 3600000),
      feedback: 'Solid consensus answer; deepen CAP discussion.',
    });

    await Evaluation.create({
      submissionId: evaluatedSubmission._id,
      evaluatorId: facultyOwner._id,
      questionFeedback: {
        [q1._id.toString()]: { pointsAwarded: 10, comment: 'Accurate' },
        [q2._id.toString()]: { pointsAwarded: 6, comment: 'Mention PACELC for full credit.' },
      },
      generalFeedback: 'Strong overall grasp of distributed systems fundamentals.',
      finalScore: 16,
      percentage: 80,
      grade: 'A',
      gradeLabel: 'Very Good',
      passed: true,
      status: 'completed',
      gradedAt: new Date(),
    });

    pendingAssessment = await Assessment.create({
      title: 'Compiler Design Final',
      category: 'Systems Engineering',
      instructorId: facultyOwner._id,
      totalPoints: 50,
      passingScore: 60,
      status: 'published',
    });

    pendingSubmission = await Submission.create({
      assessmentId: pendingAssessment._id,
      studentId: studentA._id,
      status: 'submitted',
      evaluationStatus: 'pending',
      resultStatus: 'pending_evaluation',
      totalPoints: 50,
      submittedAt: new Date(),
    });

    const inProgressAsmt = await Assessment.create({
      title: 'Cloud Architecture Quiz',
      category: 'Cloud Computing',
      instructorId: facultyOwner._id,
      totalPoints: 30,
      passingScore: 60,
      status: 'published',
    });

    inProgressSubmission = await Submission.create({
      assessmentId: inProgressAsmt._id,
      studentId: studentA._id,
      status: 'in_progress',
      evaluationStatus: 'pending',
      totalPoints: 30,
    });

    const mockQ = await Question.create({
      subjectId: subject._id,
      ownerFacultyId: facultyOwner._id,
      questionType: 'CODING',
      statement: 'Implement LRU cache get/put.',
      marks: 10,
      status: 'PUBLISHED',
      topics: ['Memory Management'],
    });

    mockTest = await MockTest.create({
      title: 'OS Gate Practice Test',
      examination: 'GATE 2027',
      subjectId: subject._id,
      ownerFacultyId: facultyOwner._id,
      totalMarks: 10,
      status: 'PUBLISHED',
      resolvedQuestions: [
        {
          questionId: mockQ._id,
          versionNumber: 1,
          questionSnapshot: {
            _id: mockQ._id,
            questionType: 'CODING',
            statement: 'Implement LRU cache get/put.',
            marks: 10,
            topics: ['Memory Management'],
          },
          marks: 10,
          orderIndex: 0,
        },
      ],
    });

    evaluatedMockAttempt = await MockTestAttempt.create({
      mockTestId: mockTest._id,
      studentId: studentA._id,
      status: 'EVALUATED',
      evaluationStatus: 'COMPLETED',
      totalMarks: 10,
      earnedMarks: 4,
      percentage: 40,
      correctCount: 0,
      incorrectCount: 1,
      unansweredCount: 0,
      submittedAt: new Date(Date.now() - 7200000),
      gradedAt: new Date(Date.now() - 1800000),
      generalFeedback: 'Review eviction edge cases.',
      topicWiseAnalytics: [
        {
          topicName: 'Memory Management',
          totalQuestions: 1,
          correctCount: 0,
          accuracyPercentage: 0,
        },
      ],
      responses: [
        {
          questionId: mockQ._id,
          code: 'def lru(): pass',
          language: 'python',
          isCorrect: false,
          scoreAwarded: 4,
          maxMarks: 10,
          evaluationStatus: 'MANUALLY_EVALUATED',
          evaluatorComment: 'Missing O(1) doubly linked list update.',
          executionResult: {
            verdict: 'WRONG_ANSWER',
            passedCount: 1,
            totalCount: 2,
            testCases: [
              { testCaseIndex: 0, passed: true, verdict: 'PASSED', isHidden: false },
              { testCaseIndex: 1, passed: false, verdict: 'FAILED', isHidden: true, input: 'SECRET_IN', expectedOutput: 'SECRET_OUT' },
            ],
          },
        },
      ],
    });

    pendingMockAttempt = await MockTestAttempt.create({
      mockTestId: mockTest._id,
      studentId: studentA._id,
      status: 'SUBMITTED',
      evaluationStatus: 'PENDING_MANUAL_REVIEW',
      totalMarks: 10,
      submittedAt: new Date(),
    });
  });

  t.after(async () => {
    await disconnectDB();
  });

  await t.test('1. Exam-wise Progress separates finalized exams from pending evaluations and excludes in-progress', async () => {
    const progress = await examReportService.getStudentExamProgress(
      studentA._id.toString(),
      { id: studentA._id.toString(), role: 'student' }
    );

    assert.equal(progress.evaluatedExams.length, 2);
    assert.equal(progress.pendingExams.length, 2);
    assert.equal(progress.summary.passedCount, 1);
    assert.equal(progress.summary.failedCount, 1);
    assert.equal(progress.summary.pendingCount, 2);

    const asmtRow = progress.evaluatedExams.find((e) => e.attemptId === evaluatedSubmission._id.toString());
    assert.ok(asmtRow);
    assert.equal(asmtRow.examName, 'Distributed Systems Midterm');
    assert.equal(asmtRow.score, 16);
    assert.equal(asmtRow.totalMarks, 20);
    assert.equal(asmtRow.percentage, 80);
    assert.equal(asmtRow.passed, true);
    assert.equal(asmtRow.reportAvailable, true);

    const mockRow = progress.evaluatedExams.find((e) => e.attemptId === evaluatedMockAttempt._id.toString());
    assert.ok(mockRow);
    assert.equal(mockRow.examTypeLabel, 'Mock Test');
    assert.equal(mockRow.examinationTag, 'GATE 2027');
    assert.equal(mockRow.passed, false);

    // Pending evaluations must state Report available after evaluation
    for (const pending of progress.pendingExams) {
      assert.equal(pending.reportAvailable, false);
      assert.equal(pending.reportStatusMessage, 'Report available after evaluation');
      assert.equal(pending.score, null);
    }

    // In-progress attempt must not appear
    const allIds = [...progress.evaluatedExams, ...progress.pendingExams].map((e) => e.attemptId);
    assert.equal(allIds.includes(inProgressSubmission._id.toString()), false);
  });

  await t.test('2. Individual Exam Performance Report includes actual details and hides hidden test cases from students', async () => {
    const asmtReport = await examReportService.getIndividualExamReport(
      'assessment',
      evaluatedSubmission._id.toString(),
      { id: studentA._id.toString(), role: 'student' }
    );

    assert.equal(asmtReport.meta.examName, 'Distributed Systems Midterm');
    assert.equal(asmtReport.student.studentId, 'STU-2026-001');
    assert.equal(asmtReport.outcome.score, 16);
    assert.equal(asmtReport.outcome.totalMarks, 20);
    assert.equal(asmtReport.outcome.percentage, 80);
    assert.equal(asmtReport.outcome.passed, true);
    assert.equal(asmtReport.counts.correct, 1);
    assert.equal(asmtReport.counts.incorrect, 1);
    assert.equal(asmtReport.counts.unanswered, 0);
    assert.equal(asmtReport.questionBreakdown.length, 2);
    assert.equal(asmtReport.topicBreakdown.length, 2);
    assert.match(asmtReport.feedback.generalFeedback, /Strong overall grasp/);

    const mockReport = await examReportService.getIndividualExamReport(
      'mock_test',
      evaluatedMockAttempt._id.toString(),
      { id: studentA._id.toString(), role: 'student' }
    );

    assert.equal(mockReport.meta.examinationTag, 'GATE 2027');
    assert.equal(mockReport.questionBreakdown[0].codingDetails.language, 'python');
    const hiddenTc = mockReport.questionBreakdown[0].codingDetails.executionResult.testCases.find((tc) => tc.isHidden);
    assert.equal(hiddenTc.input, undefined, 'Hidden test case input must not leak in student report');
  });

  await t.test('3. RBAC: student cannot access another student report and unauthorized faculty is blocked', async () => {
    await assert.rejects(
      () =>
        examReportService.getIndividualExamReport(
          'assessment',
          evaluatedSubmission._id.toString(),
          { id: studentB._id.toString(), role: 'student' }
        ),
      /Access denied/
    );

    await assert.rejects(
      () =>
        examReportService.getIndividualExamReport(
          'assessment',
          evaluatedSubmission._id.toString(),
          { id: facultyOther._id.toString(), role: 'instructor' }
        ),
      /not authorized/
    );

    // Owner instructor succeeds
    const facultyReport = await examReportService.getIndividualExamReport(
      'assessment',
      evaluatedSubmission._id.toString(),
      { id: facultyOwner._id.toString(), role: 'instructor' }
    );
    assert.equal(facultyReport.outcome.score, 16);
  });

  await t.test('4. Pending evaluations cannot generate finalized reports', async () => {
    await assert.rejects(
      () =>
        examReportService.getIndividualExamReport(
          'assessment',
          pendingSubmission._id.toString(),
          { id: studentA._id.toString(), role: 'student' }
        ),
      /Report available after evaluation/
    );

    await assert.rejects(
      () =>
        examReportService.getIndividualExamReport(
          'mock_test',
          pendingMockAttempt._id.toString(),
          { id: studentA._id.toString(), role: 'student' }
        ),
      /Report available after evaluation/
    );
  });

  await t.test('5. PDF report generator produces a valid multi-section PDF with actual data', async () => {
    const report = await examReportService.getIndividualExamReport(
      'assessment',
      evaluatedSubmission._id.toString(),
      { id: studentA._id.toString(), role: 'student' }
    );
    const pdfBuf = await pdfGenerator.generateExamReportPdf(report);
    assert.ok(Buffer.isBuffer(pdfBuf));
    const text = pdfBuf.toString('utf-8');
    assert.ok(text.startsWith('%PDF-1.4'));
    assert.match(text, /Distributed Systems Midterm/);
    assert.match(text, /Aarav Mehta/);
    assert.match(text, /16 \/ 20/);
    assert.match(text, /80%/);
  });

  await t.test('6. AI Predictor integration strictly excludes pending exams and never fabricates operational predictions', () => {
    const payload = aiPredictorService.buildIntegrationPayload({
      evaluatedExams: [
        { attemptId: '1', attemptType: 'assessment', examName: 'Exam 1', subject: 'CS', percentage: 80, status: 'evaluated' },
        { attemptId: '2', attemptType: 'assessment', examName: 'Pending Exam', subject: 'CS', percentage: 10, status: 'pending' },
      ],
    });

    assert.equal(payload.isOperational, false);
    assert.equal(payload.isEstimateOnly, true);
    assert.equal(payload.prediction, null);
    assert.equal(payload.evaluatedHistoryCount, 1);
    assert.equal(payload.hasSufficientHistory, false);
  });
});
