const mongoose = require('mongoose');
const { ProctoringSession, ProctoringEvent, Submission, Assessment } = require('../models');

const VALID_EVENT_TYPES = [
  'session_started',
  'camera_permission_granted',
  'camera_permission_denied',
  'camera_disconnected',
  'session_ended',
  'copy_blocked',
  'paste_blocked',
  'cut_blocked',
];

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
  'cameraRequired',
  'cameraStatus',
];

class ProctoringService {
  async createSession({ submissionId, studentId, assessmentId, cameraRequired = false }) {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      const error = new Error('Invalid submission ID');
      error.statusCode = 400;
      throw error;
    }

    // Check if session already exists for this submission
    let session = await ProctoringSession.findOne({ submissionId });
    if (session) {
      return session;
    }

    const cameraStatus = cameraRequired ? 'prompted' : 'not_required';

    session = await ProctoringSession.create({
      submissionId,
      studentId,
      assessmentId,
      startedAt: new Date(),
      cameraStatus,
      status: 'active',
    });

    // Initial lifecycle event
    await ProctoringEvent.create({
      sessionId: session._id,
      eventType: 'session_started',
      timestamp: new Date(),
      severity: 'info',
      metadata: {
        cameraRequired: Boolean(cameraRequired),
        cameraStatus,
      },
    });

    return session;
  }

  async recordEvent(sessionId, studentId, { eventType, severity = 'info', metadata = {} }) {
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
    if (session.studentId.toString() !== studentId.toString()) {
      const error = new Error('Access denied. You do not own this proctoring session.');
      error.statusCode = 403;
      throw error;
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
    if (eventType === 'camera_permission_granted') {
      session.cameraStatus = 'granted';
    } else if (eventType === 'camera_permission_denied') {
      session.cameraStatus = 'denied';
    } else if (eventType === 'camera_disconnected') {
      session.cameraStatus = 'disconnected';
    } else if (eventType === 'session_ended') {
      session.status = 'completed';
      session.endedAt = new Date();
    }

    await session.save();

    let eventSeverity = severity || 'info';
    if (CLIPBOARD_EVENTS.includes(eventType) && (!severity || severity === 'info')) {
      eventSeverity = 'low';
    }

    const event = await ProctoringEvent.create({
      sessionId: session._id,
      eventType,
      timestamp: new Date(),
      severity: eventSeverity,
      metadata: sanitizedMetadata,
    });

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
      .populate('assessmentId', 'title category durationMinutes instructorId');

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
        session.assessmentId?.instructorId?._id || session.assessmentId?.instructorId
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
