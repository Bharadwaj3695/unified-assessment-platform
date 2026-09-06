const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false', 'code'],
      default: 'mcq',
      required: true,
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
    orderIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const Question = mongoose.model('Question', questionSchema);
module.exports = Question;
