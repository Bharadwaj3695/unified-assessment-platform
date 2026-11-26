const mongoose = require('mongoose');

const reviewedFindingSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProctoringEvent',
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    decision: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    facultyNotes: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const auditTrailEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true, trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const behavioralReportSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      unique: true,
      index: true,
    },
    interviewSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      default: null,
    },
    proctoringSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProctoringSession',
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'finalized'],
      default: 'draft',
      index: true,
    },
    observableMetrics: {
      totalEvents: { type: Number, default: 0 },
      cameraDisconnectCount: { type: Number, default: 0 },
      cameraReconnectCount: { type: Number, default: 0 },
      faceNotDetectedCount: { type: Number, default: 0 },
      multipleFacesCount: { type: Number, default: 0 },
      sessionInterruptionCount: { type: Number, default: 0 },
      pageLeaveCount: { type: Number, default: 0 },
      facultyReviewRequiredCount: { type: Number, default: 0 },
    },
    reviewedFindings: {
      type: [reviewedFindingSchema],
      default: [],
    },
    aiSummaryDraft: {
      summaryText: { type: String, default: '' },
      provider: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      disclaimer: {
        type: String,
        default:
          'Observable behavioral indicators require faculty review and do not constitute proof of misconduct or determine official scores.',
      },
    },
    facultyReviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    auditTrail: {
      type: [auditTrailEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

behavioralReportSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const BehavioralReport = mongoose.model('BehavioralReport', behavioralReportSchema);
module.exports = BehavioralReport;
