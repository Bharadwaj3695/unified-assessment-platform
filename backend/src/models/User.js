// Import the Mongoose object modeling package for MongoDB
const mongoose = require('mongoose');

// Define the Mongoose schema for the User collection
const userSchema = new mongoose.Schema(
  // Schema definition object containing all user attribute specifications
  {
    // Define the full name attribute configuration
    name: {
      // Set the data type to String
      type: String,
      // Require name with a custom validation error message
      required: [true, 'Name is required'],
      // Strip leading and trailing whitespace characters
      trim: true,
      // Enforce a minimum string length of 2 characters
      minlength: [2, 'Name must be at least 2 characters'],
    // Close name property configuration
    },
    // Define the email attribute configuration
    email: {
      // Set the data type to String
      type: String,
      // Require email with a custom validation error message
      required: [true, 'Email is required'],
      // Create a unique index to prevent duplicate accounts per email
      unique: true,
      // Strip leading and trailing whitespace characters
      trim: true,
      // Convert all email characters to lowercase for case-insensitivity
      lowercase: true,
      // Match email against regular expression format validator
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    // Close email property configuration
    },
    // Define the hashed password attribute configuration
    password: {
      // Set the data type to String
      type: String,
      // Conditional requirement: password is required unless user authenticated via Google
      required: function () {
        // Return true if Google ID is absent and authProvider is not google
        return !this.googleId && this.authProvider !== 'google';
      // Close conditional requirement function
      },
      // Enforce minimum password string length of 6 characters
      minlength: [6, 'Password must be at least 6 characters'],
    // Close password property configuration
    },
    // Define the OAuth Google account ID attribute configuration
    googleId: {
      // Set the data type to String
      type: String,
      // Strip leading and trailing whitespace
      trim: true,
      // Default to undefined so sparse/partial indexes do not index nulls
      default: undefined,
    // Close googleId property configuration
    },
    // Define the authentication provider attribute configuration
    authProvider: {
      // Set the data type to String
      type: String,
      // Restrict values to allowed providers
      enum: ['local', 'google', 'both'],
      // Default new accounts to local authentication
      default: 'local',
      // Create a database index for provider lookup
      index: true,
    // Close authProvider property configuration
    },
    // Define the platform authorization role attribute configuration
    role: {
      // Set the data type to String
      type: String,
      // Restrict role to student, instructor, or admin
      enum: ['student', 'instructor', 'admin'],
      // Default role to student for self-registration
      default: 'student',
      // Mark role as mandatory
      required: true,
    // Close role property configuration
    },
    // Define the user profile avatar image path or URL
    avatar: {
      // Set the data type to String
      type: String,
      // Default to null when no avatar has been uploaded
      default: null,
    // Close avatar property configuration
    },
    // Define the user biographical text attribute configuration
    bio: {
      // Set the data type to String
      type: String,
      // Default to null when bio is omitted
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close bio property configuration
    },
    // Define the account lifecycle approval status attribute
    status: {
      // Set the data type to String
      type: String,
      // Restrict status to pending, active, rejected, or revoked
      enum: ['pending', 'active', 'rejected', 'revoked'],
      // Default new user status to pending awaiting administrator approval
      default: 'pending',
      // Create index to accelerate filtering users by status
      index: true,
    // Close status property configuration
    },
    // Define flag indicating whether the account is currently active
    isActive: {
      // Set the data type to Boolean
      type: Boolean,
      // Default active flag to false until approved
      default: false,
    // Close isActive property configuration
    },
    // Define timestamp of the user's most recent login session
    lastLoginAt: {
      // Set the data type to Date
      type: Date,
      // Default to null prior to initial login
      default: null,
    // Close lastLoginAt property configuration
    },
    // Define optional institution code associated with the user
    instituteCode: {
      // Set the data type to String
      type: String,
      // Default to null when no institution code is provided
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close instituteCode property configuration
    },
    // Define timestamp when the user account was approved
    approvedAt: {
      // Set the data type to Date
      type: Date,
      // Default to null prior to approval
      default: null,
    // Close approvedAt property configuration
    },
    // Define reference to the administrator User who approved this account
    approvedBy: {
      // Store MongoDB ObjectId referring to a User document
      type: mongoose.Schema.Types.ObjectId,
      // Reference the User model for population
      ref: 'User',
      // Default to null until approved
      default: null,
    // Close approvedBy property configuration
    },
    // Define timestamp when the user account access was revoked
    revokedAt: {
      // Set the data type to Date
      type: Date,
      // Default to null unless revoked
      default: null,
    // Close revokedAt property configuration
    },
    // Define reference to the administrator User who revoked this account
    revokedBy: {
      // Store MongoDB ObjectId referring to a User document
      type: mongoose.Schema.Types.ObjectId,
      // Reference the User model for population
      ref: 'User',
      // Default to null unless revoked
      default: null,
    // Close revokedBy property configuration
    },
    // Define rejection reason string provided by an administrator upon rejection
    rejectionReason: {
      // Set the data type to String
      type: String,
      // Default to null when not rejected
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close rejectionReason property configuration
    },
    // Define institutional student identifier attribute
    studentId: {
      // Set the data type to String
      type: String,
      // Strip leading and trailing whitespace
      trim: true,
      // Default to undefined to prevent indexing undefined values in partial index
      default: undefined,
    // Close studentId property configuration
    },
    // Define date of birth attribute for student identity verification
    dateOfBirth: {
      // Set the data type to Date
      type: Date,
      // Default to null if not specified
      default: null,
    // Close dateOfBirth property configuration
    },
    // Define institutional faculty identifier attribute
    facultyId: {
      // Set the data type to String
      type: String,
      // Strip leading and trailing whitespace
      trim: true,
      // Default to undefined to avoid collision on partial index
      default: undefined,
    // Close facultyId property configuration
    },
    // Define institutional administrator identifier attribute
    adminId: {
      // Set the data type to String
      type: String,
      // Strip leading and trailing whitespace
      trim: true,
      // Default to undefined to avoid collision on partial index
      default: undefined,
    // Close adminId property configuration
    },
    // Define academic department attribute
    department: {
      // Set the data type to String
      type: String,
      // Default to null if not assigned
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close department property configuration
    },
    // Define subject identifier assigned to instructor or course
    subjectId: {
      // Set the data type to String
      type: String,
      // Default to null if not assigned
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close subjectId property configuration
    },
    // Define subject display name assigned to instructor or course
    subjectName: {
      // Set the data type to String
      type: String,
      // Default to null if not assigned
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close subjectName property configuration
    },
    // Define subject descriptive text
    subjectDescription: {
      // Set the data type to String
      type: String,
      // Default to null if not assigned
      default: null,
      // Strip leading and trailing whitespace
      trim: true,
    // Close subjectDescription property configuration
    },
    // Define boolean flag indicating whether multi-factor authentication is active
    mfaEnabled: {
      // Set the data type to Boolean
      type: Boolean,
      // Default MFA to disabled until enrolled
      default: false,
      // Index MFA status field
      index: true,
    // Close mfaEnabled property configuration
    },
    // Define stored base32 TOTP secret key for MFA verification
    mfaSecret: {
      // Set the data type to String
      type: String,
      // Default to null prior to MFA setup
      default: null,
    // Close mfaSecret property configuration
    },
    // Define temporary unconfirmed base32 TOTP secret during setup process
    mfaPendingSecret: {
      // Set the data type to String
      type: String,
      // Default to null when not in active MFA setup
      default: null,
    // Close mfaPendingSecret property configuration
    },
    // Define array of hashed one-time backup recovery codes for MFA account recovery
    mfaRecoveryCodes: [
      // Schema definition for each recovery code entry
      {
        // Define SHA-256 hash string of the backup code
        codeHash: {
          // Set the data type to String
          type: String,
          // Require hash string to be present
          required: true,
        // Close codeHash property configuration
        },
        // Define flag indicating if this recovery code has been redeemed
        used: {
          // Set the data type to Boolean
          type: Boolean,
          // Default used status to false
          default: false,
        // Close used property configuration
        },
        // Define timestamp when the recovery code was redeemed
        usedAt: {
          // Set the data type to Date
          type: Date,
          // Default to null until used
          default: null,
        // Close usedAt property configuration
        },
      // Close recovery code schema object
      },
    // Close mfaRecoveryCodes array definition
    ],
    // Define token version counter used for global JWT session invalidation
    tokenVersion: {
      // Set the data type to Number
      type: Number,
      // Default token version counter to 0
      default: 0,
    // Close tokenVersion property configuration
    },
    // Define timestamp when the user completed MFA enrollment
    mfaEnrolledAt: {
      // Set the data type to Date
      type: Date,
      // Default to null prior to MFA enrollment
      default: null,
    // Close mfaEnrolledAt property configuration
    },
    // Define timestamp when MFA was last successfully used to log in
    mfaLastUsedAt: {
      // Set the data type to Date
      type: Date,
      // Default to null prior to first MFA login
      default: null,
    // Close mfaLastUsedAt property configuration
    },
  // Close schema attributes definition
  },
  // Schema options configuration object
  {
    // Automatically manage createdAt and updatedAt timestamp fields
    timestamps: true,
  // Close schema options configuration object
  }
// Close Schema constructor invocation
);

