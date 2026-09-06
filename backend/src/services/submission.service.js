const mongoose = require('mongoose');
const { Submission, Assessment, Question, User, Evaluation, Notification } = require('../models');
const emailService = require('./email.service');

class SubmissionService {
  async startAttempt(studentId, assessmentId) {
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const error = new Error('Invalid assessment ID');
      error.statusCode = 400;
      throw error;
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const error = new Error('Assessment not found');
      error.statusCode = 404;
      throw error;
    }

    // Access rule check: must be published
    if (assessment.status !== 'published') {
      const error = new Error('This assessment is not open for attempts');
      error.statusCode = 403;
      throw error;
    }

    // Access rule check: if restricted, student must be assigned
    if (assessment.accessType === 'restricted') {
      const isAssigned =
        assessment.assignedStudents &&
        assessment.assignedStudents.some((id) => id.toString() === studentId.toString());
      if (!isAssigned) {
        const error = new Error('You are not authorized to attempt this restricted assessment.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Check existing attempt for this student and assessment
    let existing = await Submission.findOne({
      studentId,
      assessmentId,
    });

    if (existing) {
      // If already submitted or evaluated, strictly block second attempt
      if (existing.status === 'submitted' || existing.status === 'evaluated') {
        const error = new Error('You have already completed an attempt for this assessment. Only one attempt is permitted.');
        error.statusCode = 400;
        throw error;
      }

      // If in_progress, check server-authoritative timer expiry
      if (existing.status === 'in_progress') {
        const now = Date.now();
        const deadlineTime = existing.deadlineAt ? new Date(existing.deadlineAt).getTime() : null;

        if (deadlineTime && now > deadlineTime + 30000) {
          // Time has expired: auto-close attempt
          existing.status = 'submitted';
          existing.submittedReason = 'TIME_EXPIRED';
          existing.submittedAt = new Date(deadlineTime);
          existing.timeSpentSeconds = Math.round((deadlineTime - new Date(existing.startedAt).getTime()) / 1000);
          await existing.save();

          const error = new Error('The allotted time limit for this attempt has expired.');
          error.statusCode = 400;
          throw error;
        }

        return existing;
      }
    }

    // Compute server-authoritative timing
    const startedAt = new Date();
    const durationMinutes = assessment.durationMinutes || 60;
    let deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    // If assessment has a scheduled platform-wide deadline and it is sooner, respect it
    if (assessment.deadlineAt) {
      const hardDeadline = new Date(assessment.deadlineAt);
      if (hardDeadline < deadlineAt) {
        deadlineAt = hardDeadline;
      }
    }

    const submission = await Submission.create({
      studentId,
      assessmentId,
      answers: {},
      score: 0,
      autoScore: 0,
      manualScore: 0,
      finalScore: 0,
      totalPoints: assessment.totalPoints || 100,
      percentage: 0,
      passed: false,
      status: 'in_progress',
      resultStatus: 'pending_evaluation',
      evaluationStatus: 'pending',
      startedAt,
      deadlineAt,
    });

    return submission;
  }

  async autosaveAnswer(submissionId, studentId, questionId, answer) {
    if (!mongoose.Types.ObjectId.isValid(submissionId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      const error = new Error('Invalid submission or question ID format');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    // Ownership verification
    if (submission.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this submission.');
      error.statusCode = 403;
      throw error;
    }

    // Status check
    if (submission.status !== 'in_progress') {
      const error = new Error('Cannot update answers on a finalized or submitted assessment.');
      error.statusCode = 400;
      throw error;
    }

    // Server-authoritative timer check (with 30s network drift grace period)
    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      submission.status = 'submitted';
      submission.submittedReason = 'TIME_EXPIRED';
      submission.submittedAt = new Date(deadlineTime);
      await submission.save();

      const error = new Error('Assessment deadline has expired. Your attempt has been closed.');
      error.statusCode = 400;
      throw error;
    }

    // Verify question belongs to the assessment
    const question = await Question.findOne({
      _id: questionId,
      assessmentId: submission.assessmentId,
    });

    if (!question) {
      const error = new Error('Question does not belong to this assessment.');
      error.statusCode = 400;
      throw error;
    }

    // Update answer
    if (submission.answers instanceof Map) {
      submission.answers.set(questionId.toString(), answer);
    } else {
      submission.answers = {
        ...(submission.answers || {}),
        [questionId.toString()]: answer,
      };
    }

    // Authoritative elapsed time calculation
    if (submission.startedAt) {
      submission.timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(submission.startedAt).getTime()) / 1000)
      );
    }

    await submission.save();

    return {
      success: true,
      savedAt: new Date(),
      questionId,
      answer,
    };
  }

  async saveProgress(submissionId, studentId, answers) {
    const submission = await Submission.findOne({
      _id: submissionId,
      studentId,
      status: 'in_progress',
    });

    if (!submission) {
      const error = new Error('Active submission not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    // Check timer
    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    if (deadlineTime && now > deadlineTime + 30000) {
      submission.status = 'submitted';
      submission.submittedReason = 'TIME_EXPIRED';
      submission.submittedAt = new Date(deadlineTime);
      await submission.save();

      const error = new Error('Assessment deadline has expired.');
      error.statusCode = 400;
      throw error;
    }

    const currentAnswers = submission.answers ? Object.fromEntries(submission.answers) : {};
    submission.answers = { ...currentAnswers, ...(answers || {}) };

    if (submission.startedAt) {
      submission.timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(submission.startedAt).getTime()) / 1000)
      );
    }

