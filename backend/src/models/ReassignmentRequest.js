// Import Mongoose ODM library for schema definition and database interactions
const mongoose = require('mongoose');

/**
 * Mongoose schema representing a student's formal request for reassignment
 * or retake on an assessment that was missed or failed.
 */
const reassignmentRequestSchema = new mongoose.Schema(
  {
    // Foreign key referencing the student User account requesting reassignment
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    // Foreign key referencing the target Assessment
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
      index: true,
    },
    // Student-provided detailed reason for the reassignment request (10-500 chars)
    reason: {
      type: String,
      required: [true, 'Reason for request is required'],
      trim: true,
      minlength: [10, 'Reason must contain at least 10 characters'],
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    // Request lifecycle state: pending review, approved, or rejected
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    // Foreign key referencing the instructor or administrator who reviewed the request
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Timestamp when the review action occurred
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Optional explanation or feedback provided by reviewer upon approval or rejection
    reviewNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
    // Enable virtuals in JSON outputs
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Partial unique index preventing duplicate pending requests for the same student and assessment
reassignmentRequestSchema.index(
  { studentId: 1, assessmentId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// Compound index for chronological querying of a student's request history
reassignmentRequestSchema.index({ studentId: 1, createdAt: -1 });

// Index for instructors querying requests for a given assessment
reassignmentRequestSchema.index({ assessmentId: 1, status: 1 });

// Virtual populating associated Assessment details
reassignmentRequestSchema.virtual('assessment', {
  ref: 'Assessment',
  localField: 'assessmentId',
  foreignField: '_id',
  justOne: true,
});

// Virtual populating student User details
reassignmentRequestSchema.virtual('student', {
  ref: 'User',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true,
});

// Virtual populating reviewer User details
reassignmentRequestSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true,
});

// Format JSON representation
reassignmentRequestSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

// Compile and register ReassignmentRequest model with Mongoose
const ReassignmentRequest = mongoose.model('ReassignmentRequest', reassignmentRequestSchema);

// Export ReassignmentRequest model
module.exports = ReassignmentRequest;
