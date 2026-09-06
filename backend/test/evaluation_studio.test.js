const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const assessmentService = require('../src/services/assessment.service');
const submissionService = require('../src/services/submission.service');
const evaluationService = require('../src/services/evaluation.service');
const { User, Assessment, Question, Submission, Evaluation } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Phase F Verification: Evaluation Studio & Subjective Scoring', () => {
  let instructor1;
  let instructor2;
  let student1;
  let student2;
  let mixedAssessment;
  let mcqQuestion;
  let shortAnswerQuestion;
  let longAnswerQuestion;
  let student1Submission;

  before(async () => {
    await connectDB();
    await seedDatabase();

    instructor1 = await User.findOne({ email: 'instructor@uap.edu' });
    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });

    await User.deleteOne({ email: 'alan.turing.f@uap.edu' });
    const pass = await hashPassword('Password123');
    instructor2 = await User.create({
      name: 'Professor Turing',
      email: 'alan.turing.f@uap.edu',
      password: pass,
      role: 'instructor',
      status: 'active',
      isActive: true,
    });

    // Create a published assessment with mixed questions:
    // MCQ (10 pts), Short Answer (20 pts), Long Answer (30 pts) -> Total: 60 pts, passingScore: 60%
    mixedAssessment = await Assessment.create({
      title: 'Systems & Architecture Capstone',
      category: 'Software Engineering',
      instructorId: instructor1._id,
      durationMinutes: 60,
      totalPoints: 60,
      passingScore: 60, // 60% of 60 pts = 36 pts needed to pass
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    mcqQuestion = await Question.create({
      assessmentId: mixedAssessment._id,
      questionText: 'What is CAP Theorem?',
      type: 'mcq',
      options: [
        { id: '1', text: 'Consistency, Availability, Partition Tolerance' },
        { id: '2', text: 'Compute, Access, Process' },
      ],
      correctAnswer: '1',
      points: 10,
      orderIndex: 0,
      explanation: 'CONFIDENTIAL: Instructor rubric notes.',
    });

    shortAnswerQuestion = await Question.create({
      assessmentId: mixedAssessment._id,
      questionText: 'Differentiate between optimistic and pessimistic locking.',
      type: 'short_answer',
      points: 20,
      orderIndex: 1,
      explanation: 'CONFIDENTIAL: Optimistic uses version numbers, pessimistic locks rows.',
    });

    longAnswerQuestion = await Question.create({
      assessmentId: mixedAssessment._id,
      questionText: 'Design a distributed rate limiter.',
      type: 'long_answer',
      points: 30,
      orderIndex: 2,
      explanation: 'CONFIDENTIAL: Token bucket or sliding window log with Redis cluster.',
    });

    // Student 1 starts attempt and submits answers
    const attempt = await submissionService.startAttempt(student1._id, mixedAssessment._id);
    const qIdMap = {};
    qIdMap[mcqQuestion._id.toString()] = '1'; // correct answer -> awards 10 autoScore
    qIdMap[shortAnswerQuestion._id.toString()] =
      'Optimistic locking checks version before commit, pessimistic holds exclusive db lock.';
    qIdMap[longAnswerQuestion._id.toString()] =
      '<p>A distributed rate limiter can use Redis with sliding window counter.</p>';

    student1Submission = await submissionService.submitAssessment(
      attempt._id,
      student1._id,
      qIdMap
    );
  });

  after(async () => {
    await disconnectDB();
  });

  it('1. MCQ autoScore is preserved upon submission and subjective evaluation remains pending', async () => {
    assert.strictEqual(student1Submission.autoScore, 10);
    assert.strictEqual(student1Submission.manualScore, 0);
    assert.strictEqual(student1Submission.status, 'submitted');
    assert.strictEqual(student1Submission.evaluationStatus, 'pending');
    assert.strictEqual(student1Submission.resultStatus, 'pending_evaluation');
    assert.strictEqual(student1Submission.passed, false);
  });

  it('2. instructor cannot evaluate submission for assessment owned by another instructor (HTTP 403)', async () => {
    await assert.rejects(
      async () => {
        await evaluationService.evaluateSubmission(instructor2._id, student1Submission._id, {
          questionFeedback: {
            [shortAnswerQuestion._id.toString()]: { pointsAwarded: 15 },
          },
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not authorized to evaluate/i);
        return true;
      }
    );
  });

  it('3. reject invalid score (negative awarded points or NaN)', async () => {
    await assert.rejects(
      async () => {
        await evaluationService.evaluateSubmission(instructor1._id, student1Submission._id, {
          questionFeedback: {
            [shortAnswerQuestion._id.toString()]: { pointsAwarded: -5 },
          },
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /must be a non-negative number/i);
        return true;
      }
    );
  });

  it('4. reject score exceeding question maximum points', async () => {
    // shortAnswerQuestion has 20 max points. Awarding 25 must fail.
    await assert.rejects(
      async () => {
        await evaluationService.evaluateSubmission(instructor1._id, student1Submission._id, {
          questionFeedback: {
            [shortAnswerQuestion._id.toString()]: { pointsAwarded: 25 },
          },
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /cannot exceed maximum points/i);
        return true;
      }
    );
  });

  it('5. reject question that does not belong to the assessment', async () => {
    const fakeQId = '507f1f77bcf86cd799439011';
    await assert.rejects(
      async () => {
        await evaluationService.evaluateSubmission(instructor1._id, student1Submission._id, {
          questionFeedback: {
            [fakeQId]: { pointsAwarded: 5 },
          },
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /does not belong to this assessment/i);
        return true;
      }
    );
  });

  it('6. incomplete subjective evaluation does not produce a false final result', async () => {
    // Grade ONLY shortAnswerQuestion (18 pts out of 20), leaving longAnswerQuestion un-graded
    const partialRes = await evaluationService.evaluateSubmission(
      instructor1._id,
      student1Submission._id,
      {
        questionFeedback: {
          [shortAnswerQuestion._id.toString()]: {
            pointsAwarded: 18,
            comment: 'Great explanation of locking.',
          },
        },
        generalFeedback: 'Partial grading in progress.',
      }
    );

    const sub = partialRes.submission;
    assert.strictEqual(sub.manualScore, 18);
    assert.strictEqual(sub.autoScore, 10);
    assert.strictEqual(sub.status, 'submitted');
    assert.strictEqual(sub.evaluationStatus, 'pending');
    assert.strictEqual(sub.resultStatus, 'pending_evaluation');
    assert.strictEqual(sub.passed, false);
    assert.strictEqual(partialRes.evaluation.status, 'pending');
  });

  it('7. complete evaluation combines autoScore + manualScore and calculates final PASS/FAIL correctly', async () => {
    // Grade both subjective questions:
    // shortAnswerQuestion: 18/20 pts
    // longAnswerQuestion: 24/30 pts
    // Total manualScore = 18 + 24 = 42 pts.
    // autoScore = 10 pts.
    // finalScore = 10 + 42 = 52 pts.
    // percentage = (52 / 60) * 100 = 86.67%.
    // passingScore is 60%, so passed = true, resultStatus = 'passed'.
    const completeRes = await evaluationService.evaluateSubmission(
      instructor1._id,
      student1Submission._id,
      {
        questionFeedback: {
          [shortAnswerQuestion._id.toString()]: {
            pointsAwarded: 18,
            comment: 'Accurate description of both mechanisms.',
          },
          [longAnswerQuestion._id.toString()]: {
            pointsAwarded: 24,
            comment: 'Solid distributed sliding window architecture.',
          },
        },
        generalFeedback: 'Outstanding work across theoretical and applied sections.',
      }
    );

    const sub = completeRes.submission;
    assert.strictEqual(sub.autoScore, 10);
    assert.strictEqual(sub.manualScore, 42);
    assert.strictEqual(sub.finalScore, 52);
    assert.strictEqual(sub.score, 52);
    assert.strictEqual(sub.percentage, 86.67);
    assert.strictEqual(sub.passed, true);
    assert.strictEqual(sub.resultStatus, 'passed');
    assert.strictEqual(sub.status, 'evaluated');
    assert.strictEqual(sub.evaluationStatus, 'completed');
    assert.strictEqual(completeRes.evaluation.status, 'completed');
  });

  it('8. updating an evaluation recalculates totals rather than double-counting points', async () => {
    // Update longAnswerQuestion score from 24 to 20 pts:
    // manualScore should be 18 + 20 = 38 (NOT 42 + 38 = 80).
    // finalScore should be 10 + 38 = 48 pts.
    // percentage = (48 / 60) * 100 = 80%.
    const updateRes = await evaluationService.evaluateSubmission(
      instructor1._id,
      student1Submission._id,
      {
        questionFeedback: {
          [shortAnswerQuestion._id.toString()]: {
            pointsAwarded: 18,
            comment: 'Accurate description of both mechanisms.',
          },
          [longAnswerQuestion._id.toString()]: {
            pointsAwarded: 20,
            comment: 'Revised after reviewing edge cases.',
          },
        },
        generalFeedback: 'Updated evaluation score.',
      }
    );

    const sub = updateRes.submission;
    assert.strictEqual(sub.autoScore, 10);
    assert.strictEqual(sub.manualScore, 38);
    assert.strictEqual(sub.finalScore, 48);
    assert.strictEqual(sub.score, 48);
    assert.strictEqual(sub.percentage, 80);
    assert.strictEqual(sub.passed, true);
    assert.strictEqual(sub.resultStatus, 'passed');
    assert.strictEqual(sub.status, 'evaluated');
  });

  it('9. student can see only own result; unauthorized student blocked from foreign result', async () => {
    // Student 1 can retrieve their own evaluated submission
    const student1Result = await submissionService.getSubmissionById(
      student1Submission._id,
      student1._id,
      'student'
    );
    assert.strictEqual(student1Result.finalScore, 48);
    assert.strictEqual(student1Result.resultStatus, 'passed');
    assert.strictEqual(student1Result.feedback, 'Updated evaluation score.');

    // Student callers must NEVER receive internal confidential rubric notes ('explanation')
    assert.strictEqual(student1Result.assessment.questions[0].explanation, undefined);
    assert.strictEqual(student1Result.assessment.questions[1].explanation, undefined);

    // Student 2 is blocked from viewing Student 1's submission (HTTP 403)
    await assert.rejects(
      async () => {
        await submissionService.getSubmissionById(
          student1Submission._id,
          student2._id,
          'student'
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /unauthorized access to this submission/i);
        return true;
      }
    );
  });
});
