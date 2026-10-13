// Import the Mongoose ODM library for MongoDB schema creation and database operations
const mongoose = require('mongoose');

// JSDoc comment describing normalization utilities for faculty registry identity
/**
 * Normalization utilities for Faculty Registry identity.
 * - facultyId: trimmed and uppercase (e.g. "  fac-101  " -> "FAC-101")
 * - email: trimmed and lowercase
 * - name: trimmed, collapsed multiple whitespace
 */
// Function to normalize faculty ID by trimming surrounding whitespace and converting to uppercase
function normalizeFacultyId(val) {
  // Check if val is falsy or not a string, returning an empty string if so
  if (!val || typeof val !== 'string') return '';
  // Trim outer whitespace and transform faculty ID to uppercase format
  return val.trim().toUpperCase();
// End of normalizeFacultyId function
}

// Function to normalize faculty institutional email by trimming whitespace and converting to lowercase
function normalizeEmail(val) {
  // Check if val is falsy or not a string, returning an empty string if so
  if (!val || typeof val !== 'string') return '';
  // Trim outer whitespace and transform email string to lowercase format
  return val.trim().toLowerCase();
// End of normalizeEmail function
}

// Function to normalize faculty full name by trimming whitespace and collapsing multiple spaces
function normalizeName(val) {
  // Check if val is falsy or not a string, returning an empty string if so
  if (!val || typeof val !== 'string') return '';
  // Trim outer whitespace and replace consecutive whitespace sequences with a single space
  return val.trim().replace(/\s+/g, ' ');
// End of normalizeName function
}

// Define the Mongoose schema for the authoritative Faculty Registry
const facultyRegistrySchema = new mongoose.Schema(
  // Object containing faculty registry field declarations
  {
    // Institutional faculty identifier field
    facultyId: {
      // Set the data type of facultyId to String
      type: String,
      // Require the faculty ID with a descriptive validation error message
      required: [true, 'Faculty ID is required in master registry'],
      // Enforce unique faculty IDs across all records in the registry
      unique: true,
      // Automatically trim whitespace from input faculty ID values
      trim: true,
      // Automatically convert faculty ID characters to uppercase
      uppercase: true,
      // Create a database index for optimized faculty ID lookups
      index: true,
    // Close facultyId field definition
    },
    // Full legal name of the faculty member
    name: {
      // Set the data type of faculty name to String
      type: String,
      // Require the faculty name with a descriptive validation error message
      required: [true, 'Faculty full name is required'],
      // Automatically trim whitespace from faculty name
      trim: true,
    // Close name field definition
    },
    // Institutional email address of the faculty member
    email: {
      // Set the data type of email to String
      type: String,
      // Require institutional email with a descriptive validation error message
      required: [true, 'Institutional email is required in master registry'],
      // Enforce unique institutional email across registry records
      unique: true,
      // Automatically trim whitespace from input email string
      trim: true,
      // Convert email characters to lowercase for consistency
      lowercase: true,
      // Create a database index for fast faculty lookups by email
      index: true,
      // Validate email format using standard regex pattern and error message
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    // Close email field definition
    },
    // Registry record status indicating active or inactive institutional standing
    status: {
      // Set the data type of status to String
      type: String,
      // Restrict status values to active or inactive
      enum: ['active', 'inactive'],
      // Default initial status to active
      default: 'active',
      // Index the status field for quick filtering
      index: true,
    // Close status field definition
    },
  // Close schema property definitions
  },
  // Schema options object
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  // Close schema options
  }
// Close Mongoose schema instantiation
);

// Pre-save normalization middleware hook
facultyRegistrySchema.pre('save', function (next) {
  // If the document has a name value provided
  if (this.name) {
    // Normalize name by removing redundant spaces
    this.name = normalizeName(this.name);
  // End of name normalization check
  }
  // If the document has a facultyId value provided
  if (this.facultyId) {
    // Normalize facultyId to trimmed uppercase
    this.facultyId = normalizeFacultyId(this.facultyId);
  // End of facultyId normalization check
  }
  // If the document has an email value provided
  if (this.email) {
    // Normalize email to trimmed lowercase
    this.email = normalizeEmail(this.email);
  // End of email normalization check
  }
  // Proceed to next middleware or save operation
  next();
// End of pre-save middleware
});

// Configure JSON serialization behavior for faculty registry documents
facultyRegistrySchema.set('toJSON', {
  // Transform function called when converting document to JSON
  transform: (doc, ret) => {
    // Expose string representation of MongoDB _id as id
    ret.id = ret._id.toString();
    // Remove internal Mongoose version key __v from output
    delete ret.__v;
    // Return serialized plain JavaScript object
    return ret;
  // End of transform function
  },
// End of toJSON configuration
});

// Attach normalizeFacultyId utility function to model statics for controller/testing access
facultyRegistrySchema.statics.normalizeFacultyId = normalizeFacultyId;
// Attach normalizeEmail utility function to model statics for controller/testing access
facultyRegistrySchema.statics.normalizeEmail = normalizeEmail;
// Attach normalizeName utility function to model statics for controller/testing access
facultyRegistrySchema.statics.normalizeName = normalizeName;

// Compile and register the FacultyRegistry Mongoose model
const FacultyRegistry = mongoose.model('FacultyRegistry', facultyRegistrySchema);

// Export the FacultyRegistry model for use in controllers and services
module.exports = FacultyRegistry;
