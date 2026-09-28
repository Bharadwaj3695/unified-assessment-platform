const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      default: 60,
      min: [1, 'Duration must be at least 1 minute'],
    },
    totalPoints: {
      type: Number,
      default: 100,
      min: [0, 'Total points cannot be negative'],
    },
    passingScore: {
      type: Number,
      default: 60,
      min: [0, 'Passing score cannot be negative'],
      max: [100, 'Passing score cannot exceed 100'],
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    deadlineAt: {
      type: Date,
      default: null,
    },
    allowReview: {
      type: Boolean,
      default: true,
    },
    accessType: {
      type: String,
      enum: ['public', 'restricted'],
      default: 'public',
      index: true,
    },
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    proctoringEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    cameraRequired: {
      type: Boolean,
      default: false,
    },
    randomization: {
      enabled: {
        type: Boolean,
        default: false,
      },
      poolCount: {
        type: Number,
        default: null,
      },
      shuffleOrder: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Phase 6 Category analytics index
assessmentSchema.index({ category: 1, status: 1 });

// Virtual for questions
assessmentSchema.virtual('questions', {
  ref: 'Question',
  localField: '_id',
  foreignField: 'assessmentId',
});

assessmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const Assessment = mongoose.model('Assessment', assessmentSchema);
module.exports = Assessment;
