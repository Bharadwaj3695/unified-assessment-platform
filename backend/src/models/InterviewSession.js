const mongoose = require('mongoose');

const cameraEventEntrySchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ['connected', 'disconnected', 'reconnected', 'permission_denied', 'unavailable', 'stream_stopped'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    detail: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    studentJoinedAt: {
      type: Date,
      default: null,
    },
    facultyJoinedAt: {
      type: Date,
      default: null,
    },
    studentLeftAt: {
      type: Date,
      default: null,
    },
    completionReason: {
      type: String,
      default: null,
      trim: true,
    },
    proctoringSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProctoringSession',
      default: null,
    },
    cameraPermissionStatus: {
      type: String,
      enum: ['not_required', 'prompted', 'granted', 'denied', 'unavailable', 'unsupported'],
      default: 'not_required',
    },
    cameraConnectionStatus: {
      type: String,
      enum: ['not_required', 'pending', 'connected', 'disconnected', 'reconnected', 'stopped'],
      default: 'not_required',
    },
    cameraEvents: {
      type: [cameraEventEntrySchema],
      default: [],
    },
    proctoringConfigSnapshot: {
      cameraProctoringEnabled: { type: Boolean, default: false },
      aiProctoringEnabled: { type: Boolean, default: false },
      liveMonitoringEnabled: { type: Boolean, default: false },
      cameraPermissionRequired: { type: Boolean, default: false },
      disclosureText: { type: String, default: '' },
    },
    studentNotes: {
      type: String,
      default: '',
      trim: true,
    },
    studentResponses: {
      type: Map,
      of: String,
      default: {},
    },
    studentMediaControl: {
      cameraEnabled: { type: Boolean, default: true },
      micEnabled: { type: Boolean, default: true },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedAt: { type: Date, default: null },
    },
    participantMediaState: {
      faculty: {
        cameraEnabled: { type: Boolean, default: false },
        micEnabled: { type: Boolean, default: false },
        cameraPermission: { type: String, default: 'unknown' },
        micPermission: { type: String, default: 'unknown' },
        connected: { type: Boolean, default: false },
        updatedAt: { type: Date, default: null },
      },
      student: {
        cameraEnabled: { type: Boolean, default: false },
        micEnabled: { type: Boolean, default: false },
        cameraPermission: { type: String, default: 'unknown' },
        micPermission: { type: String, default: 'unknown' },
        connected: { type: Boolean, default: false },
        updatedAt: { type: Date, default: null },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interviewSessionSchema.index({ interviewId: 1, status: 1 });

interviewSessionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (ret.studentResponses instanceof Map) {
      ret.studentResponses = Object.fromEntries(ret.studentResponses);
    }
    delete ret.__v;
    return ret;
  },
});

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
module.exports = InterviewSession;
