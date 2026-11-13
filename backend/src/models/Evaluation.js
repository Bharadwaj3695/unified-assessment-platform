// Import Mongoose ODM library for schema definition and collection binding
const mongoose = require('mongoose');

// Schema representing the manual evaluation, rubric grading, and feedback for a student submission
const evaluationSchema = new mongoose.Schema(
  {
    // Foreign key reference to the evaluated student Submission record
    submissionId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'Submission',
      // Mandatory association
      required: true,
      // Exactly one Evaluation document per Submission
      unique: true,
      // Index for fast evaluation lookup by submission
      index: true,
    },
    // Foreign key reference to the instructor or evaluator User who performed the grading
    evaluatorId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced User model
      ref: 'User',
      // Mandatory evaluator identity
      required: true,
      // Index for querying evaluations by instructor
      index: true,
    },
    // Map of granular grading results and feedback keyed by individual question ID
    questionFeedback: {
      // Mongoose Map type
      type: Map,
      // Sub-schema defining points awarded and specific commentary per question
      of: new mongoose.Schema(
        {
          // Partial or full points awarded for this question response
          pointsAwarded: { type: Number, required: true, default: 0 },
          // Explanatory comment or rubric justification for this question
          comment: { type: String, default: '' },
        },
        // Omit individual subdocument _id for cleaner map values
        { _id: false }
      ),
      // Default to empty map
      default: {},
    },
    // Overall holistic grading commentary for the complete assessment attempt
    generalFeedback: {
      // String type storing general feedback
      type: String,
      // Default to empty string
      default: '',
      // Automatically trim whitespace
      trim: true,
    },
    // Final confirmed score after incorporating all manual point adjustments
    finalScore: {
      // Numeric final score value
      type: Number,
      // Mandatory score value
      required: true,
      // Enforce non-negative score
      min: 0,
    },
    // Evaluation workflow state: 'pending' (draft grade) or 'completed' (finalized grade)
    status: {
      // String state enum
      type: String,
      // Permitted evaluation states
      enum: ['pending', 'completed'],
      // Default to completed upon submission
      default: 'completed',
    },
    // Exact timestamp when evaluation was finalized
    gradedAt: {
      // Date timestamp
      type: Date,
      // Default to current timestamp
      default: Date.now,
    },
    // Final percentage score achieved (0% - 100%)
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Computed academic letter grade (e.g. 'A+', 'A', 'B+', 'B', 'C', 'F')
    grade: {
      type: String,
      default: null,
      trim: true,
    },
    // Qualitative descriptive grade label (e.g. 'Outstanding', 'Try Again')
    gradeLabel: {
      type: String,
      default: null,
      trim: true,
    },
    // Authoritative pass/fail status outcome
    passed: {
      type: Boolean,
      default: false,
    },
    // Flag indicating whether student meets criteria for an accredited certificate award
    certificateEligible: {
      type: Boolean,
      default: false,
    },
    // Outcome guidance feedback (encouraging feedback for non-passing attempts)
    outcomeFeedback: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Configure JSON serialization transformation
evaluationSchema.set('toJSON', {
  // Transform function modifying output representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Convert Mongoose Map of question feedback to a plain JavaScript object
    if (ret.questionFeedback instanceof Map) {
      // Transform map entries to standard object
      ret.questionFeedback = Object.fromEntries(ret.questionFeedback);
    }
    // Strip internal document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register Evaluation model with Mongoose
const Evaluation = mongoose.model('Evaluation', evaluationSchema);
// Export Evaluation model for use in grading workflows
module.exports = Evaluation;
