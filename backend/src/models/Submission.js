const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    answers: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'evaluated'],
      default: 'in_progress',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    deadlineAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    autoScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    resultStatus: {
      type: String,
      enum: ['pending_evaluation', 'passed', 'failed'],
      default: 'pending_evaluation',
    },
    evaluationStatus: {
      type: String,
      enum: ['not_required', 'pending', 'completed'],
      default: 'pending',
    },
    submittedReason: {
      type: String,
      enum: ['USER_SUBMITTED', 'TIME_EXPIRED', null],
      default: null,
    },
    feedback: {
      type: String,
      default: null,
      trim: true,
    },
    proctoringSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProctoringSession',
      default: null,
      index: true,
    },
    assignedQuestionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound uniqueness: exactly one submission attempt per student per assessment
submissionSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });

// Phase 6 Analytics performance indexes
submissionSchema.index({ studentId: 1, status: 1, submittedAt: -1 });
submissionSchema.index({ assessmentId: 1, status: 1 });
submissionSchema.index({ submittedAt: -1 });

submissionSchema.virtual('evaluation', {
  ref: 'Evaluation',
  localField: '_id',
  foreignField: 'submissionId',
  justOne: true,
});

submissionSchema.virtual('proctoringSession', {
  ref: 'ProctoringSession',
  localField: '_id',
  foreignField: 'submissionId',
  justOne: true,
});

submissionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (ret.answers instanceof Map) {
      ret.answers = Object.fromEntries(ret.answers);
    }
    delete ret.__v;
    return ret;
  },
});

const Submission = mongoose.model('Submission', submissionSchema);
module.exports = Submission;
