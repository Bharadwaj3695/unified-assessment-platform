// Import Mongoose ODM library for schema modeling and database operations
const mongoose = require('mongoose');

// Schema representing an in-app user notification message delivered through the UI popover
const notificationSchema = new mongoose.Schema(
  {
    // Foreign key reference to the recipient User account
    userId: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'User',
      // Mandatory recipient reference
      required: true,
      // Index for fast query filtering by recipient
      index: true,
    },
    // Concise summary heading for the notification
    title: {
      // String title
      type: String,
      // Mandatory notification title
      required: true,
      // Automatically trim whitespace
      trim: true,
    },
    // Informational body text explaining the notification context
    message: {
      // String message body
      type: String,
      // Mandatory notification message
      required: true,
      // Automatically trim whitespace
      trim: true,
    },
    // Notification category classification ('info', 'assessment', 'grade', 'system')
    type: {
      // String category enum
      type: String,
      // Allowed category values
      enum: ['info', 'assessment', 'grade', 'system'],
      // Default notification type
      default: 'info',
    },
    // Read status indicator: false = unread (badge indicator on bell icon), true = acknowledged
    read: {
      // Boolean status flag
      type: Boolean,
      // Default to false (unread) on creation
      default: false,
      // Index for fast querying of unread count
      index: true,
    },
    // Optional navigation URL or router route link associated with this notification
    link: {
      // String route path
      type: String,
      // Default null if notification is purely informational
      default: null,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Configure JSON serialization transformation
notificationSchema.set('toJSON', {
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

// Compile and register Notification model with Mongoose
const Notification = mongoose.model('Notification', notificationSchema);
// Export Notification model for in-app alert delivery
module.exports = Notification;
