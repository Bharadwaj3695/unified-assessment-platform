const mongoose = require('mongoose');

const bankQuestionSchema = new mongoose.Schema(
  {
    questionBankId: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    isLatest: {
      type: Boolean,
      default: true,
      index: true,
    },
    questionText: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true,
    },
    normalizedText: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'file_upload'],
      default: 'mcq',
      required: true,
      index: true,
    },
    options: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    correctAnswer: {
      type: String,
      default: null,
      trim: true,
    },
    explanation: {
      type: String,
      default: null,
      trim: true,
    },
    points: {
      type: Number,
      required: true,
      default: 5,
      min: [1, 'Question points must be at least 1'],
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM',
      index: true,
    },
    bloomLevel: {
      type: String,
      enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'],
      default: 'UNDERSTAND',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ARCHIVED'],
      default: 'APPROVED',
      index: true,
    },
    source: {
      type: String,
      enum: ['MANUAL', 'PDF', 'DOCX', 'DOC', 'GOOGLE_FORMS'],
      default: 'MANUAL',
      index: true,
    },
    sourceMetadata: {
      importJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionImportJob', default: null },
      originalFilename: { type: String, default: null },
      formsUrl: { type: String, default: null },
      rawQuestionIndex: { type: Number, default: null },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    classificationConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    classificationSource: {
      type: String,
      enum: ['AI', 'HEURISTIC', 'MANUAL'],
      default: 'MANUAL',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal search and filtering
bankQuestionSchema.index({ createdBy: 1, isLatest: 1, status: 1 });
bankQuestionSchema.index({ questionBankId: 1, version: -1 });
bankQuestionSchema.index({ category: 1, difficulty: 1, type: 1 });
bankQuestionSchema.index({ tags: 1, isLatest: 1 });

bankQuestionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const BankQuestion = mongoose.model('BankQuestion', bankQuestionSchema);
module.exports = BankQuestion;
