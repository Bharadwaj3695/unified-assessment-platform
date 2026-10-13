// Import Mongoose ODM library for schema and model definition
const mongoose = require('mongoose');

// Schema tracking individual recent token rotation events within active grace window
const recentRotationSchema = new mongoose.Schema(
  {
    // SHA-256 hash of the consumed refresh token
    tokenHash: { type: String, required: true },
    // SHA-256 hash of the issued replacement refresh token
    replacedByTokenHash: { type: String, required: true },
    // Timestamp when the rotation occurred
    rotatedAt: { type: Date, required: true },
    // Expiration timestamp of the recovery grace window (typically rotatedAt + 30 seconds)
    graceExpiresAt: { type: Date, required: true },
    // AES-256-GCM encrypted replacement token envelope for lost-response recovery
    encryptedReplacementToken: { type: String, required: true },
  },
  { _id: false }
);

// Session schema tracking authoritative server-side refresh token state per device/family
const sessionSchema = new mongoose.Schema(
  {
    // Unique identifier for the session family (isolates multi-device logins)
    familyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Reference to the authenticated User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // SHA-256 hash of the currently active refresh token
    currentTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Bounded ring buffer of recent rotations within their active grace windows (max 5)
    recentRotations: {
      type: [recentRotationSchema],
      default: [],
    },
    // Tombstone ring buffer of expired rotation hashes (max 20) for replay detection
    historicalRevokedHashes: {
      type: [String],
      default: [],
    },
    // Operational status of this session family
    status: {
      type: String,
      enum: ['active', 'revoked', 'compromised'],
      default: 'active',
      index: true,
    },
    // Timestamp when session was revoked
    revokedAt: {
      type: Date,
      default: null,
    },
    // Reason for revocation (e.g. 'user_logout', 'token_reuse_detected', 'admin_revocation')
    revocationReason: {
      type: String,
      default: null,
    },
    // Monotonic counter for CAS versioning
    version: {
      type: Number,
      default: 0,
    },
    // IP address of latest activity
    ipAddress: {
      type: String,
      default: null,
    },
    // User-Agent of latest activity
    userAgent: {
      type: String,
      default: null,
    },
    // Timestamp of latest activity
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    // Overall expiration timestamp of the session (e.g. 30 days from creation/renewal)
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound and TTL indexes
sessionSchema.index({ 'recentRotations.tokenHash': 1 });
sessionSchema.index({ historicalRevokedHashes: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB native TTL purge

// Serialization transform to hide internal hash arrays if converted to JSON
sessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.currentTokenHash;
    delete ret.recentRotations;
    delete ret.historicalRevokedHashes;
    delete ret.__v;
    return ret;
  },
});

const Session = mongoose.model('Session', sessionSchema);
module.exports = Session;
