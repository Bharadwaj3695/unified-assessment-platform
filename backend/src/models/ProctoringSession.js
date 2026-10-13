// Import Mongoose ODM library for schema definition and database interactions
const mongoose = require('mongoose');

// Schema representing an active or completed automated proctoring monitoring session
const proctoringSessionSchema = new mongoose.Schema(
  {
    // Foreign key reference to the monitored student Submission attempt
    submissionId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'Submission',
      // Mandatory relationship
      required: true,
      // Index for querying proctoring session by submission
      index: true,
    },
    // Foreign key reference to the student User taking the monitored exam
    studentId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced User model
      ref: 'User',
      // Mandatory student identity
      required: true,
      // Index for querying proctoring sessions by student
      index: true,
    },
    // Foreign key reference to the Assessment being monitored
    assessmentId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced Assessment model
      ref: 'Assessment',
      // Mandatory assessment association
      required: true,
      // Index for querying proctoring sessions by assessment
      index: true,
    },
    // Exact timestamp when proctoring telemetry monitoring commenced
    startedAt: {
      // Date timestamp
      type: Date,
      // Default to current timestamp on session creation
      default: Date.now,
    },
    // Exact timestamp when proctoring session terminated
    endedAt: {
      // Date timestamp
      type: Date,
      // Default to null while session remains active
      default: null,
    },
    // Real-time camera feed status throughout the monitored attempt
    cameraStatus: {
      // String status enum
      type: String,
      // Permitted camera status values
      enum: ['not_required', 'prompted', 'granted', 'denied', 'disconnected'],
      // Default status
      default: 'not_required',
    },
    // Proctoring session operational state ('active', 'completed', 'terminated')
    status: {
      // String state enum
      type: String,
      // Permitted lifecycle states
      enum: ['active', 'completed', 'terminated'],
      // Initial state is active upon session startup
      default: 'active',
      // Index for filtering currently active monitoring sessions
      index: true,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
    // Include virtual properties when converting to JSON
    toJSON: { virtuals: true },
    // Include virtual properties when converting to plain objects
    toObject: { virtuals: true },
  }
);

// Virtual populating associated ProctoringEvent telemetry logs linked to this session
proctoringSessionSchema.virtual('events', {
  // Referenced model name
  ref: 'ProctoringEvent',
  // Local session ID field
  localField: '_id',
  // Foreign key on ProctoringEvent model referencing this session
  foreignField: 'sessionId',
});

// Configure JSON serialization transformation
proctoringSessionSchema.set('toJSON', {
  // Include virtual properties in JSON output
  virtuals: true,
  // Transform function modifying output representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Strip internal document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register ProctoringSession model with Mongoose
const ProctoringSession = mongoose.model('ProctoringSession', proctoringSessionSchema);
// Export ProctoringSession model for proctoring services and controllers
module.exports = ProctoringSession;