// Enforce unique non-null academic identifiers and OAuth IDs using partial filter expressions
// Create partial unique index on studentId for string types only
userSchema.index(
  // Index specification for ascending studentId
  { studentId: 1 },
  // Option enforcing uniqueness only when studentId is a string
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
// Close studentId index creation
);
// Create partial unique index on facultyId for string types only
userSchema.index(
  // Index specification for ascending facultyId
  { facultyId: 1 },
  // Option enforcing uniqueness only when facultyId is a string
  { unique: true, partialFilterExpression: { facultyId: { $type: 'string' } } }
// Close facultyId index creation
);
// Create partial unique index on adminId for string types only
userSchema.index(
  // Index specification for ascending adminId
  { adminId: 1 },
  // Option enforcing uniqueness only when adminId is a string
  { unique: true, partialFilterExpression: { adminId: { $type: 'string' } } }
// Close adminId index creation
);
// Create partial unique index on googleId for string types only
userSchema.index(
  // Index specification for ascending googleId
  { googleId: 1 },
  // Option enforcing uniqueness only when googleId is a string
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
// Close googleId index creation
);
// Create compound index on role and status to optimize administrative user listing queries
userSchema.index({ role: 1, status: 1 });

// Track original academic identifiers and Google ID to enforce strict immutability
// Register Mongoose post-init lifecycle hook triggered after a document is loaded from MongoDB
userSchema.post('init', function () {
  // Cache original studentId on private instance field for mutation comparison
  this._originalStudentId = this.studentId;
  // Cache original facultyId on private instance field for mutation comparison
  this._originalFacultyId = this.facultyId;
  // Cache original adminId on private instance field for mutation comparison
  this._originalAdminId = this.adminId;
  // Cache original googleId on private instance field for mutation comparison
  this._originalGoogleId = this.googleId;
// Close post-init lifecycle hook function
});

