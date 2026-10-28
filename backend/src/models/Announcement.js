// Import Mongoose ODM library for schema definition and collection operations
const mongoose = require('mongoose');

/**
 * Announcement Schema
 * Represents platform-wide broadcast announcements with persistent scheduling,
 * duration tracking, audience scoping, and full lifecycle state management.
 */
const announcementSchema = new mongoose.Schema(
  {
    // Content of the announcement broadcast across user viewports
    message: {
      type: String,
      required: [true, 'Announcement message is required'],
      trim: true,
      maxlength: [500, 'Announcement message cannot exceed 500 characters'],
    },
    // Lifecycle state: draft, scheduled, published, expired, or cancelled
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'expired', 'cancelled'],
      default: 'draft',
      index: true,
    },
    // Authoritative UTC start timestamp when the announcement becomes active
    startDate: {
      type: Date,
      default: null,
      index: true,
    },
    // Authoritative UTC expiry timestamp after which the announcement is no longer visible
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    // Duration components stored for administrator inspection and editing
    durationDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Target user audience scope for the announcement
    targetAudience: {
      type: String,
      enum: ['all', 'students', 'instructors', 'admins'],
      default: 'all',
      index: true,
    },
    // Foreign key referencing the administrator who created the announcement
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Foreign key referencing the administrator who last modified the announcement
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Timestamp when the announcement was explicitly published
    publishedAt: {
      type: Date,
      default: null,
    },
    // Timestamp when the announcement was cancelled/withdrawn by an administrator
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Compound index for optimal performance when evaluating active announcement windows
announcementSchema.index({ status: 1, startDate: 1, expiryDate: 1 });
announcementSchema.index({ createdAt: -1 });

// Configure JSON serialization transformation
announcementSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

// Compile and register the Announcement model with Mongoose
const Announcement = mongoose.model('Announcement', announcementSchema);

// Export Announcement model
module.exports = Announcement;
