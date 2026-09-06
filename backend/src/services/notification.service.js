const { Notification } = require('../models');

class NotificationService {
  async getUserNotifications(userId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;
    const [unreadCount, total, notifications] = await Promise.all([
      Notification.countDocuments({ userId, read: false }),
      Notification.countDocuments({ userId }),
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
    ]);

    return {
      notifications,
      unreadCount,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });
    if (!notification) {
      const error = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }
    notification.read = true;
    await notification.save();
    return notification;
  }

  async markAllAsRead(userId) {
    await Notification.updateMany({ userId, read: false }, { read: true });
    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });
    if (!notification) {
      const error = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }
    return { message: 'Notification deleted successfully' };
  }
}

module.exports = new NotificationService();
