const mongoose = require('mongoose');
const {
  Submission,
  Assessment,
  Question,
  MockTestAttempt,
  MockTest,
  User,
  Certificate,
} = require('../models');
const aiPredictorService = require('./aiPredictor.service');
const { parsePaginationParams, paginateInMemory } = require('../utils/pagination');

const VALID_ATTEMPT_TYPES = new Set(['assessment', 'mock_test', 'mock']);

function normalizeAttemptType(attemptType) {
  const raw = String(attemptType || '').trim().toLowerCase();
  if (!VALID_ATTEMPT_TYPES.has(raw)) {
    const err = new Error('Invalid exam attempt type. Expected "assessment" or "mock_test".');
    err.statusCode = 400;
    throw err;
  }
  return raw === 'mock' ? 'mock_test' : raw;
}

function isPlainAnswerPresent(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === 'object') {
    if (typeof val.code === 'string') return val.code.trim().length > 0;
    if (typeof val.sqlQuery === 'string') return val.sqlQuery.trim().length > 0;
    if (typeof val.textAnswer === 'string') return val.textAnswer.trim().length > 0;
    if (val.originalFilename || val.googleDocsUrl || val.fileKey) return true;
    return Object.keys(val).length > 0;
  }
  return String(val).trim().length > 0;
}

function isMockResponseAnswered(resp) {
  if (!resp) return false;
  return Boolean(
    resp.selectedOption ||
      (Array.isArray(resp.selectedOptions) && resp.selectedOptions.length > 0) ||
      (typeof resp.textAnswer === 'string' && resp.textAnswer.trim().length > 0) ||
      (typeof resp.code === 'string' && resp.code.trim().length > 0) ||
      (typeof resp.sqlQuery === 'string' && resp.sqlQuery.trim().length > 0) ||
      resp.fileAnswer?.originalFilename ||
      resp.fileAnswer?.fileKey
  );
}

function sanitizeExecutionResultForRole(executionResult, role) {
  if (!executionResult || typeof executionResult !== 'object') return null;
  const copy = {
    verdict: executionResult.verdict || null,
    passedCount: typeof executionResult.passedCount === 'number' ? executionResult.passedCount : null,
    totalCount: typeof executionResult.totalCount === 'number' ? executionResult.totalCount : null,
    executionTimeMs: typeof executionResult.executionTimeMs === 'number' ? executionResult.executionTimeMs : null,
    stderr: role === 'student' ? undefined : (executionResult.stderr || undefined),
  };

  if (Array.isArray(executionResult.testCases)) {
    copy.testCases = executionResult.testCases.map((tc) => {
      if (role === 'student' && tc.isHidden) {
        return {
          testCaseIndex: tc.testCaseIndex,
          passed: Boolean(tc.passed),
          verdict: tc.verdict || (tc.passed ? 'PASSED' : 'FAILED'),
          executionTimeMs: tc.executionTimeMs || 0,
          isHidden: true,
          description: 'Hidden Test Case',
        };
      }
      return {
        testCaseIndex: tc.testCaseIndex,
        passed: Boolean(tc.passed),
        verdict: tc.verdict || (tc.passed ? 'PASSED' : 'FAILED'),
        executionTimeMs: tc.executionTimeMs || 0,
        isHidden: Boolean(tc.isHidden),
        description: tc.description || '',
      };
    });
  }

  return copy;
}

class ExamReportService {
  /**
   * Retrieve exam-wise progress for a student, separating finalized evaluated exams
   * from pending evaluations.
   */
  async getStudentExamProgress(studentId, requestingUser, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      const err = new Error('Invalid student ID format');
      err.statusCode = 400;
      throw err;
    }

