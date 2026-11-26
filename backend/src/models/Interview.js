const mongoose = require('mongoose');

const interviewQuestionSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ['bank', 'custom'],
      default: 'custom',
    },
    bankQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
    },
    legacyBankQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankQuestion',
      default: null,
    },
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    questionType: {
      type: String,
      default: 'short_answer',
      trim: true,
    },
    topic: {
      type: String,
      default: 'General',
      trim: true,
    },
    maxMarks: {
      type: Number,
      default: 10,
      min: 1,
    },
    rubricNotes: {
      type: String,
      default: '',
      trim: true,
    },
    orderIndex: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const proctoringConfigSchema = new mongoose.Schema(
  {
    cameraProctoringEnabled: {
      type: Boolean,
      default: false,
    },
    aiProctoringEnabled: {
      type: Boolean,
      default: false,
    },
    liveMonitoringEnabled: {
      type: Boolean,
      default: false,
    },
    cameraPermissionRequired: {
      type: Boolean,
      default: false,
    },
    disclosureText: {
      type: String,
      default:
        'Camera preview is used for identity presence verification during this interview session. Video is not transmitted or recorded unless explicitly enabled by institutional policy.',
      trim: true,
    },
  },
  { _id: false }
);

const interviewEvaluationItemSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
    },
    marksAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxMarks: {
      type: Number,
      default: 10,
      min: 1,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    topic: {
      type: String,
      default: 'General',
      trim: true,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Interview title is required'],
      trim: true,
      minlength: [3, 'Interview title must be at least 3 characters'],
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    interviewType: {
      type: String,
      enum: ['technical', 'viva', 'oral_assessment', 'project_review'],
      default: 'technical',
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
    scheduledStartAt: {
      type: Date,
      default: null,
      index: true,
    },
    scheduledEndAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: [5, 'Duration must be at least 5 minutes'],
      max: [240, 'Duration cannot exceed 240 minutes'],
    },
    passingPercentage: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    questions: {
      type: [interviewQuestionSchema],
      default: [],
    },
    proctoringConfig: {
      type: proctoringConfigSchema,
      default: () => ({}),
    },
    evaluation: {
      status: {
        type: String,
        enum: ['pending', 'finalized'],
        default: 'pending',
      },
      questionScores: {
        type: [interviewEvaluationItemSchema],
        default: [],
      },
      officialScore: {
        type: Number,
        default: 0,
        min: 0,
      },
      maxScore: {
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
      strengths: {
        type: [String],
        default: [],
      },
      improvementAreas: {
        type: [String],
        default: [],
      },
      facultyFeedback: {
        type: String,
        default: '',
        trim: true,
      },
      facultyOnlyNotes: {
        type: String,
        default: '',
        trim: true,
      },
      evaluatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      evaluatedAt: {
        type: Date,
        default: null,
      },
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    statusHistory: [
      {
        fromStatus: { type: String, default: null },
        toStatus: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        changedAt: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interviewSchema.index({ facultyId: 1, status: 1, scheduledStartAt: -1 });
interviewSchema.index({ studentId: 1, status: 1, scheduledStartAt: -1 });

interviewSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const Interview = mongoose.model('Interview', interviewSchema);
module.exports = Interview;
