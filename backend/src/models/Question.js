// Import Mongoose ODM library for schema definition and collection operations
const mongoose = require('mongoose');

// Schema definition representing an individual question within an assessment
const questionSchema = new mongoose.Schema(
  {
    // Foreign key reference linking this question to its parent Assessment document
    assessmentId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'Assessment',
      // Mandatory relationship
      required: true,
      // Index for optimized retrieval of all questions in an assessment
      index: true,
    },
    // The prompt or question text presented to students
    questionText: {
      // String type storing question text
      type: String,
      // Mandatory question text prompt
      required: [true, 'Question prompt is required'],
      // Automatically trim whitespace
      trim: true,
    },
    // Question format type (multiple choice, short answer, essay, code, or file submission)
    type: {
      // String type storing format enum
      type: String,
      // Permitted question types
      enum: ['mcq', 'short_answer', 'long_answer', 'true_false', 'code', 'file_upload'],
      // Default question format: multiple-choice
      default: 'mcq',
      // Mandatory question type
      required: true,
    },
    // Choice options array for multiple-choice questions
    options: [
      {
        // Unique option identifier (e.g. 'opt_1', 'A')
        id: { type: String, required: true },
        // Text display label for this choice option
        text: { type: String, required: true },
      },
    ],
    // The authoritative correct answer used for automated scoring (never exposed to student before submission)
    correctAnswer: {
      // String representation of correct answer value or option ID
      type: String,
      // Default to null for subjective questions requiring manual evaluation
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Pedagogical rationale or solution explanation shown during post-assessment review
    explanation: {
      // String storing explanation
      type: String,
      // Default to null
      default: null,
      // Automatically trim whitespace
      trim: true,
    },
    // Maximum point value awarded for a fully correct response to this question
    points: {
      // Numeric point weight
      type: Number,
      // Mandatory field
      required: true,
      // Default weight: 5 points
      default: 5,
      // Enforce minimum weight of at least 1 point
      min: [1, 'Question points must be at least 1'],
    },
    // Sequence order index for sorting questions within the assessment
    orderIndex: {
      // Numeric position index
      type: Number,
      // Default starting index: 0
      default: 0,
    },
    // Configuration options applicable when question type is 'file_upload'
    fileUploadConfig: {
      // Array of permitted file extensions (e.g. pdf, doc, docx)
      allowedFileTypes: {
        // String array
        type: [String],
        // Default allowed file types
        default: ['pdf', 'doc', 'docx'],
      },
      // Maximum file size ceiling in Megabytes
      maxFileSizeMb: {
        // Numeric megabytes threshold
        type: Number,
        // Default 10MB
        default: 10,
        // Minimum allowed size
        min: 1,
        // Maximum allowed size
        max: 50,
      },
      // Allow students to submit Google Docs / Drive links instead of physical files
      allowGoogleDocs: {
        // Boolean flag
        type: Boolean,
        // Default to true
        default: true,
      },
      // Whether file attachment is mandatory to complete question answer
      isRequired: {
        // Boolean flag
        type: Boolean,
        // Default to true
        default: true,
      },
    },
    // Optional reference linking this question back to the central BankQuestion library record
    bankQuestionId: {
      // ObjectId referencing BankQuestion collection
      type: mongoose.Schema.Types.ObjectId,
      // Referenced collection model
      ref: 'BankQuestion',
      // Default to null for standalone custom questions
      default: null,
    },
    // Business identifier of the source question bank item
    questionBankId: {
      // String type
      type: String,
      // Default to null
      default: null,
    },
    // Specific version number of the question bank item at time of import
    questionBankVersion: {
      // Numeric version counter
      type: Number,
      // Default to null
      default: null,
    },
    // Difficulty rating classification
    difficulty: {
      // String type
      type: String,
      // Permitted difficulty levels
      enum: ['EASY', 'MEDIUM', 'HARD', null],
      // Default to null
      default: null,
    },
    // Bloom's Taxonomy cognitive complexity level
    bloomLevel: {
      // String type
      type: String,
      // Permitted Bloom taxonomy tiers
      enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE', null],
      // Default to null
      default: null,
    },
    // Descriptive tags for categorization and search filtering
    tags: {
      // Array of tag strings
      type: [String],
      // Default to empty array
      default: [],
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Configure JSON serialization transformation
questionSchema.set('toJSON', {
  // Transform function modifying serialized representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Strip internal document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register Question model with Mongoose
const Question = mongoose.model('Question', questionSchema);
// Export Question model for use across assessment and submission services
module.exports = Question;
