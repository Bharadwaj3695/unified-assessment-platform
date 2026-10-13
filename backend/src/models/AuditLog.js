// Import Mongoose ODM library for schema definition and database persistence
const mongoose = require('mongoose');

// Schema definition for immutable audit log records documenting administrative and security-critical actions
const auditLogSchema = new mongoose.Schema(
  {
    // User identifier referencing the actor (administrator, instructor, or student) who executed the action
    userId: {
      // MongoDB ObjectId type for referencing User collection
      type: mongoose.Schema.Types.ObjectId,
      // Referenced collection model name
      ref: 'User',
      // Nullable when action is system-generated or unauthenticated (e.g. failed login attempts)
      default: null,
      // Index for fast audit queries by actor
      index: true,
    },
    // Standardized uppercase action verb identifier (e.g. USER_APPROVED, USER_REVOKED, BULK_STUDENT_IMPORT)
    action: {
      // String type storing action category code
      type: String,
      // Mandatory action name for every audit record
      required: true,
      // Index for filtering audit logs by specific action type
      index: true,
    },
    // Target domain entity type impacted by this action (e.g. 'User', 'StudentRegistry', 'Assessment')
    entityType: {
      // String representation of affected entity type
      type: String,
      // Default to null if action applies to general system state
      default: null,
    },
    // Stringified identifier of the target record modified or inspected
    entityId: {
      // String storing primary key or identifier of the target entity
      type: String,
      // Default to null if not applicable
      default: null,
    },
    // Contextual metadata object capturing action parameters, before/after diffs, or batch statistics
    details: {
      // Flexible mixed schema type accommodating heterogeneous audit metadata
      type: mongoose.Schema.Types.Mixed,
      // Default to empty object
      default: {},
    },
    // Client IP address captured from HTTP request for forensic tracking and geo-telemetry
    ipAddress: {
      // String storing IPv4 or IPv6 address
      type: String,
      // Default to null if unavailable or initiated by background worker
      default: null,
    },
  },
  {
    // Automatically capture createdAt and updatedAt timestamps; audit records are immutable once persisted
    timestamps: true,
  }
);

// Compound descending index on creation timestamp to optimize chronological timeline queries
auditLogSchema.index({ createdAt: -1 });

// Customize JSON serialization to format IDs and strip internal Mongoose metadata
auditLogSchema.set('toJSON', {
  // Transform function modifying output representation
  transform: (doc, ret) => {
    // Expose standard stringified id field
    ret.id = ret._id.toString();
    // Remove internal Mongoose document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register the AuditLog Mongoose model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
// Export AuditLog model for use across services and admin controllers
module.exports = AuditLog;
