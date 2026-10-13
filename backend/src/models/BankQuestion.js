// Import Mongoose ODM library for schema definition and collection operations
const mongoose = require('mongoose');

// Schema representing a reusable question bank repository entry with versioning and AI classification
const bankQuestionSchema = new mongoose.Schema(
  {
    // Institutional unique question bank family identifier shared across versions of the same question
    questionBankId: {
      // String identifier
      type: String,
      // Mandatory family identifier
      required: true,
      // Index for querying all revisions of a specific question
      index: true,
    },
    // Monotonically increasing revision version number (1, 2, 3...)
    version: {
      // Numeric version counter
      type: Number,
      // Default initial revision
      default: 1,
      // Minimum version number
      min: 1,
    },
    // Flag indicating whether this document represents the latest active revision of the question
    isLatest: {
      // Boolean latest flag
      type: Boolean,
      // Default to true on creation
      default: true,
      // Index for filtering latest question revisions in question picker modals
      index: true,
    },
    // The raw question prompt text presented to students
    questionText: {
      // String type storing question prompt
      type: String,
      // Mandatory prompt with validation message
      required: [true, 'Question prompt is required'],
      // Automatically trim whitespace
      trim: true,
    },
    // Normalized, lowercase, stripped string representation used for fast duplicate detection
    normalizedText: {
      // String type storing normalized representation
      type: String,
      // Mandatory normalized string
      required: true,
      // Index for exact duplicate question detection queries
      index: true,
    },
    // Question format type ('mcq', 'short_answer', 'long_answer', 'file_upload')
    type: {
      // String type storing format classification
      type: String,
      // Permitted question types
      enum: ['mcq', 'short_answer', 'long_answer', 'file_upload'],
      // Default to multiple-choice
      default: 'mcq',
      // Mandatory question format
      required: true,
      // Index for question bank filtering by type
      index: true,
    },
    // Multiple-choice options array
    options: [
      {
        // Unique option identifier string (e.g. 'A', 'opt_1')
        id: { type: String, required: true },
        // Text display label for this choice option
        text: { type: String, required: true },
      },
    ],
    // Correct answer value for auto-scoring
    correctAnswer: {
      // String representation of correct answer
      type: String,
      // Default to null
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Solution explanation or pedagogical feedback shown during review
    explanation: {
      // String explanation text
      type: String,
      // Default to null
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Default point value assigned to this question when imported into assessments
    points: {
      // Numeric point weight
      type: Number,
      // Mandatory points field
      required: true,
      // Default point weight: 5 points
      default: 5,
      // Enforce positive points
      min: [1, 'Question points must be at least 1'],
    },
    // Cognitive difficulty rating ('EASY', 'MEDIUM', 'HARD')
    difficulty: {
      // String difficulty rating
      type: String,
      // Permitted difficulty levels
      enum: ['EASY', 'MEDIUM', 'HARD'],
      // Default difficulty rating
      default: 'MEDIUM',
      // Index for filtering question bank by difficulty
      index: true,
    },
    // Bloom's Taxonomy cognitive tier classification
    bloomLevel: {
      // String Bloom taxonomy level
      type: String,
      // Allowed taxonomy tiers
      enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'],
      // Default taxonomy level
      default: 'UNDERSTAND',
      // Index for curriculum coverage filtering
      index: true,
    },
    // Descriptive tags for search indexing and categorization
    tags: {
      // Array of tag strings
      type: [String],
      // Default empty array
      default: [],
      // Index for tag-based searches
      index: true,
    },
    // Academic subject category (e.g. Computer Science, Algorithms)
    category: {
      // String category name
      type: String,
      // Default category
      default: 'General',
      // Automatically trim whitespace
      trim: true,
      // Index for category queries
      index: true,
    },
    // Question lifecycle status ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ARCHIVED')
    status: {
      // String status enum
      type: String,
      // Permitted lifecycle states
      enum: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ARCHIVED'],
      // Default status for newly created or approved items
      default: 'APPROVED',
      // Index for filtering approved bank questions
      index: true,
    },
    // Source provenance channel ('MANUAL', 'PDF', 'DOCX', 'DOC', 'GOOGLE_FORMS')
    source: {
      // String provenance enum
      type: String,
      // Allowed ingestion sources
      enum: ['MANUAL', 'PDF', 'DOCX', 'DOC', 'GOOGLE_FORMS'],
      // Default source: manual creation
      default: 'MANUAL',
      // Index for filtering imported questions
      index: true,
    },
    // Ingestion provenance metadata tracing question origin back to import batch
    sourceMetadata: {
      // Reference to QuestionImportJob if extracted from a document
      importJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionImportJob', default: null },
      // Original filename of the uploaded source file
      originalFilename: { type: String, default: null },
      // Source URL if ingested from Google Forms
      formsUrl: { type: String, default: null },
      // Zero-based index of this question within the original source document
      rawQuestionIndex: { type: Number, default: null },
    },
    // Foreign key reference to the instructor User who created or authored this question
    createdBy: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'User',
      // Mandatory author
      required: true,
      // Index for author ownership filtering
      index: true,
    },
    // Foreign key reference to the reviewer User who reviewed or approved this item
    reviewedBy: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'User',
      // Default to null until reviewed
      default: null,
    },
    // Exact timestamp when review was finalized
    reviewedAt: {
      // Date timestamp
      type: Date,
      // Default null
      default: null,
    },
    // Confidence score (0-100) assigned by AI classification service
    classificationConfidence: {
      // Numeric confidence percentage
      type: Number,
      // Minimum bound
      min: 0,
      // Maximum bound
      max: 100,
      // Default null for manually authored questions
      default: null,
    },
    // Engine that classified difficulty and Bloom taxonomy ('AI', 'HEURISTIC', 'MANUAL')
    classificationSource: {
      // String classifier enum
      type: String,
      // Permitted sources
      enum: ['AI', 'HEURISTIC', 'MANUAL'],
      // Default classification method
      default: 'MANUAL',
    },
    // Soft deletion and active state flag
    isActive: {
      // Boolean active flag
      type: Boolean,
      // Default to true
      default: true,
      // Index for excluding soft-deleted questions
      index: true,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Compound indexes for optimal search and filtering
bankQuestionSchema.index({ createdBy: 1, isLatest: 1, status: 1 });
bankQuestionSchema.index({ questionBankId: 1, version: -1 });
bankQuestionSchema.index({ category: 1, difficulty: 1, type: 1 });
bankQuestionSchema.index({ tags: 1, isLatest: 1 });

// Configure JSON serialization transformation
bankQuestionSchema.set('toJSON', {
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

// Compile and register BankQuestion model with Mongoose
const BankQuestion = mongoose.model('BankQuestion', bankQuestionSchema);
// Export BankQuestion model for question bank repositories
module.exports = BankQuestion;
