// Import Mongoose ODM library for schema modeling and database operations
const mongoose = require('mongoose');

// Schema representing a student's attempt and answers for an assessment
const submissionSchema = new mongoose.Schema(
  {
    // Foreign key reference to the parent Assessment being attempted
    assessmentId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced Assessment collection
      ref: 'Assessment',
      // Mandatory relationship
      required: true,
      // Index for fast lookups by assessment
      index: true,
    },
    // Foreign key reference to the student User account who initiated this attempt
    studentId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced User collection
      ref: 'User',
      // Mandatory student identity
      required: true,
      // Index for querying submission history by student
      index: true,
    },
    // Dynamic Map storing granular answers submitted by question ID key
    answers: {
      // Mongoose Map type keyed by question string ID
      type: Map,
      // Mixed value type accommodating text strings, selected option IDs, or file upload descriptors
      of: mongoose.Schema.Types.Mixed,
      // Default to empty map
      default: {},
    },
    // Raw points scored by the student
    score: {
      // Numeric score value
      type: Number,
      // Default initial score: 0
      default: 0,
      // Enforce non-negative score
      min: 0,
    },
    // Total points possible for this specific assessment attempt
    totalPoints: {
      // Numeric total points value
      type: Number,
      // Default initial total points: 0
      default: 0,
      // Enforce non-negative point total
      min: 0,
    },
    // Percentage score achieved (0% to 100%)
    percentage: {
      // Numeric percentage value
      type: Number,
      // Default initial percentage: 0
      default: 0,
      // Minimum percentage bound
      min: 0,
      // Maximum percentage bound
      max: 100,
    },
    // Flag indicating whether student score met or exceeded passingScore threshold
    passed: {
      // Boolean passing flag
      type: Boolean,
      // Default to false until graded
      default: false,
    },
    // Attempt lifecycle state: 'in_progress', 'submitted', or 'evaluated'
    status: {
      // String state enum
      type: String,
      // Permitted lifecycle states
      enum: ['in_progress', 'submitted', 'evaluated'],
      // Newly created attempts begin in 'in_progress' state
      default: 'in_progress',
      // Index for filtering submissions queue
      index: true,
    },
    // Exact timestamp when student initiated the assessment attempt
    startedAt: {
      // Date timestamp
      type: Date,
      // Default to current timestamp on creation
      default: Date.now,
    },
    // Dynamic attempt deadline calculated from startedAt + assessment durationMinutes
    deadlineAt: {
      // Date timestamp
      type: Date,
      // Default to null until attempt is started
      default: null,
    },
    // Exact timestamp when student submitted or timer expired
    submittedAt: {
      // Date timestamp
      type: Date,
      // Default to null while in progress
      default: null,
    },
    // Cumulative duration in seconds spent answering questions
    timeSpentSeconds: {
      // Numeric elapsed seconds
      type: Number,
      // Default to 0 seconds
      default: 0,
    },
    // Points earned automatically from objective question types (MCQ, True/False)
    autoScore: {
      // Numeric automated points
      type: Number,
      // Default to 0
      default: 0,
      // Non-negative bound
      min: 0,
    },
    // Points awarded by instructor during manual subjective evaluation
    manualScore: {
      // Numeric manual points
      type: Number,
      // Default to 0
      default: 0,
      // Non-negative bound
      min: 0,
    },
    // Final composite score summing autoScore and manualScore
    finalScore: {
      // Numeric composite points
      type: Number,
      // Default to 0
      default: 0,
      // Non-negative bound
      min: 0,
    },
    // Overall academic result status ('pending_evaluation', 'passed', 'failed')
    resultStatus: {
      // String type
      type: String,
      // Permitted academic results
      enum: ['pending_evaluation', 'passed', 'failed'],
      // Default initial state while awaiting evaluation
      default: 'pending_evaluation',
    },
    // Evaluation workflow status ('not_required' for pure MCQ, 'pending', 'completed')
    evaluationStatus: {
      // String workflow state
      type: String,
      // Permitted evaluation states
      enum: ['not_required', 'pending', 'completed'],
      // Default to pending manual review
      default: 'pending',
    },
    // Trigger that finalized the attempt ('USER_SUBMITTED' or 'TIME_EXPIRED')
    submittedReason: {
      // String reason identifier
      type: String,
      // Permitted submission catalysts
      enum: ['USER_SUBMITTED', 'TIME_EXPIRED', null],
      // Default null while in progress
      default: null,
    },
    // Overall qualitative feedback or grading comments provided by instructor
    feedback: {
      // String feedback text
      type: String,
      // Default null
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Optional reference to associated ProctoringSession tracking webcam and browser events
    proctoringSessionId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'ProctoringSession',
      // Default null if proctoring was disabled
      default: null,
      // Index for proctoring session correlation
      index: true,
    },
    // Specific question subset ObjectIds assigned to this attempt when randomization is enabled
    assignedQuestionIds: [
      {
        // ObjectId referencing Question collection
        type: mongoose.Schema.Types.ObjectId,
        // Target model
        ref: 'Question',
      },
    ],
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

// Compound uniqueness: exactly one submission attempt per student per assessment
submissionSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });

// Phase 6 Analytics performance indexes
submissionSchema.index({ studentId: 1, status: 1, submittedAt: -1 });
submissionSchema.index({ assessmentId: 1, status: 1 });
submissionSchema.index({ submittedAt: -1 });

// Virtual populating associated Evaluation record containing question-by-question grading details
submissionSchema.virtual('evaluation', {
  // Referenced model name
  ref: 'Evaluation',
  // Local submission ID field
  localField: '_id',
  // Foreign key on Evaluation model referencing this submission
  foreignField: 'submissionId',
  // Exactly one evaluation per submission
  justOne: true,
});

// Virtual populating active or completed ProctoringSession record
submissionSchema.virtual('proctoringSession', {
  // Referenced model name
  ref: 'ProctoringSession',
  // Local submission ID field
  localField: '_id',
  // Foreign key on ProctoringSession referencing this submission
  foreignField: 'submissionId',
  // Exactly one proctoring session per submission
  justOne: true,
});

// Configure JSON serialization transformation
submissionSchema.set('toJSON', {
  // Include virtual properties in JSON output
  virtuals: true,
  // Transform function modifying output representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Convert Mongoose Map of answers to a plain JavaScript object for JSON consumption
    if (ret.answers instanceof Map) {
      // Transform map entries to standard object
      ret.answers = Object.fromEntries(ret.answers);
    }
    // Strip internal document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register Submission model with Mongoose
const Submission = mongoose.model('Submission', submissionSchema);
// Export Submission model for attempt, scoring, and evaluation workflows
module.exports = Submission;
