const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const submissionService = require('../src/services/submission.service');
const assessmentService = require('../src/services/assessment.service');
const proctoringService = require('../src/services/proctoring.service');
const { User, Assessment, Question, Submission, ProctoringSession, ProctoringEvent } = require('../src/models');

describe('Assessment Lifecycle & Catalog Bugs Verification (Bug 1 & Bug 2)', () => {
  let student;
  let student2;
  let instructor;
  let aiAssessment;
  let pastDeadlineAssessment;
  let proctoredAssessment;
  let testQuestion;

  before(async () => {
    await connectDB();
    await seedDatabase();

    student = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });
    instructor = await User.findOne({ email: 'instructor@uap.edu' });

    // Clean up any prior test submissions for this test
    await Submission.deleteMany({
      studentId: student._id,
      notes: 'test-lifecycle-fixture',
    });

    // 1. Create a published assessment with category 'Artificial Intelligence'
    aiAssessment = await Assessment.create({
      title: 'Neural Networks & Deep Learning',
      description: 'Comprehensive exam covering perceptrons, backpropagation, and CNNs.',
      category: 'Artificial Intelligence',
      instructorId: instructor._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 65,
      status: 'published',
      accessType: 'public',
      assignedStudents: [],
    });

    testQuestion = await Question.create({
      assessmentId: aiAssessment._id,
      questionText: 'What activation function is defined as f(x) = max(0, x)?',
      type: 'mcq',
      options: [
        { id: 'a', text: 'Sigmoid' },
        { id: 'b', text: 'ReLU' },
        { id: 'c', text: 'Tanh' },
        { id: 'd', text: 'Softmax' },
      ],
      correctAnswer: 'b',
      points: 100,
      orderIndex: 0,
    });

    // 2. Create an assessment with past platform deadline
    pastDeadlineAssessment = await Assessment.create({
      title: 'Archived AI Midterm',
      description: 'Old midterm examination',
      category: 'Artificial Intelligence',
      instructorId: instructor._id,
      durationMinutes: 30,
      totalPoints: 50,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      deadlineAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 24 hours ago
    });

    // 3. Create a proctored assessment
    proctoredAssessment = await Assessment.create({
      title: 'Proctored AI Ethics Assessment',
      description: 'Exam on AI alignment and safety guidelines.',
      category: 'Artificial Intelligence',
      instructorId: instructor._id,
      durationMinutes: 60,
      totalPoints: 50,
      passingScore: 70,
      status: 'published',
      accessType: 'public',
      proctoringEnabled: true,
      cameraRequired: false,
    });
  });

  after(async () => {
    // Cleanup fixtures
    if (aiAssessment) {
      await Assessment.findByIdAndDelete(aiAssessment._id);
      await Question.deleteMany({ assessmentId: aiAssessment._id });
      await Submission.deleteMany({ assessmentId: aiAssessment._id });
    }
    if (pastDeadlineAssessment) {
      await Assessment.findByIdAndDelete(pastDeadlineAssessment._id);
      await Submission.deleteMany({ assessmentId: pastDeadlineAssessment._id });
    }
    if (proctoredAssessment) {
      const subs = await Submission.find({ assessmentId: proctoredAssessment._id });
      for (const s of subs) {
        await ProctoringSession.deleteMany({ submissionId: s._id });
      }
      await Assessment.findByIdAndDelete(proctoredAssessment._id);
      await Submission.deleteMany({ assessmentId: proctoredAssessment._id });
    }
    await disconnectDB();
  });

  // ==========================================
  // BUG 1: CATALOG VISIBILITY & FILTERING
  // ==========================================
  describe('Bug 1: Published Assessment Catalog Visibility & Category Filtering', () => {
    let lifecycleDraftExam;
    let restrictedExam;
    let archivedExam;

    it('1. Instructor creates assessment with draft status', async () => {
      lifecycleDraftExam = await Assessment.create({
        title: 'LifecycleTest Draft AI Assessment',
        description: 'Exam on AI ethics and deep learning models.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 45,
        totalPoints: 100,
        passingScore: 60,
        status: 'draft',
        accessType: 'public',
      });

      assert.ok(lifecycleDraftExam._id);
      assert.strictEqual(lifecycleDraftExam.status, 'draft');
    });

    it('2. Assessment remains draft and is not published', async () => {
      const found = await Assessment.findById(lifecycleDraftExam._id);
      assert.strictEqual(found.status, 'draft');
    });

    it('3. Student cannot see draft assessment in catalog', async () => {
      const result = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        limit: 200,
      });

      const draftFound = result.assessments.some(
        (a) => a._id.toString() === lifecycleDraftExam._id.toString()
      );
      assert.strictEqual(draftFound, false, 'Draft assessment must not appear in student catalog');
    });

    it('4. Instructor publishes assessment live', async () => {
      const updated = await assessmentService.updateAssessment(
        lifecycleDraftExam._id,
        instructor._id,
        { status: 'published' },
        false
      );

      assert.strictEqual(updated.status, 'published');
    });

    it('5. Public published assessment is returned to eligible student in getAssessments', async () => {
      const result = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        limit: 200,
      });

      const found = result.assessments.some(
        (a) => a._id.toString() === lifecycleDraftExam._id.toString()
      );
      assert.strictEqual(found, true, 'Public published assessment must be returned to student');
    });

    it('6. Student catalog displays published assessment with correct fields', async () => {
      const result = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        limit: 200,
      });

      const examDoc = result.assessments.find(
        (a) => a._id.toString() === lifecycleDraftExam._id.toString()
      );
      assert.ok(examDoc);
      assert.strictEqual(examDoc.title, 'LifecycleTest Draft AI Assessment');
      assert.strictEqual(examDoc.category, 'Artificial Intelligence');
      assert.strictEqual(examDoc.durationMinutes, 45);
    });

    it('7. Restricted published assessment is visible only to assigned student', async () => {
      restrictedExam = await Assessment.create({
        title: 'LifecycleTest Restricted AI Honors Exam',
        description: 'Exam restricted to selected cohort.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 60,
        totalPoints: 100,
        passingScore: 70,
        status: 'published',
        accessType: 'restricted',
        assignedStudents: [student._id], // student is assigned, student2 is not
      });

      const resultStudent1 = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        limit: 200,
      });

      const visibleToAssigned = resultStudent1.assessments.some(
        (a) => a._id.toString() === restrictedExam._id.toString()
      );
      assert.strictEqual(visibleToAssigned, true, 'Restricted assessment must be visible to assigned student');
    });

    it('8. Restricted assessment is hidden from unassigned student', async () => {
      const resultStudent2 = await assessmentService.getAssessments({
        role: 'student',
        userId: student2._id.toString(),
        limit: 200,
      });

      const visibleToUnassigned = resultStudent2.assessments.some(
        (a) => a._id.toString() === restrictedExam._id.toString()
      );
      assert.strictEqual(visibleToUnassigned, false, 'Restricted assessment must be hidden from unassigned student');
    });

    it('9. Category filtering by "Artificial Intelligence" (case-insensitive & trimmed) works correctly', async () => {
      const result = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        category: '  artificial intelligence  ',
        limit: 200,
      });

      assert.ok(result.assessments.length > 0, 'Must return assessments in Artificial Intelligence');
      const allAi = result.assessments.every(
        (a) => a.category.toLowerCase().trim() === 'artificial intelligence'
      );
      assert.strictEqual(allAi, true, 'All returned items must match the filtered category');
      const found = result.assessments.some(
        (a) => a._id.toString() === aiAssessment._id.toString()
      );
      assert.strictEqual(found, true, 'Category filter must find the Artificial Intelligence assessment');
    });

    it('10. "All" category returns all eligible published assessments without category restriction', async () => {
      const resultAll = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        category: 'All',
        limit: 200,
      });

      const resultUnspecified = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        limit: 200,
      });

      assert.strictEqual(resultAll.total, resultUnspecified.total, '"All" category must match total count');
      const found = resultAll.assessments.some(
        (a) => a._id.toString() === aiAssessment._id.toString()
      );
      assert.strictEqual(found, true, '"All" category must include eligible AI assessments');
    });

    it('11. Search works independently and in combination with category filter', async () => {
      const result = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        search: 'backpropagation',
        limit: 200,
      });

      assert.ok(result.assessments.length > 0, 'Search must return results');
      const found = result.assessments.some(
        (a) => a._id.toString() === aiAssessment._id.toString()
      );
      assert.strictEqual(found, true, 'Keyword search must locate assessment by description');

      // Search + Category combination
      const combined = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        category: 'Artificial Intelligence',
        search: 'perceptrons',
        limit: 200,
      });
      const foundCombined = combined.assessments.some(
        (a) => a._id.toString() === aiAssessment._id.toString()
      );
      assert.strictEqual(foundCombined, true, 'Combined search and category must find assessment');
    });

    it('12. Archived assessment and expired assessments are excluded from student catalog', async () => {
      archivedExam = await Assessment.create({
        title: 'LifecycleTest Archived AI Historical Exam',
        description: 'Past historical exam.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 30,
        totalPoints: 50,
        passingScore: 60,
        status: 'archived',
        accessType: 'public',
      });

      const result = await assessmentService.getAssessments({
        role: 'student',
        userId: student._id.toString(),
        limit: 200,
      });

      const archivedFound = result.assessments.some(
        (a) => a._id.toString() === archivedExam._id.toString()
      );
      assert.strictEqual(archivedFound, false, 'Archived assessment must never appear in student catalog');

      const pastFound = result.assessments.some(
        (a) => a._id.toString() === pastDeadlineAssessment._id.toString()
      );
      assert.strictEqual(pastFound, false, 'Expired assessment must not appear in student catalog');

      // Cleanup local fixtures
      await Assessment.findByIdAndDelete(lifecycleDraftExam._id);
      await Assessment.findByIdAndDelete(restrictedExam._id);
      await Assessment.findByIdAndDelete(archivedExam._id);
    });
  });

  // ==========================================
  // BUG 2: ATTEMPT LIFECYCLE & SERVER TIMER
  // ==========================================
  describe('Bug 2 Verification: Assessment Details, Attempt Start, Autosave, Expiry & Submission Lifecycle', () => {
    let lifecycleExam30;
    let questionA;
    let questionB;
    let activeSub;

    before(async () => {
      lifecycleExam30 = await Assessment.create({
        title: 'LifecycleTest Active 30-Minute AI Exam',
        description: 'Comprehensive test for server-authoritative timer and submission lifecycle.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 30,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
      });

      questionA = await Question.create({
        assessmentId: lifecycleExam30._id,
        questionText: 'What activation function is defined as max(0, x)?',
        type: 'mcq',
        options: [
          { id: 'opt_1', text: 'ReLU' },
          { id: 'opt_2', text: 'Sigmoid' },
        ],
        correctAnswer: 'opt_1',
        points: 50,
        orderIndex: 0,
      });

      questionB = await Question.create({
        assessmentId: lifecycleExam30._id,
        questionText: 'Explain the vanishing gradient problem concisely.',
        type: 'short_answer',
        points: 50,
        orderIndex: 1,
      });
    });

    after(async () => {
      if (lifecycleExam30?._id) {
        await Submission.deleteMany({ assessmentId: lifecycleExam30._id });
        await Question.deleteMany({ assessmentId: lifecycleExam30._id });
        await Assessment.findByIdAndDelete(lifecycleExam30._id);
      }
    });

    it('1. Opening assessment details (getAssessmentById) does NOT create a submission', async () => {
      const details = await assessmentService.getAssessmentById(lifecycleExam30._id, {
        id: student._id,
        role: 'student',
      });

      assert.ok(details._id);
      assert.strictEqual(details.title, lifecycleExam30.title);

      const subCount = await Submission.countDocuments({
        studentId: student._id,
        assessmentId: lifecycleExam30._id,
      });
      assert.strictEqual(subCount, 0, 'Opening details must NOT create a submission in DB');
    });

    it('2. Opening assessment does NOT call submit endpoint or create a submitted submission', async () => {
      const submissions = await Submission.find({
        studentId: student._id,
        assessmentId: lifecycleExam30._id,
      });
      assert.strictEqual(submissions.length, 0, 'No submissions must exist merely from opening assessment');
    });

    it('3. Starting assessment creates submission with status = in_progress', async () => {
      activeSub = await submissionService.startAttempt(student._id, lifecycleExam30._id);

      assert.ok(activeSub._id, 'Submission must be created');
      assert.strictEqual(activeSub.status, 'in_progress', 'Started attempt must be in_progress');
      assert.strictEqual(activeSub.studentId.toString(), student._id.toString());
      assert.strictEqual(activeSub.assessmentId.toString(), lifecycleExam30._id.toString());
    });

    it('4. Immediately after start: submittedAt is null', async () => {
      const inDb = await Submission.findById(activeSub._id);
      assert.strictEqual(inDb.submittedAt, null, 'submittedAt must be null on newly started attempt');
    });

    it('5. Immediately after start: submission remains in_progress', async () => {
      const inDb = await Submission.findById(activeSub._id);
      assert.strictEqual(inDb.status, 'in_progress');
      assert.strictEqual(inDb.submittedReason, null);
    });

    it('6. deadlineAt is correctly calculated from startedAt + durationMinutes', async () => {
      const startedAtMs = new Date(activeSub.startedAt).getTime();
      const deadlineAtMs = new Date(activeSub.deadlineAt).getTime();
      const expectedDiffMs = 30 * 60 * 1000;

      assert.strictEqual(deadlineAtMs - startedAtMs, expectedDiffMs, 'deadlineAt must be exactly 30 minutes after startedAt');
    });

    it('7. A 30-minute assessment does NOT expire immediately (deadline is ~30 minutes in future)', async () => {
      const now = Date.now();
      const deadlineMs = new Date(activeSub.deadlineAt).getTime();
      const remainingMinutes = (deadlineMs - now) / (1000 * 60);

      assert.ok(
        remainingMinutes >= 28 && remainingMinutes <= 30.1,
        `Remaining minutes should be ~30, got ${remainingMinutes}`
      );
    });

    it('8. Student can save answers while in_progress via autosaveAnswer', async () => {
      const res = await submissionService.autosaveAnswer(
        activeSub._id,
        student._id,
        questionA._id.toString(),
        'opt_1'
      );

      assert.strictEqual(res.success, true);
      const inDb = await Submission.findById(activeSub._id);
      assert.strictEqual(inDb.status, 'in_progress', 'Status must stay in_progress after autosave');
      assert.strictEqual(inDb.answers.get(questionA._id.toString()), 'opt_1');
    });

    it('9. Student can navigate between questions and save answers while in_progress', async () => {
      const res2 = await submissionService.autosaveAnswer(
        activeSub._id,
        student._id,
        questionB._id.toString(),
        'Gradients become excessively small during backprop.'
      );

      assert.strictEqual(res2.success, true);
      const inDb = await Submission.findById(activeSub._id);
      assert.strictEqual(inDb.status, 'in_progress');
      assert.strictEqual(inDb.answers.size, 2);
    });

    it('10. Student can remain on Attempt page until deadline without premature auto-submission', async () => {
      const studentSubs = await submissionService.getStudentSubmissions(student._id);
      const current = studentSubs.find((s) => s._id.toString() === activeSub._id.toString());

      assert.ok(current, 'Active attempt must be found');
      assert.strictEqual(current.status, 'in_progress', 'Attempt must remain in_progress');
      assert.strictEqual(current.submittedAt, null);
    });

    it('11. Refreshing an active attempt (duplicate startAttempt) returns existing attempt in_progress without submitting', async () => {
      const refreshed = await submissionService.startAttempt(student._id, lifecycleExam30._id);

      assert.strictEqual(refreshed._id.toString(), activeSub._id.toString(), 'Must return existing attempt');
      assert.strictEqual(refreshed.status, 'in_progress', 'Refreshed attempt must remain in_progress');
      assert.strictEqual(refreshed.submittedAt, null);
      assert.strictEqual(refreshed.answers.get(questionA._id.toString()), 'opt_1');
    });

    it('12. Refreshing an active attempt does not create a second submission in database', async () => {
      const count = await Submission.countDocuments({
        studentId: student._id,
        assessmentId: lifecycleExam30._id,
      });
      assert.strictEqual(count, 1, 'Exactly one submission must exist');
    });

    it('13. Manual submit changes status correctly to submitted/evaluated with USER_SUBMITTED', async () => {
      const submitted = await submissionService.submitAssessment(activeSub._id, student._id, {
        [questionA._id.toString()]: 'opt_1',
        [questionB._id.toString()]: 'Detailed written explanation of gradient vanishing.',
      });

      assert.strictEqual(submitted.status, 'submitted');
      assert.strictEqual(submitted.submittedReason, 'USER_SUBMITTED');
    });

    it('14. Manual submit records submittedAt timestamp in database', async () => {
      const inDb = await Submission.findById(activeSub._id);
      assert.strictEqual(inDb.status, 'submitted');
      assert.ok(inDb.submittedAt instanceof Date, 'submittedAt must be an instance of Date');
      assert.strictEqual(inDb.submittedReason, 'USER_SUBMITTED');
    });

    it('15. Duplicate submit requests do not create inconsistent state (rejected with 400)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.submitAssessment(activeSub._id, student._id, {});
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /already been submitted/i);
          return true;
        }
      );
    });

    it('16. An already submitted attempt cannot be started again (one-attempt rule)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.startAttempt(student._id, lifecycleExam30._id);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /only one attempt is permitted/i);
          return true;
        }
      );
    });

    it('17. Starting/resuming an attempt whose timer has expired auto-finalizes it with TIME_EXPIRED', async () => {
      const expiredExam = await Assessment.create({
        title: 'LifecycleTest Timeout Exam',
        description: 'Auto-finalization test.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 10,
        status: 'published',
        accessType: 'public',
      });

      const expiredSub = await Submission.create({
        studentId: student._id,
        assessmentId: expiredExam._id,
        status: 'in_progress',
        startedAt: new Date(Date.now() - 1000 * 60 * 30),
        deadlineAt: new Date(Date.now() - 1000 * 60 * 15), // expired 15 mins ago
        answers: new Map(),
      });

      await assert.rejects(
        async () => {
          await submissionService.startAttempt(student._id, expiredExam._id);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /expired/i);
          return true;
        }
      );

      const inDb = await Submission.findById(expiredSub._id);
      assert.strictEqual(inDb.status, 'submitted');
      assert.strictEqual(inDb.submittedReason, 'TIME_EXPIRED');
      assert.ok(inDb.submittedAt);

      await Submission.findByIdAndDelete(expiredSub._id);
      await Assessment.findByIdAndDelete(expiredExam._id);
    });

    it('18. Expired in-progress submissions are auto-finalized upon getStudentSubmissions query', async () => {
      const bgExam = await Assessment.create({
        title: 'LifecycleTest Background Sweeper Exam',
        description: 'Sweep test.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 15,
        status: 'published',
        accessType: 'public',
      });

      const staleSub = await Submission.create({
        studentId: student2._id,
        assessmentId: bgExam._id,
        status: 'in_progress',
        startedAt: new Date(Date.now() - 1000 * 60 * 60),
        deadlineAt: new Date(Date.now() - 1000 * 60 * 45), // expired 45 mins ago
        answers: new Map(),
      });

      const list = await submissionService.getStudentSubmissions(student2._id);
      const found = list.find((s) => s._id.toString() === staleSub._id.toString());

      assert.ok(found);
      assert.strictEqual(found.status, 'submitted');
      assert.strictEqual(found.submittedReason, 'TIME_EXPIRED');
      assert.ok(found.submittedAt);

      await Submission.findByIdAndDelete(staleSub._id);
      await Assessment.findByIdAndDelete(bgExam._id);
    });

    it('19. Proctored attempt creates active ProctoringSession, and submit finishes it with session_ended event', async () => {
      const procSub = await submissionService.startAttempt(student._id, proctoredAssessment._id);
      assert.strictEqual(procSub.status, 'in_progress');

      const session = await ProctoringSession.findOne({ submissionId: procSub._id });
      assert.ok(session, 'ProctoringSession must be initialized');
      assert.strictEqual(session.status, 'active');

      const submitted = await submissionService.submitAssessment(procSub._id, student._id, {});
      assert.ok(['submitted', 'evaluated'].includes(submitted.status));
      assert.strictEqual(submitted.submittedReason, 'USER_SUBMITTED');

      const endedSession = await ProctoringSession.findById(session._id);
      assert.strictEqual(endedSession.status, 'completed');
      assert.ok(endedSession.endedAt);

      const endEvents = await ProctoringEvent.find({
        sessionId: session._id,
        eventType: 'session_ended',
      });
      assert.strictEqual(endEvents.length, 1, 'session_ended event must be recorded exactly once');
    });

    it('20. Proctored attempt expiration also completes ProctoringSession with TIME_EXPIRED and records session_ended', async () => {
      const expiryProcExam = await Assessment.create({
        title: 'LifecycleTest Proctored Expiry Final Exam',
        description: 'Testing proctoring session completion on timeout.',
        category: 'Artificial Intelligence',
        instructorId: instructor._id,
        durationMinutes: 5,
        status: 'published',
        accessType: 'public',
        proctoringEnabled: true,
        cameraRequired: false,
      });

      const sub = await submissionService.startAttempt(student._id, expiryProcExam._id);
      const session = await ProctoringSession.findOne({ submissionId: sub._id });
      assert.ok(session);
      assert.strictEqual(session.status, 'active');

      // Artificially expire the submission deadline
      await Submission.findByIdAndUpdate(sub._id, {
        deadlineAt: new Date(Date.now() - 5000), // 5 seconds ago
      });

      // Calling startAttempt triggers expiry finalization
      await assert.rejects(async () => {
        await submissionService.startAttempt(student._id, expiryProcExam._id);
      });

      const updatedSession = await ProctoringSession.findById(session._id);
      assert.strictEqual(updatedSession.status, 'completed', 'Proctoring session must be completed upon expiration');

      const endEvents = await ProctoringEvent.find({
        sessionId: session._id,
        eventType: 'session_ended',
      });
      assert.strictEqual(endEvents.length, 1, 'session_ended event must exist exactly once');
      assert.strictEqual(endEvents[0].metadata?.reason, 'TIME_EXPIRED');

      await ProctoringSession.deleteMany({ submissionId: sub._id });
      await ProctoringEvent.deleteMany({ sessionId: session._id });
      await Submission.findByIdAndDelete(sub._id);
      await Assessment.findByIdAndDelete(expiryProcExam._id);
    });

    it('21. Starting an attempt for an assessment with past platform deadline is rejected with 403', async () => {
      await assert.rejects(
        async () => {
          await submissionService.startAttempt(student._id, pastDeadlineAssessment._id);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /deadline has passed/i);
          return true;
        }
      );
    });
  });
});
