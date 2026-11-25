const mongoose = require('mongoose');

const mockTestQuestionSnapshotSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    questionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    marks: {
      type: Number,
      default: 1,
    },
    negativeMarks: {
      type: Number,
      default: 0,
    },
    orderIndex: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const blueprintRuleSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    conceptTags: { type: [String], default: [] },
    difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD', 'ANY'], default: 'ANY' },
    questionType: {
      type: String,
      enum: [
        'SINGLE_MCQ',
        'MULTI_SELECT',
        'TRUE_FALSE',
        'FILL_BLANK',
        'SHORT_ANSWER',
        'DESCRIPTIVE',
        'CODING',
        'SQL',
        'FILE_UPLOAD',
        'ANY',
      ],
      default: 'ANY',
    },
    count: { type: Number, default: 1, min: 1 },
    marksPerQuestion: { type: Number, default: 1 },
  },
  { _id: true }
);

const mockTestSchema = new mongoose.Schema( 
  {
    title: {
      type: String,
      required: [true, 'Mock test title is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    examination: {
      type: String,
      default: 'GATE',
      trim: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    topicIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
      },
    ],
    durationMinutes: {
      type: Number,
      default: 60,
      min: 5,
    },
    totalMarks: {
      type: Number,
      default: 100,
    },
    questionCount: {
      type: Number,
      default: 0,
    },
    difficultyDistribution: {
      easy: { type: Number, default: 30 },
      medium: { type: Number, default: 50 },
      hard: { type: Number, default: 20 },
    },
    questionTypeDistribution: {
      type: Map,
      of: Number,
      default: {},
    },
    negativeMarking: {
      type: Boolean,
      default: false,
    },
    negativeMarkingRatio: {
      type: Number,
      default: 0.33,
    },
    availabilityWindow: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    attemptLimits: {
      type: Number,
      default: 1,
    },
    randomizationRules: {
      shuffleQuestions: { type: Boolean, default: false },
      shuffleOptions: { type: Boolean, default: false },
    },
    selectionMode: {
      type: String,
      enum: ['MANUAL', 'BLUEPRINT'],
      default: 'BLUEPRINT',
    },
    blueprint: {
      rules: { type: [blueprintRuleSchema], default: [] },
    },
    // The resolved, fixed, immutable question snapshots created at publication time
    resolvedQuestions: {
      type: [mockTestQuestionSnapshotSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    draftStatus: {
      type: String,
      enum: ['READY', 'INCOMPLETE'],
      default: 'READY',
    },
    isIncomplete: {
      type: Boolean,
      default: false,
    },
    draftQuestions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    ownerFacultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

mockTestSchema.index({ ownerFacultyId: 1, status: 1 });
mockTestSchema.index({ examination: 1, subjectId: 1, status: 1 });

mockTestSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const MockTest = mongoose.model('MockTest', mockTestSchema);
module.exports = MockTest;
