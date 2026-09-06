const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const submissionService = require('../src/services/submission.service');
const assessmentService = require('../src/services/assessment.service');
const { User, Assessment, Question, Submission } = require('../src/models');

describe('Phase D Verification: Student Assessment Engine & Autosave', () => {
  let student1;
  let student2;
  let instructor;
  let exam;
  let restrictedExam;
  let q1Mcq;
  let q2Short;
  let otherExamQ;

  before(async () => {
    await connectDB();
    await seedDatabase();

    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });
    instructor = await User.findOne({ email: 'instructor@uap.edu' });

    // Create a timed exam with 1 MCQ and 1 Short Answer
    exam = await Assessment.create({
      title: 'Phase D Engine Test Exam',
      category: 'Software Engineering',
      instructorId: instructor._id,
      durationMinutes: 45,
      totalPoints: 50,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      assignedStudents: [],
    });

    q1Mcq = await Question.create({
      assessmentId: exam._id,
      questionText: 'What protocol does WebSocket upgrade from?',
      type: 'mcq',
      options: [
        { id: 'a', text: 'FTP' },
        { id: 'b', text: 'HTTP' },
      ],
      correctAnswer: 'b',
      explanation: 'SECRET: WebSockets use HTTP 101 Switching Protocols.',
      points: 20,
      orderIndex: 0,
    });

    q2Short = await Question.create({
      assessmentId: exam._id,
      questionText: 'Explain idempotence in HTTP methods.',
      type: 'short_answer',
      options: [],
      correctAnswer: 'An operation produces identical side-effects regardless of how many times it is executed.',
      explanation: 'SECRET: GET, PUT, DELETE are idempotent.',
      points: 30,
      orderIndex: 1,
    });

    // Restricted exam assigned ONLY to student1
    restrictedExam = await Assessment.create({
      title: 'Restricted Honours Assessment',
      category: 'Research',
      instructorId: instructor._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 70,
      status: 'published',
      accessType: 'restricted',
      assignedStudents: [student1._id],
    });

    // Question belonging to another exam
    otherExamQ = await Question.create({
      assessmentId: restrictedExam._id,
      questionText: 'Foreign question prompt',
      type: 'short_answer',
      points: 10,
      orderIndex: 0,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('should start attempt for authorized published assessment with server timer', async () => {
    const submission = await submissionService.startAttempt(student1._id, exam._id);

    assert.ok(submission._id);
    assert.strictEqual(submission.studentId.toString(), student1._id.toString());
    assert.strictEqual(submission.assessmentId.toString(), exam._id.toString());
    assert.strictEqual(submission.status, 'in_progress');
    assert.ok(submission.startedAt);
    assert.ok(submission.deadlineAt);

    // Verify deadlineAt is roughly 45 minutes after startedAt
    const diffMins = Math.round(
      (new Date(submission.deadlineAt).getTime() - new Date(submission.startedAt).getTime()) /
        (1000 * 60)
    );
    assert.strictEqual(diffMins, 45);
  });

  it('should perform granular autosave on individual answers (PATCH /answers/:questionId)', async () => {
    const activeSub = await Submission.findOne({
      studentId: student1._id,
      assessmentId: exam._id,
      status: 'in_progress',
    });
    assert.ok(activeSub);

    const result = await submissionService.autosaveAnswer(
      activeSub._id,
      student1._id,
      q1Mcq._id,
      'b'
    );

    assert.ok(result.success);
    assert.strictEqual(result.questionId.toString(), q1Mcq._id.toString());
    assert.strictEqual(result.answer, 'b');

    // Verify persisted in database
    const reloaded = await Submission.findById(activeSub._id);
    const answersObj = reloaded.answers instanceof Map ? Object.fromEntries(reloaded.answers) : reloaded.answers;
    assert.strictEqual(answersObj[q1Mcq._id.toString()], 'b');
  });

  it('should block autosave with a question that does not belong to the assessment', async () => {
    const activeSub = await Submission.findOne({
      studentId: student1._id,
      assessmentId: exam._id,
      status: 'in_progress',
    });

    await assert.rejects(
      async () => {
        await submissionService.autosaveAnswer(
          activeSub._id,
          student1._id,
          otherExamQ._id, // Belongs to restrictedExam, not exam
          'Some Answer'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /question does not belong to this assessment/i);
        return true;
      }
    );
  });

  it('should block another student from autosaving into foreign submission', async () => {
    const activeSub = await Submission.findOne({
      studentId: student1._id,
      assessmentId: exam._id,
      status: 'in_progress',
    });

    await assert.rejects(
      async () => {
        await submissionService.autosaveAnswer(
          activeSub._id,
          student2._id, // Wrong student
          q1Mcq._id,
          'a'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /access denied/i);
        return true;
      }
    );
  });

  it('should block unauthorized student from starting restricted assessment', async () => {
    await assert.rejects(
      async () => {
        await submissionService.startAttempt(student2._id, restrictedExam._id);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not authorized to attempt this restricted assessment/i);
        return true;
      }
    );
  });

  it('should submit assessment and correctly separate autoScore from subjective score', async () => {
    const activeSub = await Submission.findOne({
      studentId: student1._id,
      assessmentId: exam._id,
      status: 'in_progress',
    });

    const submitted = await submissionService.submitAssessment(activeSub._id, student1._id, {
      [q1Mcq._id.toString()]: 'b', // Correct: +20
      [q2Short._id.toString()]: 'Idempotence means multiple identical calls have the same outcome.',
    });

    assert.strictEqual(submitted.status, 'submitted');
    assert.strictEqual(submitted.resultStatus, 'pending_evaluation');
    assert.strictEqual(submitted.evaluationStatus, 'pending');
    assert.strictEqual(submitted.autoScore, 20);
    assert.strictEqual(submitted.score, 20);
    assert.strictEqual(submitted.passed, false, 'Should not pass before subjective grading');
    assert.strictEqual(submitted.submittedReason, 'USER_SUBMITTED');
  });

  it('should enforce one-attempt rule: reject duplicate startAttempt after submission', async () => {
    await assert.rejects(
      async () => {
        await submissionService.startAttempt(student1._id, exam._id);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /only one attempt is permitted/i);
        return true;
      }
    );
  });

  it('should enforce one-attempt rule at MongoDB compound unique index level', async () => {
    await assert.rejects(
      async () => {
        await Submission.create({
          studentId: student1._id,
          assessmentId: exam._id,
          status: 'in_progress',
        });
      },
      (err) => {
        // Mongo duplicate key error code 11000
        assert.strictEqual(err.code, 11000);
        return true;
      }
    );
  });

  it('should reject autosave on expired attempts and auto-close them', async () => {
    // Create an expired attempt for student2 on a new assessment
    const expiredExam = await Assessment.create({
      title: 'Expired Speed Exam',
      instructorId: instructor._id,
      durationMinutes: 1,
      totalPoints: 10,
      status: 'published',
      accessType: 'public',
    });

    const expQ = await Question.create({
      assessmentId: expiredExam._id,
      questionText: 'Quick question',
      type: 'mcq',
      points: 10,
      orderIndex: 0,
    });

    const expiredSub = await Submission.create({
      studentId: student2._id,
      assessmentId: expiredExam._id,
      status: 'in_progress',
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      deadlineAt: new Date(Date.now() - 3000000), // expired ~50 minutes ago
    });

    await assert.rejects(
      async () => {
        await submissionService.autosaveAnswer(
          expiredSub._id,
          student2._id,
          expQ._id,
          'a'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /deadline has expired/i);
        return true;
      }
    );

    const reloaded = await Submission.findById(expiredSub._id);
    assert.strictEqual(reloaded.status, 'submitted');
    assert.strictEqual(reloaded.submittedReason, 'TIME_EXPIRED');
  });

  it('should block another student from viewing submission details', async () => {
    const student1Sub = await Submission.findOne({
      studentId: student1._id,
      assessmentId: exam._id,
    });

    await assert.rejects(
      async () => {
        await submissionService.getSubmissionById(
          student1Sub._id,
          student2._id, // student2 attempting to view student1 submission
          'student'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /unauthorized access/i);
        return true;
      }
    );
  });
});
