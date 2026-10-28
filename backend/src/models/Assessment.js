// Import Mongoose ODM library for schema definition and database interactions
const mongoose = require('mongoose');
const { DEFAULT_GRADING_SCHEME } = require('../utils/gradingScheme');

// Sub-schema representing individual letter grade boundary bands
const gradeBandSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: true,
      trim: true,
    },
    minPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

// Mongoose schema definition representing an institutional exam, test, or quiz
const assessmentSchema = new mongoose.Schema(
  {
    // Formal title of the assessment
    title: {
      // String type storing assessment title
      type: String,
      // Mandatory field with descriptive validation error message
      required: [true, 'Assessment title is required'],
      // Automatically trim leading and trailing whitespace
      trim: true,
      // Minimum character length validation
      minlength: [3, 'Title must be at least 3 characters'],
    },
    // Detailed instructions, syllabus coverage, or assessment description
    description: {
      // String type storing description text
      type: String,
      // Default to empty string if omitted
      default: '',
      // Automatically trim whitespace
      trim: true,
    },
    // Reference to the instructor account who created and owns this assessment
    instructorId: {
      // MongoDB ObjectId referencing User collection
      type: mongoose.Schema.Types.ObjectId,
      // Referenced collection model name
      ref: 'User',
      // Mandatory ownership field to enforce instructor authorization boundaries
      required: true,
      // Index for fast query filtering by instructor
      index: true,
    },
    // Academic subject category (e.g. Computer Science, Mathematics, Physics)
    category: {
      // String storing category name
      type: String,
      // Default initial category
      default: 'General',
      // Automatically trim whitespace
      trim: true,
    },
    // Maximum time limit in minutes allocated to students upon starting an attempt
    durationMinutes: {
      // Number of minutes
      type: Number,
      // Mandatory duration configuration
      required: true,
      // Default duration: 60 minutes
      default: 60,
      // Enforce minimum duration of at least 1 minute
      min: [1, 'Duration must be at least 1 minute'],
    },
    // Total aggregate points possible across all questions in the assessment
    totalPoints: {
      // Numeric total points value
      type: Number,
      // Default total points baseline
      default: 100,
      // Ensure total points cannot be negative
      min: [0, 'Total points cannot be negative'],
    },
    // Percentage threshold required to achieve a passing grade (0 to 100)
    passingScore: {
      // Numeric passing threshold percentage
      type: Number,
      // Default passing threshold: 60%
      default: 60,
      // Minimum percentage bound
      min: [0, 'Passing score cannot be negative'],
      // Maximum percentage bound
      max: [100, 'Passing score cannot exceed 100'],
    },
    // Assessment publication lifecycle status ('draft', 'published', 'archived')
    status: {
      // String type representing lifecycle status
      type: String,
      // Permitted lifecycle states
      enum: ['draft', 'published', 'archived'],
      // Default initial state is draft until explicitly published by instructor
      default: 'draft',
      // Index for fast catalog filtering by status
      index: true,
    },
    // Optional scheduled start timestamp before which students cannot start attempts or view questions
    scheduledAt: {
      // Date timestamp
      type: Date,
      // Default to null for unscheduled / immediate availability
      default: null,
    },
    // Optional hard deadline timestamp after which no attempts may be initiated
    deadlineAt: {
      // Date timestamp
      type: Date,
      // Default to null for open-ended availability
      default: null,
    },
    // Flag indicating whether students can review their submitted answers and results
    allowReview: {
      // Boolean review permission flag
      type: Boolean,
      // Default to true
      default: true,
    },
    // Access policy: 'public' (accessible to all enrolled students) or 'restricted' (assigned roster only)
    accessType: {
      // String type storing access classification
      type: String,
      // Allowed access modes
      enum: ['public', 'restricted'],
      // Default to public access
      default: 'public',
      // Index for fast authorization filtering in student assessment catalogs
      index: true,
    },
    // Whitelist array of specific student User ObjectIds authorized when accessType is 'restricted'
    assignedStudents: [
      {
        // ObjectId referencing assigned student User document
        type: mongoose.Schema.Types.ObjectId,
        // Target collection model
        ref: 'User',
      },
    ],
    // Flag indicating whether automated proctoring monitor should be activated during attempts
    proctoringEnabled: {
      // Boolean proctoring flag
      type: Boolean,
      // Default to false
      default: false,
      // Index for filtering proctored assessments
      index: true,
    },
    // Flag indicating whether candidate must grant webcam permission before starting attempt
    cameraRequired: {
      // Boolean camera requirement flag
      type: Boolean,
      // Default to false
      default: false,
    },
    // Question randomization and subset pooling settings
    randomization: {
      // Enable question order shuffling or question pooling
      enabled: {
        // Boolean flag
        type: Boolean,
        // Default to false
        default: false,
      },
      // Number of questions to draw randomly from question pool (null = draw all)
      poolCount: {
        // Numeric count
        type: Number,
        // Default to null
        default: null,
      },
      // Shuffle question display order individually per student attempt
      shuffleOrder: {
        // Boolean flag
        type: Boolean,
        // Default to false
        default: false,
      },
    },
    // Certification and grading scheme configuration (Phase 2)
    certification: {
      // Toggle indicating whether successful completion qualifies for a certificate award
      enabled: {
        type: Boolean,
        default: false,
      },
      // Percentage required to qualify for certificate issuance (defaults to 50%)
      passingPercentage: {
        type: Number,
        default: 50,
        min: [0, 'Passing percentage cannot be negative'],
        max: [100, 'Passing percentage cannot exceed 100'],
      },
      // Configurable grading scheme with contiguous non-overlapping bands
      gradingScheme: {
        type: [gradeBandSchema],
        default: () => DEFAULT_GRADING_SCHEME.map((b) => ({ ...b })),
      },
      // Optional reference to an approved institutional certificate template
      templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CertificateTemplate',
        default: null,
      },
      // Optional assessment-specific certificate title override
      certificateTitle: {
        type: String,
        trim: true,
        default: '',
      },
      // Authorized signatory name displayed on issued certificate
      signatoryName: {
        type: String,
        trim: true,
        default: '',
      },
      // Authorized signatory title displayed on issued certificate
      signatoryTitle: {
        type: String,
        trim: true,
        default: 'Dean of Academic Affairs',
      },
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
    // Include virtual properties when converting documents to JSON objects
    toJSON: { virtuals: true },
    // Include virtual properties when converting documents to plain JavaScript objects
    toObject: { virtuals: true },
  }
);

// Phase 6 Category analytics index optimizing aggregated queries by category and status
assessmentSchema.index({ category: 1, status: 1 });
assessmentSchema.index({ 'certification.enabled': 1 });

// Virtual relationship populating associated Question records referencing this assessment
assessmentSchema.virtual('questions', {
  // Referenced model name
  ref: 'Question',
  // Local assessment identifier field
  localField: '_id',
  // Foreign key on Question model referencing this assessment
  foreignField: 'assessmentId',
});

// Configure JSON serialization transformation
assessmentSchema.set('toJSON', {
  // Include defined virtual properties in JSON output
  virtuals: true,
  // Transform function modifying serialized representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Remove internal Mongoose document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register Assessment model with Mongoose
const Assessment = mongoose.model('Assessment', assessmentSchema);
// Export Assessment model for use across controllers and services
module.exports = Assessment;
