const mongoose = require('mongoose');

const extractedQuestionSchema = new mongoose.Schema(
  {
    tempId: {
      type: String,
      required: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedText: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'file_upload'],
      default: 'mcq',
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
      default: 5,
      min: 1,
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM',
    },
    bloomLevel: {
      type: String,
      enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'],
      default: 'UNDERSTAND',
    },
    tags: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      default: 'General',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 75,
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    duplicateQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankQuestion',
      default: null,
    },
    isUnsupported: {
      type: Boolean,
      default: false,
    },
    unsupportedReason: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const questionImportJobSchema = new mongoose.Schema(
  {
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['PDF', 'DOCX', 'DOC', 'GOOGLE_FORMS'],
      required: true,
      index: true,
    },
    sourceFilename: {
      type: String,
      default: null,
    },
    sourceFileKey: {
      type: String,
      default: null,
    },
    sourceReference: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    totalDetected: {
      type: Number,
      default: 0,
    },
    totalAccepted: {
      type: Number,
      default: 0,
    },
    totalRejected: {
      type: Number,
      default: 0,
    },
    errors: {
      type: [String],
      default: [],
    },
    extractedQuestions: [extractedQuestionSchema],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

questionImportJobSchema.index({ instructorId: 1, createdAt: -1 });

questionImportJobSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const QuestionImportJob = mongoose.model('QuestionImportJob', questionImportJobSchema);
module.exports = QuestionImportJob;