    const requesterId = (requestingUser._id || requestingUser.id).toString();
    if (requestingUser.role === 'student' && requesterId !== studentId.toString()) {
      const err = new Error('Access denied. You can only view your own exam progress.');
      err.statusCode = 403;
      throw err;
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    const [submissions, mockAttempts] = await Promise.all([
      Submission.find({
        studentId: studentObjectId,
        status: { $in: ['submitted', 'evaluated'] },
      })
        .populate('assessmentId', 'title category totalPoints passingScore durationMinutes instructorId')
        .populate('evaluation', 'gradedAt grade gradeLabel generalFeedback outcomeFeedback')
        .sort({ submittedAt: -1, createdAt: -1 }),
      MockTestAttempt.find({
        studentId: studentObjectId,
        status: { $in: ['SUBMITTED', 'EVALUATED'] },
      })
        .populate({
          path: 'mockTestId',
          select: 'title examination subjectId totalMarks durationMinutes ownerFacultyId',
          populate: { path: 'subjectId', select: 'name code' },
        })
        .sort({ submittedAt: -1, createdAt: -1 })
        .lean(),
    ]);

    const evaluatedExams = [];
    const pendingExams = [];

    for (const sub of submissions) {
      const asmt = sub.assessmentId;
      if (!asmt) continue;

      // Instructor callers only see submissions for assessments they own
      if (requestingUser.role === 'instructor') {
        const ownerId = (asmt.instructorId?._id || asmt.instructorId)?.toString();
        if (ownerId !== requesterId) continue;
      }

      const isFinalized = sub.status === 'evaluated' && sub.evaluationStatus !== 'pending';
      const totalMarks = sub.totalPoints || asmt.totalPoints || 100;
      const passingThreshold = typeof asmt.passingScore === 'number' ? asmt.passingScore : 60;
      const evaluatedAt = isFinalized ? (sub.evaluation?.gradedAt || sub.submittedAt || sub.updatedAt) : null;

      const entry = {
        attemptId: sub._id.toString(),
        attemptType: 'assessment',
        examId: asmt._id.toString(),
        examName: asmt.title || 'Assessment',
        examinationTag: null,
        subject: asmt.category || 'General',
        examTypeLabel: 'Assessment',
        submittedAt: sub.submittedAt || sub.createdAt,
        evaluatedAt,
        status: isFinalized ? 'evaluated' : 'pending',
        score: isFinalized ? (sub.finalScore ?? sub.score ?? 0) : null,
        totalMarks,
        percentage: isFinalized ? Number(sub.percentage ?? 0) : null,
        passingThreshold,
        passed: isFinalized ? Boolean(sub.passed) : null,
        resultLabel: isFinalized ? (sub.passed ? 'Passed' : 'Failed') : 'Pending Evaluation',
        grade: isFinalized ? (sub.evaluation?.grade || null) : null,
        gradeLabel: isFinalized ? (sub.evaluation?.gradeLabel || null) : null,
        reportAvailable: isFinalized,
        reportStatusMessage: isFinalized ? 'Report ready' : 'Report available after evaluation',
      };

      if (isFinalized) {
        evaluatedExams.push(entry);
      } else {
        pendingExams.push(entry);
      }
    }

    for (const attempt of mockAttempts) {
      const mt = attempt.mockTestId;
      if (!mt) continue;

      if (requestingUser.role === 'instructor') {
        const ownerId = (mt.ownerFacultyId?._id || mt.ownerFacultyId)?.toString();
        if (ownerId !== requesterId) continue;
      }

      const isFinalized =
        attempt.status === 'EVALUATED' && attempt.evaluationStatus !== 'PENDING_MANUAL_REVIEW';
      const totalMarks = attempt.totalMarks || mt.totalMarks || 100;
      const passingThreshold = 60;
      const percentage = typeof attempt.percentage === 'number' ? attempt.percentage : 0;
      const passed = typeof attempt.passed === 'boolean' ? attempt.passed : percentage >= passingThreshold;
      const evaluatedAt = isFinalized ? (attempt.gradedAt || attempt.submittedAt || attempt.updatedAt) : null;

      const subjectName =
        mt.subjectId?.name ||
        mt.examination ||
        'Mock Test';

      const entry = {
        attemptId: attempt._id.toString(),
        attemptType: 'mock_test',
        examId: mt._id.toString(),
        examName: mt.title || 'Mock Test',
        examinationTag: mt.examination || null,
        subject: subjectName,
        examTypeLabel: 'Mock Test',
        submittedAt: attempt.submittedAt || attempt.createdAt,
        evaluatedAt,
        status: isFinalized ? 'evaluated' : 'pending',
        score: isFinalized ? (attempt.earnedMarks ?? 0) : null,
        totalMarks,
        percentage: isFinalized ? percentage : null,
        passingThreshold,
        passed: isFinalized ? passed : null,
        resultLabel: isFinalized ? (passed ? 'Passed' : 'Failed') : 'Pending Evaluation',
        grade: null,
        gradeLabel: null,
        reportAvailable: isFinalized,
        reportStatusMessage: isFinalized ? 'Report ready' : 'Report available after evaluation',
        correctCount: isFinalized ? (attempt.correctCount ?? 0) : null,
        incorrectCount: isFinalized ? (attempt.incorrectCount ?? 0) : null,
        unansweredCount: isFinalized ? (attempt.unansweredCount ?? 0) : null,
      };

      if (isFinalized) {
        evaluatedExams.push(entry);
      } else {
        pendingExams.push(entry);
      }
    }

    // Apply optional filtering & sorting cleanly
    const search = String(options.search || '').trim().toLowerCase();
    const examTypeFilter = String(options.examType || 'all').toLowerCase();
    const resultFilter = String(options.resultFilter || 'all').toLowerCase();
    const sortBy = String(options.sortBy || 'date_desc').toLowerCase();

    const matchesSearch = (item) =>
      !search ||
      item.examName.toLowerCase().includes(search) ||
      item.subject.toLowerCase().includes(search) ||
      (item.examinationTag && item.examinationTag.toLowerCase().includes(search));

    const matchesType = (item) =>
      examTypeFilter === 'all' || item.attemptType === examTypeFilter;

    let filteredEvaluated = evaluatedExams.filter((item) => {
      if (!matchesSearch(item) || !matchesType(item)) return false;
      if (resultFilter === 'passed') return Boolean(item.passed);
      if (resultFilter === 'failed') return !item.passed;
      return true;
    });

    const filteredPending = pendingExams.filter((item) => matchesSearch(item) && matchesType(item));

    const sortFn = (a, b) => {
      let diff = 0;
      if (sortBy === 'date_asc') {
        diff = new Date(a.evaluatedAt || a.submittedAt || 0) - new Date(b.evaluatedAt || b.submittedAt || 0);
      } else if (sortBy === 'score_desc') {
        diff = (b.percentage ?? 0) - (a.percentage ?? 0);
      } else if (sortBy === 'score_asc') {
        diff = (a.percentage ?? 0) - (b.percentage ?? 0);
      } else if (sortBy === 'name_asc') {
        diff = a.examName.localeCompare(b.examName);
      } else {
        // default: date_desc
        diff = new Date(b.evaluatedAt || b.submittedAt || 0) - new Date(a.evaluatedAt || a.submittedAt || 0);
      }
      return diff || String(a.attemptId).localeCompare(String(b.attemptId));
    };

    filteredEvaluated = filteredEvaluated.sort(sortFn);
    filteredPending.sort(
      (a, b) =>
        new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0) ||
        String(a.attemptId).localeCompare(String(b.attemptId))
    );

