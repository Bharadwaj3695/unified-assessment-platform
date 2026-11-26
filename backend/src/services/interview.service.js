const mongoose = require('mongoose');
const {
  Interview,
  InterviewSession,
  User,
  Question,
  BankQuestion,
  Notification,
  AuditLog,
} = require('../models');
const proctoringService = require('./proctoring.service');

const VALID_MEDIA_CONTROL_COMMANDS = new Set([
  'STUDENT_CAMERA_ENABLE',
  'STUDENT_CAMERA_DISABLE',
  'STUDENT_MIC_ENABLE',
  'STUDENT_MIC_DISABLE',
]);

function getInterviewSignaling() {
  try {
    return require('../realtime/interviewSignaling').interviewSignaling;
  } catch {
    return null;
  }
}

const VALID_TRANSITIONS = {
  draft: ['scheduled', 'ready', 'cancelled'],
  scheduled: ['ready', 'in_progress', 'cancelled'],
  ready: ['in_progress', 'scheduled', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const DEFAULT_DISCLOSURE_TEXT =
  'Camera preview is used for identity presence verification during this interview session. Video is not transmitted or recorded unless explicitly enabled by institutional policy.';

function createHttpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeProctoringConfig(rawConfig = {}) {
  const cameraProctoringEnabled = Boolean(rawConfig?.cameraProctoringEnabled);
  // Keep AI proctoring strictly independent from camera proctoring
  const aiProctoringEnabled = Boolean(rawConfig?.aiProctoringEnabled);
  const liveMonitoringEnabled = Boolean(rawConfig?.liveMonitoringEnabled);
  const cameraPermissionRequired = Boolean(
    rawConfig?.cameraPermissionRequired !== undefined
      ? rawConfig.cameraPermissionRequired
      : cameraProctoringEnabled
  );
  const disclosureText =
    typeof rawConfig?.disclosureText === 'string' && rawConfig.disclosureText.trim()
      ? rawConfig.disclosureText.trim()
      : DEFAULT_DISCLOSURE_TEXT;

  return {
    cameraProctoringEnabled,
    aiProctoringEnabled,
    liveMonitoringEnabled,
    cameraPermissionRequired,
    disclosureText,
  };
}

class InterviewService {
  async resolveInterviewQuestions(rawQuestions = []) {
    if (!Array.isArray(rawQuestions)) return [];
    const resolved = [];

    for (let idx = 0; idx < rawQuestions.length; idx++) {
      const q = rawQuestions[idx] || {};
      let questionText = typeof q.questionText === 'string' ? q.questionText.trim() : '';
      let questionType = q.questionType || 'short_answer';
      let topic = typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : 'General';
      let maxMarks = Number(q.maxMarks) > 0 ? Number(q.maxMarks) : 10;
      let bankQuestionId = null;
      let legacyBankQuestionId = null;
      let sourceType = q.sourceType === 'bank' ? 'bank' : 'custom';

      if (q.bankQuestionId && mongoose.Types.ObjectId.isValid(q.bankQuestionId)) {
        const bankDoc = await Question.findById(q.bankQuestionId).lean();
        if (bankDoc) {
          sourceType = 'bank';
          bankQuestionId = bankDoc._id;
          if (!questionText) {
            questionText = (bankDoc.statement || bankDoc.questionText || '').trim();
          }
          if (!q.questionType) {
            questionType = bankDoc.questionType || bankDoc.type || 'short_answer';
          }
          if (!q.topic && Array.isArray(bankDoc.conceptTags) && bankDoc.conceptTags[0]) {
            topic = bankDoc.conceptTags[0];
          }
          if (!q.maxMarks && (bankDoc.marks || bankDoc.points)) {
            maxMarks = Number(bankDoc.marks || bankDoc.points);
          }
        } else {
          const legacyDoc = await BankQuestion.findById(q.bankQuestionId).lean();
          if (legacyDoc) {
            sourceType = 'bank';
            legacyBankQuestionId = legacyDoc._id;
            if (!questionText) {
              questionText = (legacyDoc.questionText || '').trim();
            }
            if (!q.questionType) {
              questionType = legacyDoc.type || 'short_answer';
            }
            if (!q.topic && Array.isArray(legacyDoc.topics) && legacyDoc.topics[0]) {
              topic = legacyDoc.topics[0];
            }
            if (!q.maxMarks && legacyDoc.points) {
              maxMarks = Number(legacyDoc.points);
            }
          }
        }
      }

      if (!questionText) {
        throw createHttpError(`Question #${idx + 1} text cannot be empty`, 400);
      }

      resolved.push({
        sourceType,
        bankQuestionId,
        legacyBankQuestionId,
        questionText,
        questionType,
        topic,
        maxMarks,
        rubricNotes: typeof q.rubricNotes === 'string' ? q.rubricNotes.trim() : '',
        orderIndex: idx,
      });
    }

    return resolved;
  }

  async validateStudentUser(studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw createHttpError('Invalid student ID format', 400);
    }
    const student = await User.findOne({
      _id: studentId,
      role: 'student',
    }).select('_id name email studentId department status isActive');

    if (!student) {
      throw createHttpError('Assigned student not found or is not a valid student account', 404);
    }
    return student;
  }

  validateScheduleWindow(scheduledStartAt, scheduledEndAt) {
    if (!scheduledStartAt && !scheduledEndAt) {
      return { start: null, end: null };
    }
    const start = scheduledStartAt ? new Date(scheduledStartAt) : null;
    const end = scheduledEndAt ? new Date(scheduledEndAt) : null;

    if (start && Number.isNaN(start.getTime())) {
      throw createHttpError('Invalid scheduledStartAt timestamp', 400);
    }
    if (end && Number.isNaN(end.getTime())) {
      throw createHttpError('Invalid scheduledEndAt timestamp', 400);
    }
    if (start && end && end <= start) {
      throw createHttpError('Interview end time must be after start time', 400);
    }
    return { start, end };
  }

  async createInterview(facultyUser, payload) {
    const facultyId = facultyUser._id || facultyUser.id;
    const {
      title,
      instructions = '',
      interviewType = 'technical',
      studentId,
      scheduledStartAt = null,
      scheduledEndAt = null,
      durationMinutes = 30,
      passingPercentage = 60,
      status = 'draft',
      questions = [],
      proctoringConfig = {},
    } = payload;

    const student = await this.validateStudentUser(studentId);
    const { start, end } = this.validateScheduleWindow(scheduledStartAt, scheduledEndAt);
    const resolvedQuestions = await this.resolveInterviewQuestions(questions);
    const normalizedProctoring = normalizeProctoringConfig(proctoringConfig);

    let initialStatus = ['draft', 'scheduled', 'ready'].includes(status) ? status : 'draft';
    if (initialStatus === 'draft' && start) {
      initialStatus = payload.status === 'draft' ? 'draft' : 'scheduled';
    }
    if (initialStatus === 'scheduled' && !start) {
      throw createHttpError('Scheduled start time is required for a scheduled interview', 400);
    }

    const maxScore = resolvedQuestions.reduce((sum, q) => sum + (q.maxMarks || 10), 0);

    const interview = await Interview.create({
      title: String(title || '').trim(),
      instructions: String(instructions || '').trim(),
      interviewType,
      facultyId,
      studentId: student._id,
      scheduledStartAt: start,
      scheduledEndAt: end,
      durationMinutes: Number(durationMinutes) || 30,
      passingPercentage: passingPercentage !== undefined ? Number(passingPercentage) : 60,
      status: initialStatus,
      questions: resolvedQuestions,
      proctoringConfig: normalizedProctoring,
      evaluation: {
        status: 'pending',
        maxScore,
      },
      statusHistory: [
        {
          fromStatus: null,
          toStatus: initialStatus,
          changedBy: facultyId,
          changedAt: new Date(),
          reason: 'INTERVIEW_CREATED',
        },
      ],
    });

    if (['scheduled', 'ready'].includes(initialStatus)) {
      await this._notifyStudentAssigned(student._id, interview);
    }

    await this._audit(facultyId, 'INTERVIEW_CREATED', interview._id, {
      title: interview.title,
      studentId: student._id.toString(),
      status: initialStatus,
    });

    return this.getInterviewById(interview._id, facultyUser);
  }

  async listInterviews(requestingUser, filters = {}) {
    const userId = requestingUser._id || requestingUser.id;
    const query = {};

    if (requestingUser.role === 'student') {
      query.studentId = userId;
      // Students never see unpublished drafts
      query.status = { $ne: 'draft' };
    } else if (requestingUser.role === 'instructor') {
      query.facultyId = userId;
    }

    if (filters.status && filters.status !== 'all') {
      if (requestingUser.role === 'student' && filters.status === 'draft') {
        return [];
      }
      query.status = filters.status;
    }
    if (filters.interviewType && filters.interviewType !== 'all') {
      query.interviewType = filters.interviewType;
    }

    const interviews = await Interview.find(query)
      .populate('facultyId', 'name email facultyId department avatar')
      .populate('studentId', 'name email studentId department avatar')
      .sort({ scheduledStartAt: 1, createdAt: -1 })
      .lean();

    const search = String(filters.search || '').trim().toLowerCase();
    const filtered = search
      ? interviews.filter(
          (iv) =>
            iv.title?.toLowerCase().includes(search) ||
            iv.studentId?.name?.toLowerCase().includes(search) ||
            iv.studentId?.studentId?.toLowerCase().includes(search) ||
            iv.facultyId?.name?.toLowerCase().includes(search)
        )
      : interviews;

    const sessionDocs = await InterviewSession.find({
      interviewId: { $in: filtered.map((i) => i._id) },
    })
      .select('interviewId status startedAt endedAt cameraPermissionStatus cameraConnectionStatus proctoringSessionId')
      .lean();

    const sessionMap = new Map(sessionDocs.map((s) => [s.interviewId.toString(), s]));

    return filtered.map((iv) => {
      const sanitized = this._sanitizeInterviewForRole(iv, requestingUser.role);
      const sess = sessionMap.get(iv._id.toString()) || null;
      return {
        ...sanitized,
        id: iv._id.toString(),
        latestSession: sess ? { ...sess, id: sess._id.toString() } : null,
      };
    });
  }

  async getInterviewById(interviewId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId)
      .populate('facultyId', 'name email facultyId department avatar')
      .populate('studentId', 'name email studentId department avatar');

    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertAccess(interview, requestingUser);

    const session = await InterviewSession.findOne({ interviewId: interview._id }).sort({ createdAt: -1 });
    const plain = interview.toJSON();
    const sanitized = this._sanitizeInterviewForRole(plain, requestingUser.role);

    return {
      ...sanitized,
      session: session ? session.toJSON() : null,
    };
  }

  async updateInterview(interviewId, facultyUser, payload) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnership(interview, facultyUser);

    if (['completed', 'cancelled'].includes(interview.status)) {
      throw createHttpError(`Cannot modify an interview with status "${interview.status}"`, 400);
    }

    if (payload.title !== undefined) {
      const trimmed = String(payload.title).trim();
      if (trimmed.length < 3) {
        throw createHttpError('Interview title must be at least 3 characters', 400);
      }
      interview.title = trimmed;
    }
    if (payload.instructions !== undefined) {
      interview.instructions = String(payload.instructions).trim();
    }
    if (payload.interviewType !== undefined) {
      interview.interviewType = payload.interviewType;
    }
    if (payload.studentId !== undefined) {
      const student = await this.validateStudentUser(payload.studentId);
      interview.studentId = student._id;
    }
    if (payload.scheduledStartAt !== undefined || payload.scheduledEndAt !== undefined) {
      const nextStart =
        payload.scheduledStartAt !== undefined ? payload.scheduledStartAt : interview.scheduledStartAt;
      const nextEnd =
        payload.scheduledEndAt !== undefined ? payload.scheduledEndAt : interview.scheduledEndAt;
      const { start, end } = this.validateScheduleWindow(nextStart, nextEnd);
      interview.scheduledStartAt = start;
      interview.scheduledEndAt = end;
    }
    if (payload.durationMinutes !== undefined) {
      interview.durationMinutes = Number(payload.durationMinutes);
    }
    if (payload.passingPercentage !== undefined) {
      interview.passingPercentage = Number(payload.passingPercentage);
    }
    if (payload.questions !== undefined) {
      const resolvedQuestions = await this.resolveInterviewQuestions(payload.questions);
      interview.questions = resolvedQuestions;
      interview.evaluation.maxScore = resolvedQuestions.reduce((sum, q) => sum + (q.maxMarks || 10), 0);
    }
    if (payload.proctoringConfig !== undefined) {
      interview.proctoringConfig = normalizeProctoringConfig({
        ...interview.proctoringConfig?.toObject?.(),
        ...payload.proctoringConfig,
      });
    }

    await interview.save();
    return this.getInterviewById(interview._id, facultyUser);
  }

  async transitionStatus(interviewId, facultyUser, targetStatus, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnership(interview, facultyUser);

    const currentStatus = interview.status;
    if (currentStatus === targetStatus) {
      return this.getInterviewById(interview._id, facultyUser);
    }

    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus)) {
      throw createHttpError(
        `Invalid interview lifecycle transition from "${currentStatus}" to "${targetStatus}"`,
        400
      );
    }

    if (targetStatus === 'scheduled') {
      const nextStart = options.scheduledStartAt || interview.scheduledStartAt;
      const nextEnd = options.scheduledEndAt !== undefined ? options.scheduledEndAt : interview.scheduledEndAt;
      if (!nextStart) {
        throw createHttpError('Scheduled start time is required to schedule an interview', 400);
      }
      const { start, end } = this.validateScheduleWindow(nextStart, nextEnd);
      interview.scheduledStartAt = start;
      interview.scheduledEndAt = end;
    }

    if (targetStatus === 'cancelled') {
      interview.cancellationReason = String(options.reason || '').trim();
    }

    const actorId = facultyUser._id || facultyUser.id;
    interview.status = targetStatus;
    interview.statusHistory.push({
      fromStatus: currentStatus,
      toStatus: targetStatus,
      changedBy: actorId,
      changedAt: new Date(),
      reason: String(options.reason || `TRANSITION_${targetStatus.toUpperCase()}`),
    });

    await interview.save();

    if (['scheduled', 'ready', 'cancelled'].includes(targetStatus)) {
      await this._notifyStudentLifecycle(interview, targetStatus);
    }

    if (['completed', 'cancelled'].includes(targetStatus)) {
      await this._closeOpenSessions(interview, actorId, targetStatus.toUpperCase());
      getInterviewSignaling()?.notifySessionEnded(
        interview._id.toString(),
        targetStatus,
        options.reason || `Interview ${targetStatus}.`
      );
    }

    await this._audit(actorId, `INTERVIEW_${targetStatus.toUpperCase()}`, interview._id, {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason: options.reason || '',
    });

    return this.getInterviewById(interview._id, facultyUser);
  }

  async rescheduleInterview(interviewId, facultyUser, { scheduledStartAt, scheduledEndAt, durationMinutes }) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnership(interview, facultyUser);

    if (!['draft', 'scheduled', 'ready'].includes(interview.status)) {
      throw createHttpError(
        `Cannot reschedule an interview in "${interview.status}" status`,
        400
      );
    }

    const { start, end } = this.validateScheduleWindow(scheduledStartAt, scheduledEndAt);
    if (!start) {
      throw createHttpError('scheduledStartAt is required to reschedule', 400);
    }

    const prevStatus = interview.status;
    interview.scheduledStartAt = start;
    interview.scheduledEndAt = end;
    if (durationMinutes !== undefined) {
      interview.durationMinutes = Number(durationMinutes);
    }
    if (interview.status === 'draft') {
      interview.status = 'scheduled';
      interview.statusHistory.push({
        fromStatus: prevStatus,
        toStatus: 'scheduled',
        changedBy: facultyUser._id || facultyUser.id,
        changedAt: new Date(),
        reason: 'RESCHEDULED',
      });
    }

    await interview.save();
    await this._notifyStudentLifecycle(interview, 'rescheduled');
    return this.getInterviewById(interview._id, facultyUser);
  }

  /**
   * Backend-controlled session start / join.
   * Faculty can start a session from 'ready' or 'scheduled' (when time window reached or explicitly started).
   * Student can join an existing active session or 'ready' interview assigned strictly to them.
   */
  async startOrJoinSession(interviewId, requestingUser, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertAccess(interview, requestingUser);

    const userId = (requestingUser._id || requestingUser.id).toString();
    const isFacultyActor =
      requestingUser.role === 'instructor' || requestingUser.role === 'admin';

    if (['draft', 'cancelled'].includes(interview.status)) {
      throw createHttpError(
        `Interview session cannot be started while status is "${interview.status}"`,
        403
      );
    }

    if (interview.status === 'completed') {
      throw createHttpError('This interview session has already completed.', 400);
    }

    // Validate scheduled time window when student attempts to join
    if (!isFacultyActor) {
      if (interview.status === 'scheduled' && interview.scheduledStartAt) {
        const now = Date.now();
        const startMs = new Date(interview.scheduledStartAt).getTime();
        if (now < startMs) {
          throw createHttpError(
            'This interview is scheduled for a future time and is not yet open for joining.',
            403
          );
        }
      }
      if (interview.scheduledEndAt && Date.now() > new Date(interview.scheduledEndAt).getTime()) {
        throw createHttpError('The scheduled time window for this interview has ended.', 403);
      }
      if (!['ready', 'in_progress', 'scheduled'].includes(interview.status)) {
        throw createHttpError('Interview is not open for student participation.', 403);
      }
    }

    let session = await InterviewSession.findOne({
      interviewId: interview._id,
      status: { $in: ['pending', 'active'] },
    }).sort({ createdAt: -1 });

    const procCfg = interview.proctoringConfig || {};
    const requiresCamera = Boolean(
      procCfg.cameraProctoringEnabled || procCfg.cameraPermissionRequired
    );
    const anyProctoring = Boolean(
      procCfg.cameraProctoringEnabled ||
        procCfg.aiProctoringEnabled ||
        procCfg.liveMonitoringEnabled ||
        procCfg.cameraPermissionRequired
    );

    if (!session) {
      // Backend controls lifecycle transition when faculty starts or student joins an open ready interview
      if (!isFacultyActor && interview.status === 'scheduled') {
        // Only allow student auto-create session if scheduled time has arrived (checked above)
      }

      session = await InterviewSession.create({
        interviewId: interview._id,
        facultyId: interview.facultyId,
        studentId: interview.studentId,
        status: isFacultyActor || interview.status === 'in_progress' ? 'active' : 'active',
        startedAt: new Date(),
        facultyJoinedAt: isFacultyActor ? new Date() : null,
        studentJoinedAt: !isFacultyActor ? new Date() : null,
        cameraPermissionStatus: requiresCamera ? 'prompted' : 'not_required',
        cameraConnectionStatus: requiresCamera ? 'pending' : 'not_required',
        proctoringConfigSnapshot: {
          cameraProctoringEnabled: Boolean(procCfg.cameraProctoringEnabled),
          aiProctoringEnabled: Boolean(procCfg.aiProctoringEnabled),
          liveMonitoringEnabled: Boolean(procCfg.liveMonitoringEnabled),
          cameraPermissionRequired: Boolean(procCfg.cameraPermissionRequired),
          disclosureText: procCfg.disclosureText || DEFAULT_DISCLOSURE_TEXT,
        },
      });

      if (anyProctoring) {
        const procSession = await proctoringService.createSession({
          contextType: 'interview',
          interviewId: interview._id,
          interviewSessionId: session._id,
          studentId: interview.studentId,
          cameraRequired: requiresCamera,
          configSnapshot: session.proctoringConfigSnapshot,
        });
        session.proctoringSessionId = procSession._id;
        await session.save();
      }
    } else {
      if (session.status === 'pending') {
        session.status = 'active';
        session.startedAt = session.startedAt || new Date();
      }
      if (isFacultyActor && !session.facultyJoinedAt) {
        session.facultyJoinedAt = new Date();
      }
      if (!isFacultyActor && !session.studentJoinedAt) {
        session.studentJoinedAt = new Date();
      }
      await session.save();
    }

    if (interview.status !== 'in_progress') {
      const prevStatus = interview.status;
      interview.status = 'in_progress';
      interview.statusHistory.push({
        fromStatus: prevStatus,
        toStatus: 'in_progress',
        changedBy: userId,
        changedAt: new Date(),
        reason: isFacultyActor ? 'FACULTY_STARTED_SESSION' : 'STUDENT_JOINED_SESSION',
      });
      await interview.save();
    }

    return {
      interview: await this.getInterviewById(interview._id, requestingUser),
      session: session.toJSON(),
    };
  }

  async updateSessionCameraStatus(interviewId, requestingUser, { status, eventType, detail = '' }) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertAccess(interview, requestingUser);

    if (
      requestingUser.role === 'student' &&
      interview.studentId.toString() !== (requestingUser._id || requestingUser.id).toString()
    ) {
      throw createHttpError('Access denied', 403);
    }

    const session = await InterviewSession.findOne({
      interviewId: interview._id,
      status: { $in: ['pending', 'active'] },
    }).sort({ createdAt: -1 });

    if (!session) {
      throw createHttpError('No active interview session found', 404);
    }

    if (status === 'granted') {
      session.cameraPermissionStatus = 'granted';
      session.cameraConnectionStatus = 'connected';
      session.cameraEvents.push({ eventType: 'connected', timestamp: new Date(), detail });
    } else if (status === 'reconnected') {
      session.cameraPermissionStatus = 'granted';
      session.cameraConnectionStatus = 'reconnected';
      session.cameraEvents.push({ eventType: 'reconnected', timestamp: new Date(), detail });
    } else if (status === 'denied') {
      session.cameraPermissionStatus = 'denied';
      session.cameraConnectionStatus = 'stopped';
      session.cameraEvents.push({ eventType: 'permission_denied', timestamp: new Date(), detail });
    } else if (status === 'unavailable') {
      session.cameraPermissionStatus = 'unavailable';
      session.cameraConnectionStatus = 'stopped';
      session.cameraEvents.push({ eventType: 'unavailable', timestamp: new Date(), detail });
    } else if (status === 'unsupported') {
      session.cameraPermissionStatus = 'unsupported';
      session.cameraConnectionStatus = 'stopped';
      session.cameraEvents.push({ eventType: 'unavailable', timestamp: new Date(), detail });
    } else if (status === 'disconnected' || status === 'stopped') {
      session.cameraConnectionStatus = status === 'stopped' ? 'stopped' : 'disconnected';
      session.cameraEvents.push({
        eventType: status === 'stopped' ? 'stream_stopped' : 'disconnected',
        timestamp: new Date(),
        detail,
      });
    }

    await session.save();

    if (session.proctoringSessionId && eventType) {
      try {
        await proctoringService.recordEvent(session.proctoringSessionId, requestingUser._id || requestingUser.id, {
          eventType,
          severity: ['camera_permission_granted', 'camera_reconnected'].includes(eventType)
            ? 'info'
            : 'medium',
          metadata: { reason: detail || status, context: 'interview' },
        });
      } catch (err) {
        console.warn('[InterviewService] Non-fatal proctoring camera event error:', err.message);
      }
    }

    return session.toJSON();
  }

  async updateStudentResponses(interviewId, studentUser, { studentNotes, studentResponses }) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }
    this._assertStudentOwnership(interview, studentUser);

    if (interview.status !== 'in_progress') {
      throw createHttpError('Responses can only be saved while interview is in progress', 400);
    }

    const session = await InterviewSession.findOne({
      interviewId: interview._id,
      status: 'active',
    });
    if (!session) {
      throw createHttpError('No active session found', 404);
    }

    if (studentNotes !== undefined) {
      session.studentNotes = String(studentNotes);
    }
    if (studentResponses && typeof studentResponses === 'object') {
      for (const [k, v] of Object.entries(studentResponses)) {
        session.studentResponses.set(String(k), String(v ?? ''));
      }
    }

    await session.save();
    return session.toJSON();
  }

  async completeOrLeaveSession(interviewId, requestingUser, { action = 'complete', reason = '' } = {}) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertAccess(interview, requestingUser);

    if (interview.status === 'cancelled') {
      throw createHttpError('Cannot complete a cancelled interview', 400);
    }

    const session = await InterviewSession.findOne({
      interviewId: interview._id,
      status: { $in: ['pending', 'active'] },
    }).sort({ createdAt: -1 });

    const userId = (requestingUser._id || requestingUser.id).toString();
    const isFacultyActor =
      requestingUser.role === 'instructor' || requestingUser.role === 'admin';

    if (!isFacultyActor && action === 'leave') {
      if (session) {
        session.studentLeftAt = new Date();
        session.completionReason = reason || 'STUDENT_LEFT';
        if (session.proctoringSessionId) {
          await proctoringService
            .recordEvent(session.proctoringSessionId, userId, {
              eventType: 'session_interrupted',
              severity: 'medium',
              metadata: { reason: reason || 'Student left interview room', context: 'interview' },
            })
            .catch(() => {});
        }
        await session.save();
      }
      return this.getInterviewById(interview._id, requestingUser);
    }

    if (interview.status === 'completed') {
      return this.getInterviewById(interview._id, requestingUser);
    }

    if (!['ready', 'in_progress'].includes(interview.status)) {
      throw createHttpError(
        `Cannot complete interview from "${interview.status}" state`,
        400
      );
    }

    if (session) {
      session.status = 'completed';
      session.endedAt = new Date();
      session.completionReason = reason || (isFacultyActor ? 'FACULTY_COMPLETED' : 'STUDENT_COMPLETED');
      await session.save();

      if (session.proctoringSessionId) {
        await proctoringService
          .endSession(session.proctoringSessionId, userId, session.completionReason)
          .catch(() => {});
      }
    }

    const prevStatus = interview.status;
    interview.status = 'completed';
    interview.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: 'completed',
      changedBy: userId,
      changedAt: new Date(),
      reason: reason || 'SESSION_COMPLETED',
    });
    await interview.save();

    await this._audit(userId, 'INTERVIEW_COMPLETED', interview._id, {
      fromStatus: prevStatus,
      reason: reason || 'SESSION_COMPLETED',
    });

    getInterviewSignaling()?.notifySessionEnded(
      interview._id.toString(),
      'completed',
      reason || 'Interview session completed.'
    );

    return this.getInterviewById(interview._id, requestingUser);
  }

  async controlStudentMedia(interviewId, facultyUser, command) {
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      throw createHttpError('Invalid interview ID format', 400);
    }
    if (!VALID_MEDIA_CONTROL_COMMANDS.has(command)) {
      throw createHttpError('Invalid student media control command', 400);
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      throw createHttpError('Interview not found', 404);
    }

    this._assertFacultyOwnership(interview, facultyUser);

    if (interview.status !== 'in_progress') {
      throw createHttpError(
        `Media control requires an active in-progress interview (current status: "${interview.status}")`,
        400
      );
    }

    const session = await InterviewSession.findOne({
      interviewId: interview._id,
      status: 'active',
    }).sort({ createdAt: -1 });

    if (!session || session.studentId.toString() !== interview.studentId.toString()) {
      throw createHttpError('No active session exists for the assigned student', 400);
    }

    const actorId = facultyUser._id || facultyUser.id;
    const prev = session.studentMediaControl || { cameraEnabled: true, micEnabled: true };
    const nextControl = {
      cameraEnabled:
        command === 'STUDENT_CAMERA_ENABLE'
          ? true
          : command === 'STUDENT_CAMERA_DISABLE'
          ? false
          : prev.cameraEnabled !== false,
      micEnabled:
        command === 'STUDENT_MIC_ENABLE'
          ? true
          : command === 'STUDENT_MIC_DISABLE'
          ? false
          : prev.micEnabled !== false,
      updatedBy: actorId,
      updatedAt: new Date(),
    };

    session.studentMediaControl = nextControl;
    await session.save();

    await this._audit(actorId, `INTERVIEW_${command}`, interview._id, {
      studentId: interview.studentId.toString(),
      cameraEnabled: nextControl.cameraEnabled,
      micEnabled: nextControl.micEnabled,
    });

    return {
      command,
      studentMediaControl: {
        cameraEnabled: nextControl.cameraEnabled,
        micEnabled: nextControl.micEnabled,
      },
    };
  }

  _assertFacultyOwnership(interview, requestingUser) {
    if (requestingUser.role === 'admin') return;
    if (requestingUser.role !== 'instructor') {
      throw createHttpError('Only assigned faculty or administrators may manage this interview', 403);
    }
    const ownerId = (interview.facultyId?._id || interview.facultyId).toString();
    const userId = (requestingUser._id || requestingUser.id).toString();
    if (ownerId !== userId) {
      throw createHttpError('Access denied. You are not the assigned faculty for this interview.', 403);
    }
  }

  _assertStudentOwnership(interview, requestingUser) {
    if (requestingUser.role !== 'student') {
      throw createHttpError('Student role required', 403);
    }
    const assignedStudentId = (interview.studentId?._id || interview.studentId).toString();
    const userId = (requestingUser._id || requestingUser.id).toString();
    if (assignedStudentId !== userId) {
      throw createHttpError('Access denied. This interview is not assigned to you.', 403);
    }
  }

  _assertAccess(interview, requestingUser) {
    const userId = (requestingUser._id || requestingUser.id).toString();
    if (requestingUser.role === 'admin') return;
    if (requestingUser.role === 'instructor') {
      const ownerId = (interview.facultyId?._id || interview.facultyId).toString();
      if (ownerId !== userId) {
        throw createHttpError('Access denied. You are not the assigned faculty for this interview.', 403);
      }
      return;
    }
    if (requestingUser.role === 'student') {
      const assignedStudentId = (interview.studentId?._id || interview.studentId).toString();
      if (assignedStudentId !== userId) {
        throw createHttpError('Access denied. This interview is not assigned to you.', 403);
      }
      if (interview.status === 'draft') {
        throw createHttpError('Access denied. Draft interviews are not visible to students.', 403);
      }
      return;
    }
    throw createHttpError('Access denied', 403);
  }

  _sanitizeInterviewForRole(interviewObj, role) {
    if (role !== 'student') return interviewObj;
    const clone = { ...interviewObj };
    if (clone.evaluation) {
      clone.evaluation = {
        status: clone.evaluation.status,
        officialScore: clone.evaluation.officialScore,
        maxScore: clone.evaluation.maxScore,
        percentage: clone.evaluation.percentage,
        passed: clone.evaluation.passed,
        strengths: clone.evaluation.strengths || [],
        improvementAreas: clone.evaluation.improvementAreas || [],
        facultyFeedback: clone.evaluation.facultyFeedback || '',
        evaluatedAt: clone.evaluation.evaluatedAt || null,
        questionScores: (clone.evaluation.questionScores || []).map((qs) => ({
          questionId: qs.questionId,
          marksAwarded: qs.marksAwarded,
          maxMarks: qs.maxMarks,
          isCorrect: qs.isCorrect,
          topic: qs.topic,
          comment: qs.comment,
        })),
      };
    }
    delete clone.statusHistory;
    return clone;
  }

  async _closeOpenSessions(interview, actorId, reason) {
    const openSessions = await InterviewSession.find({
      interviewId: interview._id,
      status: { $in: ['pending', 'active'] },
    });
    for (const sess of openSessions) {
      sess.status = reason === 'CANCELLED' ? 'cancelled' : 'completed';
      sess.endedAt = new Date();
      sess.completionReason = reason;
      await sess.save();
      if (sess.proctoringSessionId) {
        await proctoringService.endSession(sess.proctoringSessionId, actorId, reason).catch(() => {});
      }
    }
  }

  async _notifyStudentAssigned(studentId, interview) {
    try {
      await Notification.create({
        userId: studentId,
        title: 'Interview Scheduled',
        message: `You have been assigned to "${interview.title}" (${interview.interviewType}).`,
        type: 'assessment',
        link: `/student/interviews/${interview._id}`,
      });
    } catch (err) {
      console.warn('[InterviewService] Non-fatal notification error:', err.message);
    }
  }

  async _notifyStudentLifecycle(interview, eventLabel) {
    try {
      await Notification.create({
        userId: interview.studentId,
        title: `Interview ${eventLabel.charAt(0).toUpperCase() + eventLabel.slice(1)}`,
        message: `Your interview "${interview.title}" status was updated (${eventLabel}).`,
        type: 'assessment',
        link: `/student/interviews/${interview._id}`,
      });
    } catch (err) {
      console.warn('[InterviewService] Non-fatal lifecycle notification error:', err.message);
    }
  }

  async _audit(userId, action, entityId, details = {}) {
    try {
      await AuditLog.create({
        userId,
        action,
        entityType: 'Interview',
        entityId: entityId.toString(),
        details,
      });
    } catch (err) {
      console.warn('[InterviewService] Non-fatal audit log error:', err.message);
    }
  }
}

module.exports = new InterviewService();