// Register Mongoose pre-save middleware to prevent unauthorized modification of immutable identifiers
userSchema.pre('save', function (next) {
  // Only evaluate immutability constraints on existing documents, not newly created ones
  if (!this.isNew) {
    // Check if studentId was modified and differs from the original stored identifier
    if (this.isModified('studentId') && this._originalStudentId && this.studentId !== this._originalStudentId) {
      // Create error explaining studentId is immutable after creation
      const err = new Error('Student ID is permanent and immutable after creation');
      // Set HTTP 400 Bad Request error code
      err.statusCode = 400;
      // Abort save operation passing error to next callback
      return next(err);
    // Close studentId immutability check
    }
    // Check if facultyId was modified and differs from the original stored identifier
    if (this.isModified('facultyId') && this._originalFacultyId && this.facultyId !== this._originalFacultyId) {
      // Create error explaining facultyId is immutable after creation
      const err = new Error('Faculty ID is permanent and immutable after creation');
      // Set HTTP 400 Bad Request error code
      err.statusCode = 400;
      // Abort save operation passing error to next callback
      return next(err);
    // Close facultyId immutability check
    }
    // Check if adminId was modified and differs from the original stored identifier
    if (this.isModified('adminId') && this._originalAdminId && this.adminId !== this._originalAdminId) {
      // Create error explaining adminId is immutable after creation
      const err = new Error('Admin ID is permanent and immutable after creation');
      // Set HTTP 400 Bad Request error code
      err.statusCode = 400;
      // Abort save operation passing error to next callback
      return next(err);
    // Close adminId immutability check
    }
    // Check if googleId was modified and differs from the original stored identifier
    if (this.isModified('googleId') && this._originalGoogleId && this.googleId !== this._originalGoogleId) {
      // Create error explaining googleId is immutable after linked
      const err = new Error('Google ID is permanent and cannot be modified once linked');
      // Set HTTP 400 Bad Request error code
      err.statusCode = 400;
      // Abort save operation passing error to next callback
      return next(err);
    // Close googleId immutability check
    }
  // Close non-new document check
  }
  // Proceed to save document if all checks passed
  next();
// Close pre-save middleware function
});

// Configure JSON serialization transform options for the schema
userSchema.set('toJSON', {
  // Define custom transform callback executed when serializing document to JSON
  transform: (doc, ret) => {
    // Map MongoDB _id ObjectId to a string id property
    ret.id = ret._id.toString();
    // Exclude hashed password from JSON output
    delete ret.password;
    // Exclude internal Mongoose __v version key from JSON output
    delete ret.__v;
    // Exclude private cached original studentId from JSON output
    delete ret._originalStudentId;
    // Exclude private cached original facultyId from JSON output
    delete ret._originalFacultyId;
    // Exclude private cached original adminId from JSON output
    delete ret._originalAdminId;
    // Exclude private cached original googleId from JSON output
    delete ret._originalGoogleId;
    // Exclude sensitive MFA secret key from JSON output
    delete ret.mfaSecret;
    // Exclude sensitive pending MFA secret key from JSON output
    delete ret.mfaPendingSecret;
    // Exclude hashed MFA backup recovery codes from JSON output
    delete ret.mfaRecoveryCodes;
    // Cast mfaEnabled to explicit boolean primitive in serialized output
    ret.mfaEnabled = Boolean(ret.mfaEnabled);
    // Return sanitized plain JavaScript object
    return ret;
  // Close transform callback
  },
// Close toJSON configuration object
});

// Compile and instantiate the Mongoose User model using userSchema
const User = mongoose.model('User', userSchema);
// Export the User model for use across the application
module.exports = User;
