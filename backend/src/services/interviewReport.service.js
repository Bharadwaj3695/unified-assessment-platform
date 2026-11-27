const mongoose = require('mongoose');
const {
  Interview,
  InterviewSession,
  InterviewTranscriptSegment,
  BehavioralReport,
  ProctoringSession,
  ProctoringEvent,
} = require('../models');

function createHttpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function resolveInstitutionalId(userDoc, role) {
  if (!userDoc) return role === 'faculty' ? 'FAC-UNKNOWN' : 'STU-UNKNOWN';
  if (role === 'faculty') {
    return (
      userDoc.facultyId ||
      `FAC-${String(userDoc._id || userDoc.id).slice(-6).toUpperCase()}`
    );
  }
  return (
    userDoc.studentId ||
    `STU-${String(userDoc._id || userDoc.id).slice(-6).toUpperCase()}`
  );
}

function formatTranscriptLine(seg) {
  const roleLabel = seg.speakerRole === 'faculty' ? 'Faculty' : 'Student';
  const idPart = seg.speakerInstitutionalId ? ` (${seg.speakerInstitutionalId})` : '';
  const textPart = seg.status === 'unclear' ? '[unclear]' : seg.text;
  return `${roleLabel}${idPart}: ${textPart}`;
}

class InterviewReportService {
  /**
   * Deterministic official score evaluation by assigned faculty/admin.
   * AI never sets official scores, pass/fail status, or certification eligibility.
   */
  async evaluateInterview(interviewId, facultyUser, payload) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnerOrAdmin(interview, facultyUser);

    if (interview.status === 'cancelled') {
      throw createHttpError('Cannot evaluate a cancelled interview', 400);
    }

    const questionMap = new Map(
      (interview.questions || []).map((q) => [q._id.toString(), q])
    );

    const incomingScores = Array.isArray(payload.questionScores) ? payload.questionScores : [];
    const normalizedQuestionScores = [];

    if (incomingScores.length > 0) {
      for (const item of incomingScores) {
        const qId = String(item.questionId || '');
        const qDoc = questionMap.get(qId);
        const maxMarks = qDoc ? Number(qDoc.maxMarks || 10) : Math.max(1, Number(item.maxMarks) || 10);
        const marksAwarded = Math.min(maxMarks, Math.max(0, Number(item.marksAwarded) || 0));
        const isCorrect =
          item.isCorrect !== undefined
            ? Boolean(item.isCorrect)
            : marksAwarded >= maxMarks * 0.6;

        normalizedQuestionScores.push({
          questionId: qId,
          marksAwarded,
          maxMarks,
          isCorrect,
          topic: qDoc?.topic || item.topic || 'General',
          comment: String(item.comment || '').trim(),
        });
      }
    } else if (interview.questions?.length > 0) {
      for (const q of interview.questions) {
        normalizedQuestionScores.push({
          questionId: q._id.toString(),
          marksAwarded: 0,
          maxMarks: Number(q.maxMarks || 10),
          isCorrect: false,
          topic: q.topic || 'General',
          comment: '',
        });
      }
    }

    const computedMaxScore =
      normalizedQuestionScores.length > 0
        ? normalizedQuestionScores.reduce((sum, q) => sum + q.maxMarks, 0)
        : Math.max(1, Number(payload.maxScore) || Number(interview.evaluation?.maxScore) || 100);

    const computedOfficialScore =
      normalizedQuestionScores.length > 0
        ? Math.round(normalizedQuestionScores.reduce((sum, q) => sum + q.marksAwarded, 0) * 100) / 100
        : Math.min(computedMaxScore, Math.max(0, Number(payload.officialScore) || 0));

    const percentage =
      computedMaxScore > 0
        ? Math.round((computedOfficialScore / computedMaxScore) * 1000) / 10
        : 0;
    const passingThreshold = Number(interview.passingPercentage ?? 60);
    const passed = percentage >= passingThreshold;

    const strengths = Array.isArray(payload.strengths)
      ? payload.strengths.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const improvementAreas = Array.isArray(payload.improvementAreas)
      ? payload.improvementAreas.map((s) => String(s).trim()).filter(Boolean)
      : [];

    interview.evaluation = {
      status: payload.finalize === false ? 'pending' : 'finalized',
      questionScores: normalizedQuestionScores,
      officialScore: computedOfficialScore,
      maxScore: computedMaxScore,
      percentage,
      passed,
      strengths,
      improvementAreas,
      facultyFeedback: String(payload.facultyFeedback || '').trim(),
      facultyOnlyNotes: String(payload.facultyOnlyNotes || '').trim(),
      evaluatedBy: facultyUser._id || facultyUser.id,
      evaluatedAt: new Date(),
    };

