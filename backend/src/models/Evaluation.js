const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      unique: true,
      index: true,
    },
    evaluatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    questionFeedback: {
      type: Map,
      of: new mongoose.Schema(
        {
          pointsAwarded: { type: Number, required: true, default: 0 },
          comment: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: {},
    },
    generalFeedback: {
      type: String,
      default: '',
      trim: true,
    },
    finalScore: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'completed',
    },
    gradedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

evaluationSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (ret.questionFeedback instanceof Map) {
      ret.questionFeedback = Object.fromEntries(ret.questionFeedback);
    }
    delete ret.__v;
    return ret;
  },
});

const Evaluation = mongoose.model('Evaluation', evaluationSchema);
module.exports = Evaluation;
