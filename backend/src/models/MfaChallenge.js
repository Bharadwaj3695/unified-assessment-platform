// Import Mongoose ODM library for schema definition and collection binding
const mongoose = require('mongoose');
// Import crypto module for SHA-256 hashing
const crypto = require('crypto');

// Internal helper function to compute SHA-256 hash of a raw challenge identifier
function hashChallengeId(id) {
  if (!id) return '';
  return crypto.createHash('sha256').update(String(id).trim()).digest('hex');
}

// Schema definition for intermediate two-factor authentication challenges preventing session hijack
const mfaChallengeSchema = new mongoose.Schema(
  {
    // SHA-256 cryptographic hash of the challenge identifier to prevent raw token exposure in database
    challengeHash: {
      // String type storing 64-character SHA-256 hex digest
      type: String,
      // Mandatory cryptographic hash attribute
      required: true,
      // Enforce uniqueness across active challenges
      unique: true,
      // Index for fast challenge lookup during code verification
      index: true,
    },
    // Reference to the user account undergoing two-factor authentication verification
    userId: {
      // MongoDB ObjectId referencing User collection
      type: mongoose.Schema.Types.ObjectId,
      // User collection model name
      ref: 'User',
      // Mandatory account reference
      required: true,
      // Index for querying active challenges by user
      index: true,
    },
    // Single-use enforcement flag: set to true once code verification succeeds or fails fatally
    consumed: {
      // Boolean flag indicating redemption state
      type: Boolean,
      // Default to false when challenge is newly issued
      default: false,
      // Alias used property per conceptual requirements
      alias: 'used',
      // Index for filtering unconsumed active challenges
      index: true,
    },
    // Timestamp recording when the challenge was redeemed or consumed
    consumedAt: {
      // Date type for recording redemption timestamp
      type: Date,
      // Default to null until challenge is finalized
      default: null,
    },
    // Counter tracking number of incorrect TOTP or recovery code guesses submitted against this challenge
    attempts: {
      // Numeric counter
      type: Number,
      // Initialize with zero failed attempts
      default: 0,
    },
    // Maximum allowable failed code submission attempts before the challenge is permanently locked
    maxAttempts: {
      // Numeric limit threshold
      type: Number,
      // Default maximum threshold of 5 attempts to deter brute-force guessing
      default: 5,
    },
    // Exact expiration timestamp after which the challenge is rejected as expired
    expiresAt: {
      // Date type representing expiration epoch
      type: Date,
      // Mandatory expiration timestamp set on issuance (strictly 5 minutes)
      required: true,
    },
    // HMAC-SHA256 cryptographic hash of the 6-digit email OTP (never persisted in plaintext)
    emailOtpHash: {
      type: String,
      default: null,
    },
    // Expiration timestamp for the email OTP code
    emailOtpExpiresAt: {
      type: Date,
      default: null,
    },
    // Timestamp when the email OTP code was last dispatched (for resend throttling)
    emailOtpSentAt: {
      type: Date,
      default: null,
    },
    // Counter tracking how many times an email OTP has been requested for this challenge
    emailOtpResendCount: {
      type: Number,
      default: 0,
    },
    // Maximum allowed email OTP resends per challenge session
    emailOtpMaxResends: {
      type: Number,
      default: 3,
    },
    // Counter tracking failed verification attempts specifically for email OTP
    emailOtpAttempts: {
      type: Number,
      default: 0,
    },
    // Maximum allowed failed email OTP verification attempts
    emailOtpMaxAttempts: {
      type: Number,
      default: 5,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// MongoDB TTL index to automatically purge expired challenge documents from storage
mfaChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-validate middleware hook: if raw challengeId is provided, hash it to challengeHash and ensure raw ID is not persisted
mfaChallengeSchema.pre('validate', function (next) {
  if (this.challengeId && !this.challengeHash) {
    this.challengeHash = hashChallengeId(this.challengeId);
  }
  // Ensure raw challengeId property and unhashed OTP are never stored in MongoDB
  this.set('challengeId', undefined, { strict: false });
  this.set('emailOtp', undefined, { strict: false });
  next();
});

// Helper function to translate any legacy query filter referencing challengeId into challengeHash
function translateChallengeFilter(filter) {
  if (filter && typeof filter === 'object') {
    if (filter.challengeId) {
      filter.challengeHash = hashChallengeId(filter.challengeId);
      delete filter.challengeId;
    }
  }
}

// Pre-query middleware for operations querying by challengeId
const queryMiddlewareOps = ['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'];
mfaChallengeSchema.pre(queryMiddlewareOps, function () {
  translateChallengeFilter(this.getQuery());
});

// Configure JSON serialization transformation
mfaChallengeSchema.set('toJSON', {
  // Transform function modifying output representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Strip sensitive challenge hash and email OTP hash from serialized output
    delete ret.challengeHash;
    delete ret.challengeId;
    delete ret.emailOtpHash;
    delete ret.emailOtp;
    // Strip internal document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register MfaChallenge model with Mongoose
const MfaChallenge = mongoose.model('MfaChallenge', mfaChallengeSchema);
// Export MfaChallenge model for consumption by auth service
module.exports = MfaChallenge;

