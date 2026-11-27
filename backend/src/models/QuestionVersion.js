const mongoose = require('mongoose');

const questionVersionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    questionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    answerKeySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    evaluationConfigSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    changeSummary: {
      type: String,
      default: 'Version created',
      trim: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

questionVersionSchema.index({ questionId: 1, versionNumber: -1 }, { unique: true });

questionVersionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const QuestionVersion = mongoose.model('QuestionVersion', questionVersionSchema);
module.exports = QuestionVersion;