    const passedCount = evaluatedExams.filter((e) => e.passed).length;
    const failedCount = evaluatedExams.length - passedCount;
    const avgPct =
      evaluatedExams.length > 0
        ? Math.round(
            (evaluatedExams.reduce((sum, e) => sum + (e.percentage || 0), 0) / evaluatedExams.length) * 10
          ) / 10
        : null;

    const Predictor = aiPredictorService.buildIntegrationPayload({
      evaluatedExams,
      topicBreakdown: [],
    });

    const hasEvalPagination = options.page !== undefined || options.limit !== undefined;
    const hasPendingPagination = options.pendingPage !== undefined || options.pendingLimit !== undefined;

    let returnedEvaluated = filteredEvaluated;
    let evaluatedPagination = null;
    if (hasEvalPagination) {
      const parsed = parsePaginationParams({ page: options.page, limit: options.limit }, 10, 200);
      const paged = paginateInMemory(filteredEvaluated, parsed.page, parsed.limit);
      returnedEvaluated = paged.items;
      evaluatedPagination = paged.pagination;
    }

    let returnedPending = filteredPending;
    let pendingPagination = null;
    if (hasPendingPagination) {
      const parsed = parsePaginationParams(
        { page: options.pendingPage, limit: options.pendingLimit },
        10,
        200
      );
      const paged = paginateInMemory(filteredPending, parsed.page, parsed.limit);
      returnedPending = paged.items;
      pendingPagination = paged.pagination;
    }

