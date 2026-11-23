const mongoose = require('mongoose');

const generatedQuestionItemSchema = new mongoose.Schema(
  {
    draftQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
    },
    statement: {
      type: String,
      required: true,
      trim: true,
    },
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
      ],
      default: 'SINGLE_MCQ',
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM',
    },
    options: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
        explanation: { type: String, default: '' },
      },
    ],
    answerKey: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    explanation: {
      type: String,
      default: '',
    },
    evaluationConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    marks: {
      type: Number,
      default: 1,
    },
    negativeMarks: {
      type: Number,
      default: 0,
    },
    conceptTags: {
      type: [String],
      default: [],
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING_REVIEW',
      index: true,
    },
    facultyNotes: {
      type: String,
      default: '',
    },
    approvedQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
    },
  },
  { _id: true }
);

const questionGenerationJobSchema = new mongoose.Schema(
  {
    ownerFacultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      default: null,
    },
    parameters: {
      learningObjective: { type: String, default: '' },
      questionType: { type: String, default: 'SINGLE_MCQ' },
      difficulty: { type: String, default: 'MEDIUM' },
      count: { type: Number, default: 5, min: 1, max: 25 },
      referenceContent: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    generatedQuestions: {
      type: [generatedQuestionItemSchema],
      default: [],
    },
    totalGenerated: {
      type: Number,
      default: 0,
    },
    approvedCount: {
      type: Number,
      default: 0,
    },
    rejectedCount: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

questionGenerationJobSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const QuestionGenerationJob = mongoose.model('QuestionGenerationJob', questionGenerationJobSchema);
module.exports = QuestionGenerationJob;