    await interview.save();
    return this.getFacultyReport(interview._id, facultyUser);
  }

  /**
   * Add a structured transcript segment using authenticated institutional identity.
   * Never lets AI invent user IDs or names.
   */
  async addTranscriptSegment(interviewId, requestingUser, payload) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId)
      .populate('facultyId', 'name email facultyId')
      .populate('studentId', 'name email studentId');

    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnerOrAdmin(interview, requestingUser);

    const session = await InterviewSession.findOne({ interviewId: interview._id }).sort({
      createdAt: -1,
    });
    if (!session) {
      throw createHttpError('Interview session must exist before recording transcript segments', 400);
    }

    const speakerRole = payload.speakerRole === 'student' ? 'student' : 'faculty';
    const speakerUser = speakerRole === 'faculty' ? interview.facultyId : interview.studentId;

    const rawText = typeof payload.text === 'string' ? payload.text.trim() : '';
    const status = payload.status === 'unclear' ? 'unclear' : payload.status === 'edited' ? 'edited' : 'final';
    if (!rawText && status !== 'unclear') {
      throw createHttpError('Transcript segment text is required unless status is unclear', 400);
    }

    const segment = await InterviewTranscriptSegment.create({
      interviewId: interview._id,
      interviewSessionId: session._id,
      speakerRole,
      speakerUserId: speakerUser._id,
      speakerInstitutionalId: resolveInstitutionalId(speakerUser, speakerRole),
      speakerName: speakerUser.name || (speakerRole === 'faculty' ? 'Faculty' : 'Student'),
      startTimestamp: payload.startTimestamp ? new Date(payload.startTimestamp) : new Date(),
      endTimestamp: payload.endTimestamp ? new Date(payload.endTimestamp) : null,
      text: status === 'unclear' && !rawText ? '[unclear]' : rawText,
      confidence:
        payload.confidence !== undefined && payload.confidence !== null
          ? Math.min(1, Math.max(0, Number(payload.confidence)))
          : null,
      status,
      source: payload.source === 'ai_transcription' ? 'ai_transcription' : 'manual',
    });

    return {
      ...segment.toJSON(),
      formattedLine: formatTranscriptLine(segment),
    };
  }

  /**
   * Retrieve structured transcript (STRICTLY FACULTY / ADMIN ONLY).
   * Students receive HTTP 403 Forbidden.
   */
  async getTranscript(interviewId, requestingUser) {
    if (requestingUser.role === 'student') {
      throw createHttpError('Access denied. Interview transcripts are restricted to faculty.', 403);
    }
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnerOrAdmin(interview, requestingUser);

    const segments = await InterviewTranscriptSegment.find({ interviewId: interview._id }).sort({
      startTimestamp: 1,
      createdAt: 1,
    });

    const formattedSegments = segments.map((seg) => ({
      ...seg.toJSON(),
      formattedLine: formatTranscriptLine(seg),
    }));

    return {
      interviewId: interview._id.toString(),
      segmentCount: formattedSegments.length,
      segments: formattedSegments,
      formattedText: formattedSegments.map((s) => s.formattedLine).join('\n'),
    };
  }

  /**
   * Student Performance Report ONLY.
   * Never includes behavioral report, proctoring evidence, faculty-only notes, or transcript.
   */
  async getStudentPerformanceReport(interviewId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId)
      .populate('facultyId', 'name email facultyId department')
      .populate('studentId', 'name email studentId department');

    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    const userId = (requestingUser._id || requestingUser.id).toString();
    if (requestingUser.role === 'student') {
      if ((interview.studentId?._id || interview.studentId).toString() !== userId) {
        throw createHttpError('Access denied. You can only view your own interview report.', 403);
      }
    } else if (requestingUser.role === 'instructor') {
      if ((interview.facultyId?._id || interview.facultyId).toString() !== userId) {
        throw createHttpError('Access denied. You do not own this interview.', 403);
      }
    } else if (requestingUser.role !== 'admin') {
      throw createHttpError('Access denied', 403);
    }

    return this._buildPerformancePayload(interview);
  }

  /**
   * Faculty Behavioral Report ONLY (STRICTLY FACULTY / ADMIN ONLY).
   */
  async getBehavioralReport(interviewId, requestingUser) {
    if (requestingUser.role === 'student') {
      throw createHttpError(
        'Access denied. Behavioral and proctoring reports are restricted to faculty.',
        403
      );
    }
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId)
      .populate('facultyId', 'name email facultyId department')
      .populate('studentId', 'name email studentId department');

    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnerOrAdmin(interview, requestingUser);

    return this._ensureAndBuildBehavioralReport(interview);
  }

  /**
   * Complete Faculty Report combining Performance + Behavioral + Transcript + Faculty Notes.
   */
  async getFacultyReport(interviewId, requestingUser) {
    if (requestingUser.role === 'student') {
      throw createHttpError(
        'Access denied. Complete faculty interview reports are restricted to faculty.',
        403
      );
    }
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId)
      .populate('facultyId', 'name email facultyId department')
      .populate('studentId', 'name email studentId department');

    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnerOrAdmin(interview, requestingUser);

    const [performanceReport, behavioralReport, transcript] = await Promise.all([
      this._buildPerformancePayload(interview),
      this._ensureAndBuildBehavioralReport(interview),
      this.getTranscript(interview._id, requestingUser),
    ]);

    return {
      performanceReport,
      behavioralReport,
      transcript,
      facultyOnlyNotes: interview.evaluation?.facultyOnlyNotes || '',
    };
  }

  /**
   * Faculty review & finalization of behavioral report (with audit trail).
   */
  async finalizeBehavioralReport(interviewId, facultyUser, { facultyReviewNotes = '', finalize = true }) {
    if (facultyUser.role === 'student') {
      throw createHttpError('Access denied', 403);
    }
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }
    this._assertFacultyOwnerOrAdmin(interview, facultyUser);

    const reportData = await this._ensureAndBuildBehavioralReport(interview);
    const reportDoc = await BehavioralReport.findById(reportData.id);

    const actorId = facultyUser._id || facultyUser.id;
    reportDoc.facultyReviewNotes = String(facultyReviewNotes || '').trim();
    reportDoc.status = finalize ? 'finalized' : 'pending_review';
    if (finalize) {
      reportDoc.finalizedBy = actorId;
      reportDoc.finalizedAt = new Date();
    }
    reportDoc.auditTrail.push({
      action: finalize ? 'BEHAVIORAL_REPORT_FINALIZED' : 'BEHAVIORAL_REPORT_NOTES_UPDATED',
      actorId,
      actorRole: facultyUser.role,
      details: { status: reportDoc.status },
      timestamp: new Date(),
    });

    await reportDoc.save();
    return this.getBehavioralReport(interview._id, facultyUser);
  }

  async _buildPerformancePayload(interview) {
    const evalObj = interview.evaluation || {};
    const qMap = new Map((interview.questions || []).map((q) => [q._id.toString(), q]));

    const topicAccumulator = new Map();
    const questionBreakdown = [];
    let correctCount = 0;
    let incorrectCount = 0;

    (evalObj.questionScores || []).forEach((qs, idx) => {
      const qDoc = qMap.get(String(qs.questionId));
      const topic = qs.topic || qDoc?.topic || 'General';
      if (qs.isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      if (!topicAccumulator.has(topic)) {
        topicAccumulator.set(topic, {
          topicName: topic,
          totalQuestions: 0,
          correctCount: 0,
          earnedMarks: 0,
          maxMarks: 0,
        });
      }
      const t = topicAccumulator.get(topic);
      t.totalQuestions++;
      if (qs.isCorrect) t.correctCount++;
      t.earnedMarks += Number(qs.marksAwarded || 0);
      t.maxMarks += Number(qs.maxMarks || 0);

      questionBreakdown.push({
        questionNumber: idx + 1,
        questionId: qs.questionId,
        prompt: qDoc?.questionText || `Question ${idx + 1}`,
        topic,
        marksAwarded: Number(qs.marksAwarded || 0),
        maxMarks: Number(qs.maxMarks || 0),
        isCorrect: Boolean(qs.isCorrect),
        comment: qs.comment || '',
      });
    });

    const topicWisePerformance = Array.from(topicAccumulator.values()).map((t) => ({
      ...t,
      accuracyPercentage:
        t.totalQuestions > 0 ? Math.round((t.correctCount / t.totalQuestions) * 100) : 0,
    }));

    return {
      interviewId: interview._id.toString(),
      title: interview.title,
      interviewType: interview.interviewType,
      status: interview.status,
      scheduledStartAt: interview.scheduledStartAt,
      scheduledEndAt: interview.scheduledEndAt,
      durationMinutes: interview.durationMinutes,
      student: {
        id: (interview.studentId?._id || interview.studentId)?.toString(),
        name: interview.studentId?.name || 'Student',
        email: interview.studentId?.email || '',
        studentId: resolveInstitutionalId(interview.studentId, 'student'),
        department: interview.studentId?.department || null,
      },
      faculty: {
        id: (interview.facultyId?._id || interview.facultyId)?.toString(),
        name: interview.facultyId?.name || 'Faculty',
        facultyId: resolveInstitutionalId(interview.facultyId, 'faculty'),
        department: interview.facultyId?.department || null,
      },
      evaluationStatus: evalObj.status || 'pending',
      officialScore: Number(evalObj.officialScore || 0),
      maxScore: Number(evalObj.maxScore || 0),
      percentage: Number(evalObj.percentage || 0),
      passingPercentage: Number(interview.passingPercentage ?? 60),
      passed: Boolean(evalObj.passed),
      counts: {
        correct: correctCount,
        incorrect: incorrectCount,
        totalQuestions: questionBreakdown.length || interview.questions?.length || 0,
      },
      questionBreakdown,
      topicWisePerformance,
      strengths: evalObj.strengths || [],
      improvementAreas: evalObj.improvementAreas || [],
      facultyFeedback: evalObj.facultyFeedback || '',
      evaluatedAt: evalObj.evaluatedAt || null,
    };
  }

  async _ensureAndBuildBehavioralReport(interview) {
    const session = await InterviewSession.findOne({ interviewId: interview._id }).sort({
      createdAt: -1,
    });
    const procSession = session?.proctoringSessionId
      ? await ProctoringSession.findById(session.proctoringSessionId)
      : await ProctoringSession.findOne({ interviewId: interview._id }).sort({ createdAt: -1 });

    const events = procSession
      ? await ProctoringEvent.find({ sessionId: procSession._id })
          .populate('reviewedBy', 'name email facultyId')
          .sort({ timestamp: 1 })
      : [];

    const observableMetrics = {
      totalEvents: events.length,
      cameraDisconnectCount: events.filter((e) =>
        ['camera_disconnected', 'camera_stream_stopped'].includes(e.eventType)
      ).length,
      cameraReconnectCount: events.filter((e) => e.eventType === 'camera_reconnected').length,
      faceNotDetectedCount: events.filter((e) => e.eventType === 'face_not_detected').length,
      multipleFacesCount: events.filter((e) => e.eventType === 'multiple_faces_detected').length,
      sessionInterruptionCount: events.filter((e) => e.eventType === 'session_interrupted').length,
      pageLeaveCount: events.filter((e) => e.eventType === 'page_visibility_left').length,
      facultyReviewRequiredCount: events.filter(
        (e) => e.reviewStatus === 'pending' || e.eventType === 'faculty_review_required'
      ).length,
    };

    let reportDoc = await BehavioralReport.findOne({ interviewId: interview._id });
    if (!reportDoc) {
      reportDoc = await BehavioralReport.create({
        interviewId: interview._id,
        interviewSessionId: session?._id || null,
        proctoringSessionId: procSession?._id || null,
        studentId: interview.studentId?._id || interview.studentId,
        facultyId: interview.facultyId?._id || interview.facultyId,
        status: observableMetrics.facultyReviewRequiredCount > 0 ? 'pending_review' : 'draft',
        observableMetrics,
      });
    } else {
      reportDoc.interviewSessionId = session?._id || reportDoc.interviewSessionId;
      reportDoc.proctoringSessionId = procSession?._id || reportDoc.proctoringSessionId;
      reportDoc.observableMetrics = observableMetrics;
      if (reportDoc.status === 'draft' && observableMetrics.facultyReviewRequiredCount > 0) {
        reportDoc.status = 'pending_review';
      }
      await reportDoc.save();
    }

    const timeline = events.map((e) => ({
      id: e._id.toString(),
      eventType: e.eventType,
      timestamp: e.timestamp,
      severity: e.severity,
      source: e.source,
      reviewStatus: e.reviewStatus,
      reviewedBy: e.reviewedBy
        ? { id: e.reviewedBy._id?.toString(), name: e.reviewedBy.name }
        : null,
      reviewedAt: e.reviewedAt,
      reviewNotes: e.reviewNotes || '',
      metadata: e.metadata || {},
      evidenceAvailable: Boolean(e.evidence?.retained && !e.evidence?.deletedAt),
      evidenceEndpoint:
        e.evidence?.retained && !e.evidence?.deletedAt
          ? `/api/proctoring/events/${e._id.toString()}/evidence`
          : null,
      retentionExpiresAt: e.evidence?.retentionExpiresAt || null,
    }));

    return {
      ...reportDoc.toJSON(),
      cameraStatus: procSession?.cameraStatus || session?.cameraConnectionStatus || 'not_required',
      cameraEvents: session?.cameraEvents || [],
      timeline,
    };
  }

  _assertFacultyOwnerOrAdmin(interview, requestingUser) {
    if (requestingUser.role === 'admin') return;
    if (requestingUser.role !== 'instructor') {
      throw createHttpError('Access denied. Faculty authorization required.', 403);
    }
    const ownerId = (interview.facultyId?._id || interview.facultyId).toString();
    const userId = (requestingUser._id || requestingUser.id).toString();
    if (ownerId !== userId) {
      throw createHttpError('Access denied. You do not own this interview.', 403);
    }
  }
}

module.exports = new InterviewReportService();
module.exports.resolveInstitutionalId = resolveInstitutionalId;
module.exports.formatTranscriptLine = formatTranscriptLine;