    return {
      evaluatedExams: returnedEvaluated,
      pendingExams: returnedPending,
      ...(evaluatedPagination
        ? { pagination: evaluatedPagination, evaluatedPagination }
        : {}),
      ...(pendingPagination ? { pendingPagination } : {}),
      summary: {
        evaluatedCount: evaluatedExams.length,
        pendingCount: pendingExams.length,
        passedCount,
        failedCount,
        averagePercentage: avgPct,
      },
      Predictor,
    };
  }

  /**
   * Generate a finalized individual exam performance report for either a Course Assessment
   * submission or a Mock Test attempt. Enforces strict RBAC and blocks pending evaluations.
   */
  async getIndividualExamReport(rawAttemptType, attemptId, requestingUser) {
    const attemptType = normalizeAttemptType(rawAttemptType);

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      const err = new Error('Invalid attempt ID format');
      err.statusCode = 400;
      throw err;
    }

    if (!['student', 'instructor', 'admin'].includes(requestingUser.role)) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    if (attemptType === 'assessment') {
      return this._buildAssessmentReport(attemptId, requestingUser);
    }
    return this._buildMockTestReport(attemptId, requestingUser);
  }

  async _buildAssessmentReport(submissionId, requestingUser) {
    const submission = await Submission.findById(submissionId)
      .populate('assessmentId')
      .populate('studentId', 'name email studentId department')
      .populate({
        path: 'evaluation',
        populate: { path: 'evaluatorId', select: 'name email facultyId department' },
      });

    if (!submission || !submission.assessmentId) {
      const err = new Error('Exam attempt not found');
      err.statusCode = 404;
      throw err;
    }

    const requesterId = (requestingUser._id || requestingUser.id).toString();
    const assessment = submission.assessmentId;
    const student = submission.studentId;

    if (requestingUser.role === 'student') {
      const ownerStudentId = (student?._id || student)?.toString();
      if (ownerStudentId !== requesterId) {
        const err = new Error('Access denied. Students can only access their own exam reports.');
        err.statusCode = 403;
        throw err;
      }
    } else if (requestingUser.role === 'instructor') {
      const ownerInstructorId = (assessment.instructorId?._id || assessment.instructorId)?.toString();
      if (ownerInstructorId !== requesterId) {
        const err = new Error('Access denied. You are not authorized to access reports for this assessment.');
        err.statusCode = 403;
        throw err;
      }
    }

    const isFinalized =
      submission.status === 'evaluated' && submission.evaluationStatus !== 'pending';
    if (!isFinalized) {
      const err = new Error('Report available after evaluation');
      err.statusCode = 409;
      throw err;
    }

    let questions;
    if (Array.isArray(submission.assignedQuestionIds) && submission.assignedQuestionIds.length > 0) {
      questions = await Question.find({ _id: { $in: submission.assignedQuestionIds } }).sort({ orderIndex: 1 });
    } else {
      questions = await Question.find({ assessmentId: assessment._id }).sort({ orderIndex: 1 });
    }

    const answersMap =
      submission.answers instanceof Map
        ? Object.fromEntries(submission.answers)
        : submission.answers || {};

    const rawFeedback = submission.evaluation?.questionFeedback;
    const feedbackMap =
      rawFeedback instanceof Map
        ? Object.fromEntries(rawFeedback)
        : rawFeedback || {};

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const topicAccumulator = new Map();
    const questionBreakdown = [];
    const improvementAreas = [];

    questions.forEach((q, idx) => {
      const qId = q._id.toString();
      const studentAns = answersMap[qId];
      const answered = isPlainAnswerPresent(studentAns);
      const fb = feedbackMap[qId] || {};
      const maxMarks = q.points || 1;

      let marksAwarded = 0;
      if (fb.pointsAwarded !== undefined && fb.pointsAwarded !== null) {
        marksAwarded = Number(fb.pointsAwarded) || 0;
      } else if (q.type === 'mcq' || q.type === 'true_false') {
        const isObjCorrect =
          answered &&
          q.correctAnswer !== undefined &&
          q.correctAnswer !== null &&
          String(studentAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        marksAwarded = isObjCorrect ? maxMarks : 0;
      }

      let qStatus = 'incorrect';
      if (!answered) {
        qStatus = 'unanswered';
        unansweredCount++;
      } else if (marksAwarded >= maxMarks) {
        qStatus = 'correct';
        correctCount++;
      } else {
        qStatus = 'incorrect';
        incorrectCount++;
      }

      // Accumulate topic breakdown ONLY when actual topic/concept metadata exists on the question
      const topicNames = [
        ...(Array.isArray(q.topics) ? q.topics : []),
        ...(Array.isArray(q.conceptTags) ? q.conceptTags : []),
      ]
        .map((t) => String(t || '').trim())
        .filter(Boolean);
      const primaryTopic = topicNames[0] || null;

      if (primaryTopic) {
        if (!topicAccumulator.has(primaryTopic)) {
          topicAccumulator.set(primaryTopic, {
            topicName: primaryTopic,
            totalQuestions: 0,
            correctCount: 0,
            earnedMarks: 0,
            maxMarks: 0,
          });
        }
        const tEntry = topicAccumulator.get(primaryTopic);
        tEntry.totalQuestions++;
        if (qStatus === 'correct') tEntry.correctCount++;
        tEntry.earnedMarks += marksAwarded;
        tEntry.maxMarks += maxMarks;
      }

      let codingDetails = null;
      if (q.type === 'code' || q.type === 'sql') {
        const ansObj = studentAns && typeof studentAns === 'object' ? studentAns : {};
        codingDetails = {
          language: ansObj.language || q.codingConfig?.defaultLanguage || (q.type === 'sql' ? 'sqlite' : null),
          submittedCode: typeof ansObj.code === 'string'
            ? Boolean(ansObj.code.trim())
            : typeof ansObj.sqlQuery === 'string'
              ? Boolean(ansObj.sqlQuery.trim())
              : answered,
          verdict: ansObj.verdict || null,
          executionTimeMs: typeof ansObj.executionTimeMs === 'number' ? ansObj.executionTimeMs : null,
        };
      }

      const comment = fb.comment ? String(fb.comment).trim() : '';
      if (qStatus !== 'correct' && (comment || primaryTopic)) {
        improvementAreas.push({
          questionNumber: idx + 1,
          topic: primaryTopic,
          note: comment || `Review Question ${idx + 1} (${marksAwarded}/${maxMarks} marks)`,
        });
      }

      questionBreakdown.push({
        questionNumber: idx + 1,
        questionId: qId,
        prompt: q.questionText || q.statement || `Question ${idx + 1}`,
        questionType: q.type,
        topic: primaryTopic,
        maxMarks,
        marksAwarded,
        status: qStatus,
        feedback: comment,
        codingDetails,
      });
    });

    const topicBreakdown = Array.from(topicAccumulator.values()).map((t) => ({
      topicName: t.topicName,
      totalQuestions: t.totalQuestions,
      correctCount: t.correctCount,
      accuracyPercentage:
        t.totalQuestions > 0 ? Math.round((t.correctCount / t.totalQuestions) * 100) : 0,
      earnedMarks: Math.round(t.earnedMarks * 100) / 100,
      maxMarks: Math.round(t.maxMarks * 100) / 100,
    }));

    const totalMarks = submission.totalPoints || assessment.totalPoints || 100;
    const score = submission.finalScore ?? submission.score ?? 0;
    const percentage = Number(submission.percentage ?? 0);
    const passingThreshold = typeof assessment.passingScore === 'number' ? assessment.passingScore : 60;
    const evaluatedAt = submission.evaluation?.gradedAt || submission.submittedAt || submission.updatedAt;

    let certDoc = null;
    try {
      certDoc = await Certificate.findOne({
        studentId: student?._id || submission.studentId,
        assessmentId: assessment._id,
        $or: [{ 'issuance.status': 'issued' }, { 'issuance.status': { $exists: false } }],
      }).select('certificateId status issuedAt verificationCode');
    } catch (_certErr) {
      certDoc = null;
    }

    const report = {
      meta: {
        attemptId: submission._id.toString(),
        attemptType: 'assessment',
        examTypeLabel: 'Assessment',
        examId: assessment._id.toString(),
        examName: assessment.title || 'Assessment',
        examinationTag: null,
        subject: assessment.category || 'General',
        submittedAt: submission.submittedAt || submission.createdAt,
        evaluatedAt,
        evaluationStatus: 'Evaluated',
        timeSpentSeconds: submission.timeSpentSeconds || 0,
        durationMinutes: assessment.durationMinutes || 60,
      },
      student: {
        id: student?._id?.toString() || null,
        name: student?.name || 'Student',
        email: student?.email || '',
        studentId: student?.studentId || null,
        department: student?.department || null,
      },
      outcome: {
        score,
        totalMarks,
        percentage,
        passingThreshold,
        passed: Boolean(submission.passed),
        resultLabel: submission.passed ? 'Passed' : 'Failed',
        evaluationStatus: 'Evaluated',
        grade: submission.evaluation?.grade || null,
        gradeLabel: submission.evaluation?.gradeLabel || null,
        autoScore: submission.autoScore ?? 0,
        manualScore: submission.manualScore ?? 0,
      },
      certification: {
        enabled: Boolean(assessment.certification?.enabled),
        eligible: Boolean(submission.evaluation?.certificateEligible),
        issued: Boolean(certDoc),
        certificateId: certDoc?.certificateId || null,
        status: certDoc
          ? certDoc.status
          : submission.evaluation?.certificateEligible
            ? 'eligible'
            : 'not_eligible',
        issuedAt: certDoc?.issuedAt || null,
      },
      counts: {
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        totalQuestions: questions.length,
      },
      questionBreakdown,
      topicBreakdown,
      feedback: {
        generalFeedback:
          submission.evaluation?.generalFeedback ||
          submission.feedback ||
          '',
        outcomeFeedback: submission.evaluation?.outcomeFeedback || '',
        evaluatorName: submission.evaluation?.evaluatorId?.name || null,
        improvementAreas,
      },
    };

    report.Predictor = aiPredictorService.buildIntegrationPayload({
      evaluatedExams: [
        {
          attemptId: report.meta.attemptId,
          attemptType: 'assessment',
          examName: report.meta.examName,
          subject: report.meta.subject,
          percentage: report.outcome.percentage,
          status: 'evaluated',
          evaluatedAt: report.meta.evaluatedAt,
        },
      ],
      topicBreakdown,
    });

    return report;
  }

  async _buildMockTestReport(attemptId, requestingUser) {
    const attempt = await MockTestAttempt.findById(attemptId)
      .populate({
        path: 'mockTestId',
        populate: { path: 'subjectId', select: 'name code' },
      })
      .populate('studentId', 'name email studentId rollNumber department')
      .populate('evaluatorId', 'name email facultyId department');

    if (!attempt || !attempt.mockTestId) {
      const err = new Error('Exam attempt not found');
      err.statusCode = 404;
      throw err;
    }

    const requesterId = (requestingUser._id || requestingUser.id).toString();
    const mockTest = attempt.mockTestId;
    const student = attempt.studentId;

    if (requestingUser.role === 'student') {
      const ownerStudentId = (student?._id || student)?.toString();
      if (ownerStudentId !== requesterId) {
        const err = new Error('Access denied. Students can only access their own exam reports.');
        err.statusCode = 403;
        throw err;
      }
    } else if (requestingUser.role === 'instructor') {
      const ownerFacultyId = (mockTest.ownerFacultyId?._id || mockTest.ownerFacultyId)?.toString();
      if (ownerFacultyId !== requesterId) {
        const err = new Error('Access denied. You are not authorized to access reports for this mock test.');
        err.statusCode = 403;
        throw err;
      }
    }

    const isFinalized =
      attempt.status === 'EVALUATED' && attempt.evaluationStatus !== 'PENDING_MANUAL_REVIEW';
    if (!isFinalized) {
      const err = new Error('Report available after evaluation');
      err.statusCode = 409;
      throw err;
    }

    const questionMap = new Map();
    (mockTest.resolvedQuestions || []).forEach((rq) => {
      if (rq.questionId) {
        questionMap.set(rq.questionId.toString(), rq);
      }
    });

    const improvementAreas = [];
    const questionBreakdown = (attempt.responses || []).map((resp, idx) => {
      const qId = resp.questionId?.toString() || `q_${idx}`;
      const rq = questionMap.get(qId);
      const snap = rq?.questionSnapshot || {};
      const answered = isMockResponseAnswered(resp);
      const maxMarks = typeof rq?.marks === 'number' ? rq.marks : (resp.maxMarks || snap.marks || 1);
      const marksAwarded = typeof resp.scoreAwarded === 'number' ? resp.scoreAwarded : 0;

      let qStatus = 'incorrect';
      if (!answered) {
        qStatus = 'unanswered';
      } else if (resp.isCorrect || marksAwarded >= maxMarks) {
        qStatus = 'correct';
      }

      const qType = (snap.questionType || snap.type || 'SINGLE_MCQ').toUpperCase();
      const topicName =
        (Array.isArray(snap.topics) && snap.topics[0]) ||
        (Array.isArray(snap.conceptTags) && snap.conceptTags[0]) ||
        null;

      let codingDetails = null;
      if (qType === 'CODING' || qType === 'CODE' || qType === 'SQL') {
        codingDetails = {
          language: resp.language || snap.evaluationConfig?.defaultLanguage || (qType === 'SQL' ? 'sqlite' : null),
          submittedCode: Boolean((resp.code && resp.code.trim()) || (resp.sqlQuery && resp.sqlQuery.trim())),
          executionResult: sanitizeExecutionResultForRole(resp.executionResult, requestingUser.role),
        };
      }

      const remark = (resp.evaluatorComment || resp.feedback || '').trim();
      if (qStatus !== 'correct' && (remark || topicName)) {
        improvementAreas.push({
          questionNumber: idx + 1,
          topic: topicName,
          note: remark || `Review Question ${idx + 1} (${marksAwarded}/${maxMarks} marks)`,
        });
      }

      return {
        questionNumber: idx + 1,
        questionId: qId,
        prompt: snap.statement || snap.questionText || `Question ${idx + 1}`,
        questionType: qType,
        topic: topicName,
        maxMarks,
        marksAwarded,
        status: qStatus,
        feedback: remark,
        codingDetails,
      };
    });

    const topicBreakdown = (attempt.topicWiseAnalytics || []).map((t) => ({
      topicName: t.topicName || 'Topic',
      totalQuestions: t.totalQuestions || 0,
      correctCount: t.correctCount || 0,
      accuracyPercentage: t.accuracyPercentage || 0,
    }));

    const totalMarks = attempt.totalMarks || mockTest.totalMarks || 100;
    const score = attempt.earnedMarks ?? 0;
    const percentage = Number(attempt.percentage ?? 0);
    const passingThreshold = 60;
    const passed = typeof attempt.passed === 'boolean' ? attempt.passed : percentage >= passingThreshold;
    const evaluatedAt = attempt.gradedAt || attempt.submittedAt || attempt.updatedAt;
    const subjectName = mockTest.subjectId?.name || mockTest.examination || 'Mock Test';

    const report = {
      meta: {
        attemptId: attempt._id.toString(),
        attemptType: 'mock_test',
        examTypeLabel: 'Mock Test',
        examId: mockTest._id.toString(),
        examName: mockTest.title || 'Mock Test',
        examinationTag: mockTest.examination || null,
        subject: subjectName,
        submittedAt: attempt.submittedAt || attempt.createdAt,
        evaluatedAt,
        evaluationStatus: 'Evaluated',
        timeSpentSeconds: attempt.timeSpentSeconds || 0,
        durationMinutes: mockTest.durationMinutes || 60,
      },
      student: {
        id: student?._id?.toString() || null,
        name: student?.name || 'Student',
        email: student?.email || '',
        studentId: student?.studentId || student?.rollNumber || null,
        department: student?.department || null,
      },
      outcome: {
        score,
        totalMarks,
        percentage,
        passingThreshold,
        passed,
        resultLabel: passed ? 'Passed' : 'Failed',
        evaluationStatus: 'Evaluated',
        grade: null,
        gradeLabel: null,
        autoScore: attempt.autoScore ?? 0,
        manualScore: attempt.manualScore ?? 0,
      },
      certification: {
        enabled: false,
        eligible: false,
        issued: false,
        certificateId: null,
        status: 'not_applicable',
        issuedAt: null,
      },
      counts: {
        correct: attempt.correctCount ?? questionBreakdown.filter((q) => q.status === 'correct').length,
        incorrect: attempt.incorrectCount ?? questionBreakdown.filter((q) => q.status === 'incorrect').length,
        unanswered: attempt.unansweredCount ?? questionBreakdown.filter((q) => q.status === 'unanswered').length,
        totalQuestions: questionBreakdown.length,
      },
      questionBreakdown,
      topicBreakdown,
      feedback: {
        generalFeedback: attempt.generalFeedback || '',
        outcomeFeedback: '',
        evaluatorName: attempt.evaluatorId?.name || null,
        improvementAreas,
      },
    };

    report.Predictor = aiPredictorService.buildIntegrationPayload({
      evaluatedExams: [
        {
          attemptId: report.meta.attemptId,
          attemptType: 'mock_test',
          examName: report.meta.examName,
          subject: report.meta.subject,
          percentage: report.outcome.percentage,
          status: 'evaluated',
          evaluatedAt: report.meta.evaluatedAt,
        },
      ],
      topicBreakdown,
    });

    return report;
  }
}

module.exports = new ExamReportService();
