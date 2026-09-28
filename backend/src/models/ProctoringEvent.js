const mongoose = require('mongoose');

const proctoringEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProctoringSession',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'session_started',
        'camera_permission_granted',
        'camera_permission_denied',
        'camera_disconnected',
        'session_ended',
        'copy_blocked',
        'paste_blocked',
        'cut_blocked',
      ],
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    severity: {
      type: String,
      enum: ['info', 'low', 'medium', 'high', 'critical', 'warn', 'warning'],
      default: 'info',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

proctoringEventSchema.index({ sessionId: 1, timestamp: 1 });

proctoringEventSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const ProctoringEvent = mongoose.model('ProctoringEvent', proctoringEventSchema);
module.exports = ProctoringEvent;
