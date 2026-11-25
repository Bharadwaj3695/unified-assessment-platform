const mongoose = require('mongoose');

const questionBankSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Question bank title is required'],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Question bank code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
      index: true,
    },
    examCategory: {
      type: String,
      enum: ['COMPETITIVE', 'INSTITUTIONAL', 'PRACTICE', 'PLACEMENT', 'GENERAL'],
      default: 'INSTITUTIONAL',
      index: true,
    },
    examId: {
      type: String,
      default: '',
      trim: true,
    },
    ownerFacultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    questionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    questionCount: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE', 'INSTITUTIONAL'],
      default: 'INSTITUTIONAL',
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

questionBankSchema.index({ ownerFacultyId: 1, subjectId: 1 });
questionBankSchema.index({ code: 1, isArchived: 1 });

questionBankSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);
module.exports = QuestionBank;
