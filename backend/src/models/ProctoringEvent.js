// Import Mongoose ODM library for schema definition and collection binding
const mongoose = require('mongoose');

// Schema representing a security or integrity telemetry event captured during an online assessment
const proctoringEventSchema = new mongoose.Schema(
  {
    // Foreign key reference to the parent ProctoringSession tracking this candidate
    sessionId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'ProctoringSession',
      // Mandatory session link
      required: true,
      // Index for querying events by session
      index: true,
    },
    // Specific event classification code indicating what occurred on the student browser
    eventType: {
      // String type
      type: String,
      // Mandatory event classification
      required: true,
      // Permitted event types
      enum: [
        'session_started',
        'camera_permission_granted',
        'camera_permission_denied',
        'camera_disconnected',
        'camera_reconnected',
        'camera_unavailable',
        'camera_stream_stopped',
        'session_ended',
        'copy_blocked',
        'paste_blocked',
        'cut_blocked',
        'face_not_detected',
        'multiple_faces_detected',
        'session_interrupted',
        'page_visibility_left',
        'faculty_review_required',
        'suspicious_activity',
      ],
      // Index for filtering specific integrity violation types
      index: true,
    },
    // Exact timestamp when the integrity event transpired
    timestamp: {
      // Date timestamp
      type: Date,
      // Default to current timestamp
      default: Date.now,
    },
    // Severity level of the violation or system event ('info', 'low', 'medium', 'high', 'critical', 'warn', 'warning')
    severity: {
      // String severity rating
      type: String,
      // Allowed severity levels
      enum: ['info', 'low', 'medium', 'high', 'critical', 'warn', 'warning'],
      // Default initial severity
      default: 'info',
    },
    // Source of event ('client', 'ai_proctoring', 'faculty', 'system')
    source: {
      type: String,
      enum: ['client', 'ai_proctoring', 'faculty', 'system'],
      default: 'client',
    },
    // Faculty review status for observable / AI-detected flags (flags never auto-fail students)
    reviewStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'accepted', 'rejected'],
      default: 'not_applicable',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
    // Protected evidence metadata (never public URLs; subject to retention policy)
    evidence: {
      retained: { type: Boolean, default: false },
      storageKey: { type: String, default: null },
      mimeType: { type: String, default: null },
      retentionDays: { type: Number, default: 30 },
      retentionExpiresAt: { type: Date, default: null },
      deletedAt: { type: Date, default: null },
    },
    // Contextual metadata object capturing event parameters (e.g. keycode, window coordinates, tab blur duration)
    metadata: {
      // Flexible mixed type accommodating heterogeneous telemetry payloads
      type: mongoose.Schema.Types.Mixed,
      // Default to empty object
      default: {},
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
    // Include virtual properties when converting to JSON
    toJSON: { virtuals: true },
    // Include virtual properties when converting to plain objects
    toObject: { virtuals: true },
  }
);

// Compound index on sessionId and timestamp for chronological ordering of event feeds
proctoringEventSchema.index({ sessionId: 1, timestamp: 1 });

// Configure JSON serialization transformation
proctoringEventSchema.set('toJSON', {
  // Include virtual properties in JSON output
  virtuals: true,
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

// Compile and register ProctoringEvent model with Mongoose
const ProctoringEvent = mongoose.model('ProctoringEvent', proctoringEventSchema);
// Export ProctoringEvent model for recording integrity telemetry
module.exports = ProctoringEvent;
