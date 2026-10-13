// Express web framework for constructing RESTful API route modules
const express = require('express');
// Initialize isolated Express Router instance for notification endpoints
const router = express.Router();
// Controller containing business logic for notification listing, read acknowledgement, and deletion
const notificationController = require('../controllers/notification.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');

// Protect all notification routes with bearer authentication middleware
router.use(authenticate);

// Fetch paginated notification feed and unread badge count for the authenticated user (GET /api/notifications)
router.get('/', notificationController.getNotifications);
// Mark an individual notification as read via PUT (PUT /api/notifications/:id/read)
router.put('/:id/read', notificationController.markAsRead);
// Mark an individual notification as read via PATCH (PATCH /api/notifications/:id/read)
router.patch('/:id/read', notificationController.markAsRead);
// Mark all notifications as read for current user via PUT (PUT /api/notifications/read-all)
router.put('/read-all', notificationController.markAllAsRead);
// Mark all notifications as read for current user via PATCH (PATCH /api/notifications/read-all)
router.patch('/read-all', notificationController.markAllAsRead);
// Delete an individual notification by ID (DELETE /api/notifications/:id)
router.delete('/:id', notificationController.deleteNotification);

// Export configured notification router
module.exports = router;
