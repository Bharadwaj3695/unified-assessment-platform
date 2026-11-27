const mongoose = require('mongoose');
const { ProctoringSession, ProctoringEvent, Submission, Interview } = require('../models');
const storageService = require('./storage.service');

const VALID_EVENT_TYPES = [
  'session_started',
  'camera_permission_granted',
  'camera_permission_denied',
  'camera_disconnected',
  'camera_reconnected',
  'camera_unavailable',
  'camera_stream_stopped',
  'session_ended',
  'copy_blocked',
  'paste_blocked',
  'cut_blocked',
  'face_not_detected',
  'multiple_faces_detected',
  'session_interrupted',
  'page_visibility_left',
  'faculty_review_required',
  'suspicious_activity',
];

const REVIEWABLE_EVENT_TYPES = new Set([
  'camera_disconnected',
  'camera_permission_denied',
  'camera_unavailable',
  'camera_stream_stopped',
  'face_not_detected',
  'multiple_faces_detected',
  'session_interrupted',
  'page_visibility_left',
  'faculty_review_required',
  'suspicious_activity',
]);

const CLIPBOARD_EVENTS = ['copy_blocked', 'paste_blocked', 'cut_blocked'];
const SAFE_METADATA_KEYS = [
  'questionId',
  'questionType',
  'action',
  'source',
  'context',
  'reason',
  'deviceLabel',
  'error',
  'errorName',
  'errorMessage',
  'cameraRequired',
  'cameraStatus',
  'durationSeconds',
  'faceCount',
  'confidence',
  'detector',
  'note',
];

const DEFAULT_EVIDENCE_RETENTION_DAYS = Math.max(
  1,
  parseInt(process.env.PROCTORING_EVIDENCE_RETENTION_DAYS || '30', 10) || 30
);

class ProctoringService {
  async createSession({
    submissionId = null,
    studentId,
    assessmentId = null,
    interviewId = null,
    interviewSessionId = null,
    contextType = 'assessment',
    cameraRequired = false,
    configSnapshot = null,
  }) {
    if (contextType === 'assessment') {
      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        const error = new Error('Invalid submission ID');
        error.statusCode = 400;
        throw error;
      }
      const existing = await ProctoringSession.findOne({ submissionId });
      if (existing) {
        return existing;
      }
    } else if (contextType === 'interview') {
      if (!mongoose.Types.ObjectId.isValid(interviewSessionId)) {
        const error = new Error('Invalid interview session ID');
        error.statusCode = 400;
        throw error;
      }
      const existing = await ProctoringSession.findOne({ interviewSessionId });
      if (existing) {
        return existing;
      }
    }

    const cameraStatus = cameraRequired ? 'prompted' : 'not_required';

    const session = await ProctoringSession.create({
      contextType,
      submissionId,
      studentId,
      assessmentId,
      interviewId,
      interviewSessionId,
      startedAt: new Date(),
      cameraStatus,
      status: 'active',
      configSnapshot: configSnapshot || {
        cameraProctoringEnabled: Boolean(cameraRequired),
        aiProctoringEnabled: false,
        liveMonitoringEnabled: false,
        cameraPermissionRequired: Boolean(cameraRequired),
        disclosureText: '',
      },
    });

    await ProctoringEvent.create({
      sessionId: session._id,
      eventType: 'session_started',
      timestamp: new Date(),
      severity: 'info',
      source: 'system',
      reviewStatus: 'not_applicable',
      metadata: {
        cameraRequired: Boolean(cameraRequired),
        cameraStatus,
        context: contextType,
      },
    });

