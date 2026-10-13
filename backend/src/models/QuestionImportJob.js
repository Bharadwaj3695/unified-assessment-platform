// Import Mongoose ODM library for schema definition and collection operations
const mongoose = require('mongoose');

// Sub-schema representing an individual candidate question parsed from a document or Google Form
const extractedQuestionSchema = new mongoose.Schema(
  {
    // Ephemeral unique client-side identifier for tracking during review and staging
    tempId: {
      // String identifier
      type: String,
      // Mandatory temporary ID
      required: true,
    },
    // Extracted question prompt text
    questionText: {
      // String type
      type: String,
      // Mandatory extracted text
      required: true,
      // Automatically trim whitespace
      trim: true,
    },
    // Normalized text used for duplicate detection against existing question bank items
    normalizedText: {
      // String type
      type: String,
      // Default to empty string
      default: '',
    },
    // Identified question type ('mcq', 'short_answer', 'long_answer', 'file_upload')
    type: {
      // String type
      type: String,
      // Permitted question types
      enum: ['mcq', 'short_answer', 'long_answer', 'file_upload'],
      // Default type
      default: 'mcq',
    },
    // Parsed choice options for multiple-choice questions
    options: [
      {
        // Unique option identifier
        id: { type: String, required: true },
        // Text label for option
        text: { type: String, required: true },
      },
    ],
    // Correct answer identified from document key or Google Form schema
    correctAnswer: {
      // String representation of correct answer
      type: String,
      // Default null
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Answer explanation or rationale
    explanation: {
      // String explanation text
      type: String,
      // Default null
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Default points assigned to this question
    points: {
      // Numeric point weight
      type: Number,
      // Default: 5 points
      default: 5,
      // Enforce positive points
      min: 1,
    },
    // Predicted or parsed difficulty rating
    difficulty: {
      // String difficulty rating
      type: String,
      // Allowed difficulty tiers
      enum: ['EASY', 'MEDIUM', 'HARD'],
      // Default difficulty rating
      default: 'MEDIUM',
    },
    // Predicted Bloom's taxonomy cognitive complexity level
    bloomLevel: {
      // String Bloom taxonomy tier
      type: String,
      // Permitted taxonomy tiers
      enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'],
      // Default tier
      default: 'UNDERSTAND',
    },
    // Categorization tags extracted from document content
    tags: {
      // Array of tag strings
      type: [String],
      // Default to empty array
      default: [],
    },
    // Subject category
    category: {
      // String category name
      type: String,
      // Default category
      default: 'General',
    },
    // Extraction confidence percentage (0-100) estimated by heuristic or NLP parser
    confidence: {
      // Numeric confidence score
      type: Number,
      // Minimum bound
      min: 0,
      // Maximum bound
      max: 100,
      // Default baseline confidence: 75%
      default: 75,
    },
    // Instructor review decision: 'PENDING', 'ACCEPTED', or 'REJECTED'
    reviewStatus: {
      // String review decision enum
      type: String,
      // Allowed review decisions
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      // Staged questions begin in PENDING status
      default: 'PENDING',
    },
    // Flag indicating whether this question text duplicates an existing question in the bank
    isDuplicate: {
      // Boolean duplicate indicator
      type: Boolean,
      // Default to false
      default: false,
    },
    // Foreign key reference to matching BankQuestion if duplicate was detected
    duplicateQuestionId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Referenced BankQuestion model
      ref: 'BankQuestion',
      // Default null if unique
      default: null,
    },
    // Flag indicating whether question contains unparseable or unsupported markup
    isUnsupported: {
      // Boolean unsupported indicator
      type: Boolean,
      // Default to false
      default: false,
    },
    // Human-readable explanation of why question formatting is unsupported
    unsupportedReason: {
      // String reason description
      type: String,
      // Default null
      default: null,
    },
  },
  // Omit subdocument _id for extracted questions
  { _id: false }
);

// Schema representing an asynchronous bulk question ingestion job
const questionImportJobSchema = new mongoose.Schema(
  {
    // Foreign key reference to the instructor User who initiated this import job
    instructorId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Referenced User model
      ref: 'User',
      // Mandatory instructor identity
      required: true,
      // Index for querying import jobs by instructor
      index: true,
    },
    // Format type of the ingested document or external source
    sourceType: {
      // String source enum
      type: String,
      // Allowed ingestion sources
      enum: ['PDF', 'DOCX', 'DOC', 'GOOGLE_FORMS'],
      // Mandatory source type
      required: true,
      // Index for source filtering
      index: true,
    },
    // Original uploaded filename
    sourceFilename: {
      // String filename
      type: String,
      // Default null for URL sources
      default: null,
    },
    // Internal storage filename or key on disk
    sourceFileKey: {
      // String file storage key
      type: String,
      // Default null
      default: null,
    },
    // Google Forms URL or external source reference link
    sourceReference: {
      // String reference link
      type: String,
      // Default null
      default: null,
    },
    // Overall job processing status ('QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED')
    status: {
      // String status enum
      type: String,
      // Permitted job states
      enum: ['QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED'],
      // Initial state is QUEUED upon job submission
      default: 'QUEUED',
      // Index for background worker queue polling
      index: true,
    },
    // Numeric progress percentage (0 to 100)
    progress: {
      // Number
      type: Number,
      // Minimum bound
      min: 0,
      // Maximum bound
      max: 100,
      // Default starting progress
      default: 0,
    },
    // Total number of questions detected in the source file
    totalDetected: {
      // Number
      type: Number,
      // Default 0
      default: 0,
    },
    // Number of detected questions accepted by instructor into the question bank
    totalAccepted: {
      // Number
      type: Number,
      // Default 0
      default: 0,
    },
    // Number of detected questions rejected by instructor
    totalRejected: {
      // Number
      type: Number,
      // Default 0
      default: 0,
    },
    // Array of error messages or warning logs encountered during document parsing
    errors: {
      // Array of error strings
      type: [String],
      // Default empty array
      default: [],
    },
    // Staged list of parsed question candidate subdocuments awaiting review
    extractedQuestions: [extractedQuestionSchema],
    // Exact timestamp when parsing or review was fully completed
    completedAt: {
      // Date timestamp
      type: Date,
      // Default null while processing
      default: null,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
    // Suppress warning for reserved Mongoose schema keys
    suppressReservedKeysWarning: true,
  }
);

// Compound index on instructorId and creation timestamp for chronological history listing
questionImportJobSchema.index({ instructorId: 1, createdAt: -1 });

// Configure JSON serialization transformation
questionImportJobSchema.set('toJSON', {
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

// Compile and register QuestionImportJob model with Mongoose
const QuestionImportJob = mongoose.model('QuestionImportJob', questionImportJobSchema);
// Export QuestionImportJob model for document parsing and review workflows
module.exports = QuestionImportJob;
