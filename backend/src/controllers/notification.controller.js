const notificationService = require('../services/notification.service');
const { successResponse } = require('../utils/response');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const data = await notificationService.getUserNotifications(req.user.id, { page, limit });
      return successResponse(res, 'Notifications retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markAsRead(req.params.id, req.user.id);
      return successResponse(res, 'Notification marked as read', notification);
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);
      return successResponse(res, result.message);
    } catch (err) {
      next(err);
    }
  }

  async deleteNotification(req, res, next) {
    try {
      const result = await notificationService.deleteNotification(req.params.id, req.user.id);
      return successResponse(res, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
