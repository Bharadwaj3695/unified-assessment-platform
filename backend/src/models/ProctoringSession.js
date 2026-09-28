const mongoose = require('mongoose');

const proctoringSessionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    cameraStatus: {
      type: String,
      enum: ['not_required', 'prompted', 'granted', 'denied', 'disconnected'],
      default: 'not_required',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'terminated'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

proctoringSessionSchema.virtual('events', {
  ref: 'ProctoringEvent',
  localField: '_id',
  foreignField: 'sessionId',
});

proctoringSessionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const ProctoringSession = mongoose.model('ProctoringSession', proctoringSessionSchema);
module.exports = ProctoringSession;
