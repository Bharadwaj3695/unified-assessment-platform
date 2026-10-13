// Import the Mongoose Notification model representing in-app alert records
const { Notification } = require('../models');

/**
 * Service managing user in-app notifications.
 * Handles querying unread alerts, updating read receipts, and deleting obsolete notifications.
 */
class NotificationService {
  // Queries paginated notifications and counts total and unread alerts for a specific user
  async getUserNotifications(userId, { page = 1, limit = 50 } = {}) {
    // Calculate MongoDB query skip offset based on 1-indexed page number and page size limit
    const skip = (page - 1) * limit;
    // Execute count queries and paginated list fetch concurrently using Promise.all
    const [unreadCount, total, notifications] = await Promise.all([
      // Count total number of unread notifications for badge indicator
      Notification.countDocuments({ userId, read: false }),
      // Count total number of notifications for pagination calculations
      Notification.countDocuments({ userId }),
      // Retrieve the page slice sorted in descending chronological order (newest first)
      Notification.find({ userId })
        // Order by creation timestamp descending
        .sort({ createdAt: -1 })
        // Skip records for previous pages
        .skip(skip)
        // Constrain query to requested page limit
        .limit(parseInt(limit, 10)),
    ]);

    // Return combined payload with list and pagination metadata
    return {
      // Array of notification document instances
      notifications,
      // Total count of unread notifications
      unreadCount,
      // Total count of all notifications for this user
      total,
      // Current active page integer
      page: parseInt(page, 10),
      // Items per page integer
      limit: parseInt(limit, 10),
    };
  }

  // Marks a single notification as read after validating user ownership
  async markAsRead(notificationId, userId) {
    // Find notification by ID and ensure it belongs to the authenticated user
    const notification = await Notification.findOne({
      // Target notification document ID
      _id: notificationId,
      // Recipient user ID constraint to prevent unauthorized access
      userId,
    });
    // If notification does not exist or belongs to another user, throw 404
    if (!notification) {
      // Create error object
      const error = new Error('Notification not found');
      // Set HTTP 404 status code
      error.statusCode = 404;
      // Throw error to reject update
      throw error;
    }
    // Update read flag to true
    notification.read = true;
    // Persist changes to MongoDB
    await notification.save();
    // Return updated notification document
    return notification;
  }

  // Batch updates all unread notifications belonging to the user to read status
  async markAllAsRead(userId) {
    // Update all matching documents where read is false to read: true
    await Notification.updateMany({ userId, read: false }, { read: true });
    // Return operation confirmation message
    return { message: 'All notifications marked as read' };
  }

  // Permanently removes a notification from MongoDB after verifying ownership
  async deleteNotification(notificationId, userId) {
    // Locate and delete the notification document atomically
    const notification = await Notification.findOneAndDelete({
      // Target notification ID
      _id: notificationId,
      // Ensure only recipient user can delete the notification
      userId,
    });
    // If notification does not exist, throw 404
    if (!notification) {
      // Create error object
      const error = new Error('Notification not found');
      // Set HTTP 404 status code
      error.statusCode = 404;
      // Throw error
      throw error;
    }
    // Return success confirmation message
    return { message: 'Notification deleted successfully' };
  }
}

// Export singleton instance of NotificationService
module.exports = new NotificationService();