    await submission.save();
    return submission;
  }

  async submitAssessment(submissionId, studentId, answers = null) {
    const submission = await Submission.findOne({
      _id: submissionId,
      studentId,
    });

    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    if (submission.status !== 'in_progress') {
      const error = new Error('This assessment has already been submitted');
      error.statusCode = 400;
      throw error;
    }

    const now = Date.now();
    const deadlineTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : null;
    const isExpired = deadlineTime && now > deadlineTime + 30000;

    const assessment = await Assessment.findById(submission.assessmentId);
    const questions = await Question.find({ assessmentId: submission.assessmentId });

    const currentAnswers = submission.answers ? Object.fromEntries(submission.answers) : {};
    const finalAnswers = { ...currentAnswers, ...(answers || {}) };

    let autoScore = 0;
    let totalPoints = 0;
    let hasSubjective = false;

    questions.forEach((q) => {
      totalPoints += q.points;
      const studentAnswer = finalAnswers[q._id.toString()];

      if (q.type === 'mcq' || q.type === 'true_false') {
        if (
          studentAnswer !== undefined &&
          String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
        ) {
          autoScore += q.points;
        }
      } else if (q.type === 'short_answer' || q.type === 'long_answer' || q.type === 'code') {
        hasSubjective = true;
      }
    });

    submission.answers = finalAnswers;
    submission.submittedAt = new Date();
    submission.submittedReason = isExpired ? 'TIME_EXPIRED' : 'USER_SUBMITTED';
    submission.timeSpentSeconds = Math.max(
      0,
      Math.round((submission.submittedAt.getTime() - new Date(submission.startedAt).getTime()) / 1000)
    );
    submission.autoScore = autoScore;
    submission.totalPoints = totalPoints || assessment.totalPoints || 100;

    if (hasSubjective) {
      // Subjective answers are pending instructor manual grading
      submission.manualScore = 0;
      submission.score = autoScore; // provisional score from objective
      submission.finalScore = autoScore;
      submission.percentage = Math.round((autoScore / submission.totalPoints) * 100 * 100) / 100;
      submission.passed = false;
      submission.status = 'submitted';
      submission.resultStatus = 'pending_evaluation';
      submission.evaluationStatus = 'pending';
    } else {
      // 100% objective questions - result can be finalized immediately
      const finalPercentage = submission.totalPoints > 0
        ? Math.round((autoScore / submission.totalPoints) * 100 * 100) / 100
        : 0;
      const passed = finalPercentage >= (assessment.passingScore || 60);

      submission.manualScore = 0;
      submission.score = autoScore;
      submission.finalScore = autoScore;
      submission.percentage = finalPercentage;
      submission.passed = passed;
      submission.status = 'evaluated';
      submission.resultStatus = passed ? 'passed' : 'failed';
      submission.evaluationStatus = 'completed';

      // Create automatic evaluation record
      await Evaluation.create({
        submissionId: submission._id,
        evaluatorId: assessment.instructorId,
        questionFeedback: {},
        generalFeedback: 'Automated objective evaluation completed.',
        finalScore: autoScore,
        status: 'completed',
        gradedAt: new Date(),
      });
    }

    await submission.save();

    // Notify instructor of new submission
    await Notification.create({
      userId: assessment.instructorId,
      title: 'New Assessment Submission',
      message: `A student has submitted "${assessment.title}".`,
      type: 'assessment',
      link: `/instructor/evaluate/${submission._id}`,
    });

    try {
      const [instructorUser, studentUser] = await Promise.all([
        User.findById(assessment.instructorId),
        User.findById(studentId),
      ]);
      if (instructorUser && studentUser) {
        await emailService.sendSubmissionReceivedEmail(
          instructorUser,
          studentUser,
          assessment,
          submission
        );
      }
      if (submission.status === 'evaluated' && studentUser) {
        await emailService.sendGradeReleasedEmail(studentUser, assessment, submission);
      }
    } catch (err) {
      console.warn('[SubmissionService] Non-fatal notification error on submit:', err.message);
    }

    return submission;
  }

  async getStudentSubmissions(studentId) {
    const submissions = await Submission.find({ studentId })
      .populate('assessmentId', 'title category totalPoints passingScore durationMinutes')
      .populate('evaluation')
      .sort({ createdAt: -1 });

    return submissions.map((sub) => {
      const json = sub.toJSON();
      json.assessment = json.assessmentId;
      delete json.assessmentId;
      return json;
    });
  }

  async getSubmissionById(submissionId, userId, role) {
    const submission = await Submission.findById(submissionId)
      .populate('assessmentId')
      .populate('studentId', 'name email avatar')
      .populate({
        path: 'evaluation',
        populate: { path: 'evaluatorId', select: 'name email' },
      });

    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    if (role === 'student' && submission.studentId._id.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this submission');
      error.statusCode = 403;
      throw error;
    }

    if (role === 'instructor') {
      const assessmentOwnerId = (
        submission.assessmentId?.instructorId?._id || submission.assessmentId?.instructorId
      )?.toString();
      if (assessmentOwnerId && assessmentOwnerId !== userId.toString()) {
        const error = new Error('Access denied. You do not own the assessment for this submission.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Student privacy: student callers must NEVER receive internal evaluator rubrics/metadata ('explanation').
    // correctAnswer is only revealed if submission is evaluated and allowReview is true.
    let questionProjection = '';
    if (role === 'student') {
      const allowReview =
        submission.status === 'evaluated' && submission.assessmentId?.allowReview !== false;
      questionProjection = allowReview ? '-explanation' : '-correctAnswer -explanation';
    }

    const questions = await Question.find({ assessmentId: submission.assessmentId._id })
      .select(questionProjection)
      .sort({ orderIndex: 1 });

    const json = submission.toJSON();
    json.assessment = json.assessmentId;
    if (json.assessment) {
      json.assessment.questions = questions;
    }
    json.student = json.studentId;
    delete json.assessmentId;
    delete json.studentId;

    return json;
  }
}

module.exports = new SubmissionService();
