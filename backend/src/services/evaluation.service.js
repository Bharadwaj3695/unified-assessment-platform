const { Evaluation, Submission, Assessment, Question, User, Notification } = require('../models');
const emailService = require('./email.service');

class EvaluationService {
  async getSubmissionsForInstructor(instructorId, { assessmentId, status, search, page = 1, limit = 10 }) {
    // Find all assessments belonging to instructor
    const assessmentQuery = { instructorId };
    if (assessmentId) {
      assessmentQuery._id = assessmentId;
    }
    const instructorAssessments = await Assessment.find(assessmentQuery).select('_id title');
    const assessmentIds = instructorAssessments.map((a) => a._id);

    const submissionQuery = { assessmentId: { $in: assessmentIds } };
    if (status) {
      submissionQuery.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const matchingStudents = await User.find({
        role: 'student',
        $or: [{ name: searchRegex }, { email: searchRegex }],
      }).select('_id');
      const matchingStudentIds = matchingStudents.map((s) => s._id);

      const matchingAssessmentIds = instructorAssessments
        .filter((a) => a.title && a.title.toLowerCase().includes(search.trim().toLowerCase()))
        .map((a) => a._id);

      submissionQuery.$or = [
        { studentId: { $in: matchingStudentIds } },
        { assessmentId: { $in: matchingAssessmentIds } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await Submission.countDocuments(submissionQuery);

    const rows = await Submission.find(submissionQuery)
      .populate('assessmentId', 'title category totalPoints passingScore')
      .populate('studentId', 'name email avatar studentId department')
      .populate('evaluation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const submissions = rows.map((sub) => {
      const json = sub.toJSON();
      json.assessment = json.assessmentId;
      json.student = json.studentId;
      delete json.assessmentId;
      delete json.studentId;
      return json;
    });

    return { total, submissions };
  }


  async evaluateSubmission(evaluatorId, submissionId, evaluationData) {
    const { questionFeedback = {}, generalFeedback = '', finalScore: clientFinalScore } = evaluationData;

    const submission = await Submission.findById(submissionId).populate('assessmentId');
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    if (submission.status === 'in_progress') {
      const error = new Error('Cannot evaluate an in-progress submission');
      error.statusCode = 400;
      throw error;
    }

    const assessment = submission.assessmentId;

    // Resource-level authorization: instructor may evaluate only submissions belonging to assessments they own.
    const ownerId = (assessment.instructorId?._id || assessment.instructorId)?.toString();
    if (ownerId !== evaluatorId.toString()) {
      const error = new Error(
        'Access denied. You are not authorized to evaluate this submission.'
      );
      error.statusCode = 403;
      throw error;
    }

    // Retrieve all questions for this assessment to validate score bounds
    const questions = await Question.find({ assessmentId: assessment._id });
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));
    const subjectiveQuestions = questions.filter(
      (q) => q.type === 'short_answer' || q.type === 'long_answer' || q.type === 'file_upload'
    );

    let calculatedManualScore = 0;
    const sanitizedFeedback = {};

    for (const [qId, fb] of Object.entries(questionFeedback)) {
      const q = questionMap.get(qId.toString());
      if (!q) {
        const error = new Error(`Question ${qId} does not belong to this assessment`);
        error.statusCode = 400;
        throw error;
      }

      if (fb.pointsAwarded === undefined || fb.pointsAwarded === null || fb.pointsAwarded === '') {
        const error = new Error(`Points awarded is required for question "${q.questionText}"`);
        error.statusCode = 400;
        throw error;
      }

      const pts = Number(fb.pointsAwarded);
      if (isNaN(pts) || pts < 0) {
        const error = new Error(`Awarded points for question "${q.questionText}" must be a non-negative number`);
        error.statusCode = 400;
        throw error;
      }

      if (pts > q.points) {
        const error = new Error(
          `Awarded points (${pts}) cannot exceed maximum points (${q.points}) for question "${q.questionText}"`
        );
        error.statusCode = 400;
        throw error;
      }

      sanitizedFeedback[qId] = {
        pointsAwarded: pts,
        comment: fb.comment ? String(fb.comment).trim() : '',
      };

      if (q.type === 'short_answer' || q.type === 'long_answer' || q.type === 'file_upload') {
        calculatedManualScore += pts;
      }
    }

    // Check whether all required subjective questions have been evaluated
    const allSubjectiveEvaluated =
      subjectiveQuestions.length === 0 ||
      (subjectiveQuestions.length > 0 &&
        subjectiveQuestions.every((sq) => sanitizedFeedback[sq._id.toString()] !== undefined));

    const autoScore = submission.autoScore || 0;
    const totalPoints = submission.totalPoints || assessment.totalPoints || 100;
    const computedFinalScore = autoScore + calculatedManualScore;

    if (allSubjectiveEvaluated) {
      const percentage =
        totalPoints > 0 ? Math.round((computedFinalScore / totalPoints) * 100 * 100) / 100 : 0;
      const passed = percentage >= (assessment.passingScore || 60);

      submission.manualScore = calculatedManualScore;
      submission.finalScore = computedFinalScore;
      submission.score = computedFinalScore;
      submission.percentage = percentage;
      submission.passed = passed;
      submission.resultStatus = passed ? 'passed' : 'failed';
      submission.status = 'evaluated';
      submission.evaluationStatus = 'completed';
    } else {
      // Incomplete subjective evaluation: do NOT calculate final PASS/FAIL
      submission.manualScore = calculatedManualScore;
      submission.finalScore = computedFinalScore;
      submission.score = computedFinalScore;
      submission.percentage = 0;
      submission.passed = false;
      submission.resultStatus = 'pending_evaluation';
      submission.status = 'submitted';
      submission.evaluationStatus = 'pending';
    }

    submission.feedback = generalFeedback;
    await submission.save();

    const evalStatus = allSubjectiveEvaluated ? 'completed' : 'pending';
    let evaluation = await Evaluation.findOne({ submissionId });
    if (evaluation) {
      evaluation.evaluatorId = evaluatorId;
      evaluation.questionFeedback = sanitizedFeedback;
      evaluation.generalFeedback = generalFeedback;
      evaluation.finalScore = computedFinalScore;
      evaluation.status = evalStatus;
      evaluation.gradedAt = new Date();
      await evaluation.save();
    } else {
      evaluation = await Evaluation.create({
        submissionId,
        evaluatorId,
        questionFeedback: sanitizedFeedback,
        generalFeedback,
        finalScore: computedFinalScore,
        status: evalStatus,
        gradedAt: new Date(),
      });
    }

    if (allSubjectiveEvaluated) {
      // Notify Student of completed evaluation
      await Notification.create({
        userId: submission.studentId,
        title: 'Assessment Evaluated',
        message: `Your assessment "${assessment.title}" has been evaluated. Score: ${submission.percentage}% (${
          submission.passed ? 'Passed' : 'Needs Improvement'
        }).`,
        type: 'grade',
        link: `/student/submissions/${submission._id}`,
      });

      try {
        const studentUser = await User.findById(submission.studentId);
        if (studentUser) {
          await emailService.sendGradeReleasedEmail(studentUser, assessment, submission);
        }
      } catch (err) {
        console.warn('[EvaluationService] Non-fatal notification error on grade release:', err.message);
      }
    }

    if (generalFeedback || Object.keys(sanitizedFeedback).length > 0) {
      // Notify Student that faculty added comments/feedback
      await Notification.create({
        userId: submission.studentId,
        title: 'New Faculty Feedback',
        message: `Your faculty has added feedback to "${assessment.title}".`,
        type: 'info',
        link: `/student/submissions/${submission._id}`,
      });
    }

    return {
      submission,
      evaluation,
    };
  }