    return session;
  }

  async recordEvent(
    sessionId,
    actorId,
    { eventType, severity = 'info', metadata = {}, source = 'client', evidenceBuffer = null, evidenceMimeType = null }
  ) {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      const error = new Error('Invalid proctoring session ID');
      error.statusCode = 400;
      throw error;
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      const error = new Error(
        `Invalid event type: ${eventType}. Allowed types: ${VALID_EVENT_TYPES.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }

    const session = await ProctoringSession.findById(sessionId);
    if (!session) {
      const error = new Error('Proctoring session not found');
      error.statusCode = 404;
      throw error;
    }

    // Ownership verification
    if (session.studentId.toString() !== actorId.toString()) {
      let isOwningFaculty = false;
      if (session.contextType === 'interview' && session.interviewId) {
        const iv = await Interview.findById(session.interviewId).select('facultyId').lean();
        if (iv && iv.facultyId.toString() === actorId.toString()) {
          isOwningFaculty = true;
        }
      }
      if (!isOwningFaculty) {
        const error = new Error('Access denied. You do not own this proctoring session.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Sanitize metadata - strictly never persist clipboard contents or copied text
    const sanitizedMetadata = {};
    if (metadata && typeof metadata === 'object') {
      for (const key of SAFE_METADATA_KEYS) {
        if (metadata[key] !== undefined) {
          sanitizedMetadata[key] = metadata[key];
        }
      }
    }

    // Deduplication & Rate Limiting for clipboard events (prevent flooding MongoDB Atlas)
    if (CLIPBOARD_EVENTS.includes(eventType)) {
      const query = {
        sessionId: session._id,
        eventType,
        timestamp: { $gte: new Date(Date.now() - 2000) },
      };
      if (sanitizedMetadata.questionId) {
        query['metadata.questionId'] = sanitizedMetadata.questionId;
      }
      const existingRecent = await ProctoringEvent.findOne(query);
      if (existingRecent) {
        return existingRecent;
      }
    }

    // Update session camera state or completion based on event lifecycle
    if (eventType === 'camera_permission_granted' || eventType === 'camera_reconnected') {
      session.cameraStatus = eventType === 'camera_reconnected' ? 'reconnected' : 'granted';
      if (eventType === 'camera_reconnected' && Array.isArray(session.disconnectEvents) && session.disconnectEvents.length > 0) {
        const lastDisconnect = session.disconnectEvents[session.disconnectEvents.length - 1];
        if (!lastDisconnect.reconnectedAt) {
          lastDisconnect.reconnectedAt = new Date();
        }
      }
    } else if (eventType === 'camera_permission_denied') {
      session.cameraStatus = 'denied';
    } else if (eventType === 'camera_unavailable') {
      session.cameraStatus = 'unavailable';
    } else if (eventType === 'camera_disconnected' || eventType === 'camera_stream_stopped') {
      session.cameraStatus = 'disconnected';
      session.disconnectEvents = session.disconnectEvents || [];
      session.disconnectEvents.push({
        disconnectedAt: new Date(),
        reconnectedAt: null,
        reason: sanitizedMetadata.reason || eventType,
      });
    } else if (eventType === 'session_ended') {
      session.status = 'completed';
      session.endedAt = new Date();
    }

    await session.save();

    let eventSeverity = severity || 'info';
    if (CLIPBOARD_EVENTS.includes(eventType) && (!severity || severity === 'info')) {
      eventSeverity = 'low';
    } else if (
      ['face_not_detected', 'multiple_faces_detected', 'suspicious_activity', 'faculty_review_required'].includes(eventType) &&
      (!severity || severity === 'info')
    ) {
      eventSeverity = 'medium';
    }

    const reviewStatus = REVIEWABLE_EVENT_TYPES.has(eventType) ? 'pending' : 'not_applicable';

    const event = await ProctoringEvent.create({
      sessionId: session._id,
      eventType,
      timestamp: new Date(),
      severity: eventSeverity,
      source: ['client', 'ai_proctoring', 'faculty', 'system'].includes(source) ? source : 'client',
      reviewStatus,
      metadata: sanitizedMetadata,
    });

    if (evidenceBuffer && Buffer.isBuffer(evidenceBuffer) && evidenceMimeType) {
      const saved = await storageService.saveProctoringEvidence({
        buffer: evidenceBuffer,
        mimeType: evidenceMimeType,
        sessionId: session._id.toString(),
        eventId: event._id.toString(),
      });
      const retentionDays = DEFAULT_EVIDENCE_RETENTION_DAYS;
      event.evidence = {
        retained: true,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        retentionDays,
        retentionExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
        deletedAt: null,
      };
      await event.save();
    }

    return event;
  }

  async reviewEvent(eventId, reviewerUser, { decision, reviewNotes = '' }) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const error = new Error('Invalid proctoring event ID');
      error.statusCode = 400;
      throw error;
    }

    if (!['accepted', 'rejected', 'pending'].includes(decision)) {
      const error = new Error('Decision must be accepted, rejected, or pending');
      error.statusCode = 400;
      throw error;
    }

    const event = await ProctoringEvent.findById(eventId);
    if (!event) {
      const error = new Error('Proctoring event not found');
      error.statusCode = 404;
      throw error;
    }

    const session = await ProctoringSession.findById(event.sessionId)
      .populate('assessmentId', 'instructorId')
      .populate('interviewId', 'facultyId');

    if (!session) {
      const error = new Error('Parent proctoring session not found');
      error.statusCode = 404;
      throw error;
    }

    const reviewerId = (reviewerUser._id || reviewerUser.id).toString();
    if (reviewerUser.role === 'student') {
      const error = new Error('Students are not authorized to review proctoring events.');
      error.statusCode = 403;
      throw error;
    }
    if (reviewerUser.role === 'instructor') {
      const ownerId = (
        session.interviewId?.facultyId ||
        session.assessmentId?.instructorId
      )?.toString();
      if (ownerId && ownerId !== reviewerId) {
        const error = new Error('Access denied. You do not own this proctoring session.');
        error.statusCode = 403;
        throw error;
      }
    }

    event.reviewStatus = decision;
    event.reviewedBy = reviewerId;
    event.reviewedAt = new Date();
    event.reviewNotes = String(reviewNotes || '').trim();
    await event.save();

    return event;
  }

  async getEventEvidence(eventId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      const error = new Error('Invalid proctoring event ID');
      error.statusCode = 400;
      throw error;
    }

    if (requestingUser.role === 'student') {
      const error = new Error('Students are not authorized to access proctoring evidence.');
      error.statusCode = 403;
      throw error;
    }

    const event = await ProctoringEvent.findById(eventId);
    if (!event || !event.evidence?.retained || !event.evidence?.storageKey || event.evidence?.deletedAt) {
      const error = new Error('Proctoring evidence not found or expired');
      error.statusCode = 404;
      throw error;
    }

    if (event.evidence.retentionExpiresAt && new Date(event.evidence.retentionExpiresAt) < new Date()) {
      await this.purgeEventEvidence(event);
      const error = new Error('Proctoring evidence retention window has expired');
      error.statusCode = 410;
      throw error;
    }

    const session = await ProctoringSession.findById(event.sessionId)
      .populate('assessmentId', 'instructorId')
      .populate('interviewId', 'facultyId');

    if (requestingUser.role === 'instructor') {
      const ownerId = (session?.interviewId?.facultyId || session?.assessmentId?.instructorId)?.toString();
      if (!ownerId || ownerId !== (requestingUser._id || requestingUser.id).toString()) {
        const error = new Error('Access denied. You do not own this proctoring evidence.');
        error.statusCode = 403;
        throw error;
      }
    }

    const filePath = storageService.getProctoringEvidencePath(event.evidence.storageKey);
    return {
      filePath,
      mimeType: event.evidence.mimeType || 'application/octet-stream',
      retentionExpiresAt: event.evidence.retentionExpiresAt,
    };
  }

  async purgeEventEvidence(event) {
    if (event.evidence?.storageKey) {
      await storageService.deleteProctoringEvidence(event.evidence.storageKey);
    }
    event.evidence = {
      retained: false,
      storageKey: null,
      mimeType: null,
      retentionDays: event.evidence?.retentionDays || DEFAULT_EVIDENCE_RETENTION_DAYS,
      retentionExpiresAt: event.evidence?.retentionExpiresAt || null,
      deletedAt: new Date(),
    };
    await event.save();
    return event;
  }

  async endSession(sessionId, userId, reason = 'NORMAL_COMPLETION') {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      const error = new Error('Invalid proctoring session ID');
      error.statusCode = 400;
      throw error;
    }

    const session = await ProctoringSession.findById(sessionId);
    if (!session) {
      const error = new Error('Proctoring session not found');
      error.statusCode = 404;
      throw error;
    }

    if (userId && session.studentId && session.studentId.toString() !== userId.toString()) {
      let isOwningFaculty = false;
      if (session.contextType === 'interview' && session.interviewId) {
        const iv = await Interview.findById(session.interviewId).select('facultyId').lean();
        if (iv && iv.facultyId.toString() === userId.toString()) {
          isOwningFaculty = true;
        }
      }
      if (!isOwningFaculty) {
        const error = new Error('Access denied. You do not own this proctoring session.');
        error.statusCode = 403;
        throw error;
      }
    }

    if (session.status === 'completed') {
      return session;
    }

    session.status = 'completed';
    session.endedAt = new Date();
    await session.save();

    await ProctoringEvent.create({
      sessionId: session._id,
      eventType: 'session_ended',
      timestamp: new Date(),
      severity: 'info',
      source: 'system',
      reviewStatus: 'not_applicable',
      metadata: { reason },
    });

    return session;
  }

  async getSessionBySubmissionId(submissionId, userId, role) {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      const error = new Error('Invalid submission ID');
      error.statusCode = 400;
      throw error;
    }

    const submission = await Submission.findById(submissionId).populate('assessmentId');
    if (!submission) {
      const error = new Error('Submission not found');
      error.statusCode = 404;
      throw error;
    }

    // Authorization checks
    if (role === 'student' && submission.studentId.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this proctoring session');
      error.statusCode = 403;
      throw error;
    }

    if (role === 'instructor') {
      const instructorId = (
        submission.assessmentId?.instructorId?._id || submission.assessmentId?.instructorId
      )?.toString();
      if (instructorId && instructorId !== userId.toString()) {
        const error = new Error('Access denied. You do not own the assessment for this submission.');
        error.statusCode = 403;
        throw error;
      }
    }

    const session = await ProctoringSession.findOne({ submissionId })
      .populate('studentId', 'name email avatar')
      .populate('assessmentId', 'title category durationMinutes instructorId');

    if (!session) {
      return { session: null, events: [] };
    }

    const events = await ProctoringEvent.find({ sessionId: session._id }).sort({ timestamp: 1 });

    return { session, events };
  }

  async getSessionById(sessionId, userId, role) {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      const error = new Error('Invalid proctoring session ID');
      error.statusCode = 400;
      throw error;
    }

    const session = await ProctoringSession.findById(sessionId)
      .populate('studentId', 'name email avatar')
      .populate('assessmentId', 'title category durationMinutes instructorId')
      .populate('interviewId', 'title interviewType durationMinutes facultyId');

    if (!session) {
      const error = new Error('Proctoring session not found');
      error.statusCode = 404;
      throw error;
    }

    // Role verification
    if (role === 'student' && session.studentId._id.toString() !== userId.toString()) {
      const error = new Error('Unauthorized access to this proctoring session');
      error.statusCode = 403;
      throw error;
    }

    if (role === 'instructor') {
      const instructorId = (
        session.interviewId?.facultyId?._id ||
        session.interviewId?.facultyId ||
        session.assessmentId?.instructorId?._id ||
        session.assessmentId?.instructorId
      )?.toString();
      if (instructorId && instructorId !== userId.toString()) {
        const error = new Error('Access denied. You do not own the assessment for this proctoring session.');
        error.statusCode = 403;
        throw error;
      }
    }

    const events = await ProctoringEvent.find({ sessionId: session._id }).sort({ timestamp: 1 });

    return { session, events };
  }
}

module.exports = new ProctoringService();
