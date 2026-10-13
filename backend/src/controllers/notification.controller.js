// Import the notification business service handling database queries for in-app user notifications
const notificationService = require('../services/notification.service');
// Import standardized API success response helper envelope
const { successResponse } = require('../utils/response');

/**
 * Controller handling in-app user notification queries, read receipts, and removals.
 * Connects authenticated requests to the notification business logic service.
 */
class NotificationController {
  // Retrieves a paginated list of in-app notifications and unread count for the authenticated user
  async getNotifications(req, res, next) {
    // Begin request processing in try-catch block
    try {
      // Destructure pagination parameters from query string with defaults (page 1, limit 50)
      const { page = 1, limit = 50 } = req.query;
      // Fetch user notifications and count summary from service
      const data = await notificationService.getUserNotifications(req.user.id, { page, limit });
      // Return standardized JSON response with status 200 and notifications data
      return successResponse(res, 'Notifications retrieved', data);
    // Catch unexpected errors and forward to centralized error handling middleware
    } catch (err) {
      // Delegate error to Express error middleware
      next(err);
    }
  }

  // Marks a specific notification as read by notification ID
  async markAsRead(req, res, next) {
    // Begin try block
    try {
      // Delegate read-status update to notification service verifying recipient ownership
      const notification = await notificationService.markAsRead(req.params.id, req.user.id);
      // Return success response confirming notification has been marked as read
      return successResponse(res, 'Notification marked as read', notification);
    // Catch errors (such as 404 Not Found or ownership mismatch)
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }

  // Marks all unread notifications as read for the authenticated user
  async markAllAsRead(req, res, next) {
    // Begin try block
    try {
      // Batch update all unread notifications belonging to the user
      const result = await notificationService.markAllAsRead(req.user.id);
      // Return success response with operation confirmation message
      return successResponse(res, result.message);
    // Catch errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }

  // Permanently deletes a single notification belonging to the authenticated user
  async deleteNotification(req, res, next) {
    // Begin try block
    try {
      // Delete notification record via service ensuring user ownership
      const result = await notificationService.deleteNotification(req.params.id, req.user.id);
      // Return success response confirming deletion
      return successResponse(res, result.message);
    // Catch errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }
}

// Export singleton instance of NotificationController
module.exports = new NotificationController();