  async sendStudentEmail(instructorId, submissionId, { subject, message }) {
    if (!subject || !subject.trim()) {
      const err = new Error('Email subject is required');
      err.statusCode = 400;
      throw err;
    }

    if (!message || !message.trim()) {
      const err = new Error('Email message body is required');
      err.statusCode = 400;
      throw err;
    }

    const submission = await Submission.findById(submissionId)
      .populate('assessmentId')
      .populate('studentId');

    if (!submission) {
      const err = new Error('Submission not found');
      err.statusCode = 404;
      throw err;
    }

    const assessment = submission.assessmentId;
    const student = submission.studentId;

    if (!student || !student.email) {
      const err = new Error('Student email address not found on record');
      err.statusCode = 404;
      throw err;
    }

    // Resource-level authorization: instructor must own the assessment
    const ownerId = (assessment.instructorId?._id || assessment.instructorId)?.toString();
    const instructor = await User.findById(instructorId);
    const isOwner = ownerId === instructorId.toString();
    const isAdmin = instructor?.role === 'admin';

    if (!isOwner && !isAdmin) {
      const err = new Error('Access denied. You do not own the assessment for this submission.');
      err.statusCode = 403;
      throw err;
    }

    // Build email template using platform design system
    const html = emailService.buildHtmlTemplate({
      title: `Academic Communication: ${assessment.title}`,
      recipientName: student.name,
      messageHtml: `
        <p>Your instructor <strong>${instructor?.name || 'Faculty Member'}</strong> has sent you a direct message regarding your assessment submission for <strong>${assessment.title}</strong>:</p>
        <div style="padding: 16px; background-color: #f8fafc; border-left: 4px solid #E05D38; margin: 16px 0; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #1e293b;">
          ${message.trim().replace(/\n/g, '<br/>')}
        </div>
        <p style="font-size: 12px; color: #64748b;">You can review your submission and faculty comments anytime in the student portal.</p>
      `,
      actionUrl: `/student/submissions`,
      actionText: 'View Assessment Feedback',
    });

    await emailService.sendMail({
      to: student.email,
      subject: subject.trim(),
      html,
    });

    // Record in AuditLog
    const { AuditLog } = require('../models');
    await AuditLog.create({
      userId: instructorId,
      action: 'FACULTY_SENT_STUDENT_EMAIL',
      entityType: 'Submission',
      entityId: submissionId.toString(),
      details: {
        recipientStudentId: student._id.toString(),
        recipientEmail: student.email,
        assessmentId: assessment._id.toString(),
        assessmentTitle: assessment.title,
        subject: subject.trim(),
      },
    });

    // Create In-App Notification for Student
    await Notification.create({
      userId: student._id,
      title: `Message from Faculty: ${instructor?.name || 'Instructor'}`,
      message: `Regarding "${assessment.title}": ${subject.trim()}`,
      type: 'info',
      link: `/student/submissions`,
    });

    return {
      success: true,
      message: `Email successfully sent to ${student.email}`,
      recipientEmail: student.email,
      subject: subject.trim(),
    };
  }
}

module.exports = new EvaluationService();
