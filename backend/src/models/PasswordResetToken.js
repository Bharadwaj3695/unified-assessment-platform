// Import the Mongoose object-data modeling (ODM) library for MongoDB
const mongoose = require('mongoose');

// Instantiate a new Mongoose schema defining the structure of password reset tokens
const passwordResetTokenSchema = new mongoose.Schema(
  // Object containing schema property definitions
  {
    // Cryptographic hash of the reset token to prevent plaintext exposure
    tokenHash: {
      // Set the data type of the token hash string
      type: String,
      // Require the token hash for every password reset record
      required: true,
      // Ensure each token hash is unique across the collection
      unique: true,
      // Create a secondary index for fast lookups by token hash
      index: true,
    // Closing tokenHash configuration object
    },
    // User identifier associating this reset token with a registered account
    userId: {
      // Store the identifier as a Mongoose ObjectId
      type: mongoose.Schema.Types.ObjectId,
      // Specify the User model as the referenced collection
      ref: 'User',
      // Mark the user reference as a mandatory attribute
      required: true,
      // Index userId to speed up queries checking active user tokens
      index: true,
    // Closing userId configuration object
    },
    // Flag indicating whether this reset token has already been consumed
    consumed: {
      // Boolean type for flag state
      type: Boolean,
      // Default to unconsumed (false) when creating a new token
      default: false,
      // Index consumed field for fast filtering of unused tokens
      index: true,
    // Closing consumed configuration object
    },
    // Timestamp recording when the token was consumed/used
    consumedAt: {
      // Date type for recording timestamp
      type: Date,
      // Default to null until the token is actually redeemed
      default: null,
    // Closing consumedAt configuration object
    },
    // Timestamp after which this reset token is considered invalid
    expiresAt: {
      // Date type for expiration timestamp
      type: Date,
      // Require explicit expiration timestamp on creation
      required: true,
    // Closing expiresAt configuration object
    },
  // Closing schema definitions object
  },
  // Schema configuration options object
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  // Closing schema options object
  }
// Closing Mongoose schema instantiation
);

// MongoDB TTL (time-to-live) index to automatically purge expired token records
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Customize JSON transformation behavior when serializing token documents
passwordResetTokenSchema.set('toJSON', {
  // Transformation function modifying the returned plain JavaScript object
  transform: (doc, ret) => {
    // Expose stringified _id as a standard id property
    ret.id = ret._id.toString();
    // Strip sensitive token hash from serialized output
    delete ret.tokenHash;
    // Remove internal Mongoose version key __v from serialized output
    delete ret.__v;
    // Return the cleaned-up plain object
    return ret;
  // Closing transform function
  },
// Closing toJSON configuration object
});

// Register and compile the PasswordResetToken model with Mongoose
const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
// Export the PasswordResetToken model for use across the application
module.exports = PasswordResetToken;
