const mongoose = require('mongoose');

const interviewTranscriptSegmentSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    interviewSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    speakerRole: {
      type: String,
      enum: ['faculty', 'student'],
      required: true,
    },
    speakerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    speakerInstitutionalId: {
      type: String,
      required: true,
      trim: true,
    },
    speakerName: {
      type: String,
      required: true,
      trim: true,
    },
    startTimestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTimestamp: {
      type: Date,
      default: null,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    status: {
      type: String,
      enum: ['final', 'unclear', 'edited'],
      default: 'final',
    },
    source: {
      type: String,
      enum: ['manual', 'ai_transcription'],
      default: 'manual',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interviewTranscriptSegmentSchema.index({ interviewId: 1, startTimestamp: 1, createdAt: 1 });

interviewTranscriptSegmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const InterviewTranscriptSegment = mongoose.model(
  'InterviewTranscriptSegment',
  interviewTranscriptSegmentSchema
);
module.exports = InterviewTranscriptSegment;
