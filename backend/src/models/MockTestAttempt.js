const mongoose = require('mongoose');

const attemptResponseSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    versionNumber: {
      type: Number,
      default: 1,
    },
    selectedOption: {
      type: String,
      default: null,
    },
    selectedOptions: {
      type: [String],
      default: [],
    },
    textAnswer: {
      type: String,
      default: null,
    },
    code: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      default: null,
    },
    sqlQuery: {
      type: String,
      default: null,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    scoreAwarded: {
      type: Number,
      default: 0,
    },
    negativeMarksAwarded: {
      type: Number,
      default: 0,
    },
    maxMarks: {
      type: Number,
      default: 1,
    },
    executionResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    fileAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    evaluationStatus: {
      type: String,
      enum: ['AUTOMATIC', 'PENDING_MANUAL_REVIEW', 'MANUALLY_EVALUATED'],
      default: 'AUTOMATIC',
    },
    rubricScores: [
      {
        criterion: { type: String, default: '' },
        score: { type: Number, default: 0 },
        maxMarks: { type: Number, default: 0 },
        comment: { type: String, default: '' },
      },
    ],
    evaluatorComment: {
      type: String,
      default: '',
    },
    feedback: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const mockTestAttemptSchema = new mongoose.Schema(
  {
    mockTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MockTest',
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
      enum: ['IN_PROGRESS', 'SUBMITTED', 'EVALUATED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    deadlineAt: {
      type: Date,
      default: null,
    },
    submittedReason: {
      type: String,
      enum: ['USER_SUBMITTED', 'TIME_EXPIRED', null],
      default: null,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    responses: {
      type: [attemptResponseSchema],
      default: [],
    },
    // Evaluation Workflow Status ('COMPLETED' or 'PENDING_MANUAL_REVIEW')
    evaluationStatus: {
      type: String,
      enum: ['COMPLETED', 'PENDING_MANUAL_REVIEW'],
      default: 'COMPLETED',
      index: true,
    },
    // Separate Auto and Manual Scores
    autoScore: {
      type: Number,
      default: 0,
    },
    manualScore: {
      type: Number,
      default: 0,
    },
    // Faculty Evaluator Identity and Timestamp
    evaluatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    generalFeedback: {
      type: String,
      default: '',
      trim: true,
    },
    // Performance Summary & Analytics
    totalMarks: {
      type: Number,
      default: 0,
    },
    earnedMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    incorrectCount: {
      type: Number,
      default: 0,
    },
    unansweredCount: {
      type: Number,
      default: 0,
    },
    topicWiseAnalytics: [
      {
        topicId: { type: mongoose.Schema.Types.ObjectId },
        topicName: { type: String, default: '' },
        totalQuestions: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        accuracyPercentage: { type: Number, default: 0 },
      },
    ],
    conceptWiseAnalytics: [
      {
        concept: { type: String, default: '' },
        questionsAttempted: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        accuracyPercentage: { type: Number, default: 0 },
        confidenceScore: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
      },
    ],
    difficultyWiseAnalytics: {
      easy: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
      medium: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
      hard: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
  }
);

mockTestAttemptSchema.index({ mockTestId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { status: 'IN_PROGRESS' } });
mockTestAttemptSchema.index({ studentId: 1, createdAt: -1 });
mockTestAttemptSchema.index({ studentId: 1, status: 1, submittedAt: -1 });
mockTestAttemptSchema.index({ mockTestId: 1, status: 1 });
mockTestAttemptSchema.index({ submittedAt: -1 });

mockTestAttemptSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const MockTestAttempt = mongoose.model('MockTestAttempt', mockTestAttemptSchema);
module.exports = MockTestAttempt;
