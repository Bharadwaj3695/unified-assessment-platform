// Express web framework for constructing RESTful API route modules
const express = require('express');
// Initialize isolated Express Router instance for announcement endpoints
const router = express.Router();
// Controller containing business logic for announcement queries and mutations
const announcementController = require('../controllers/announcement.controller');
// Authentication and authorization middlewares
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validation.middleware');
// Validation rules for announcement mutations
const {
  saveDraftValidator,
  publishAnnouncementValidator,
  scheduleAnnouncementValidator,
} = require('../validators/announcement.validator');

// Public / client-facing endpoint to fetch the active broadcast announcement
router.get('/active', optionalAuthenticate, announcementController.getActive);

// Administrative announcement endpoints (Protected: Admin only)
// Retrieve current announcement configuration and server-time status
router.get('/current', authenticate, authorize('admin'), announcementController.getCurrent);

// Retrieve announcement history
router.get('/', authenticate, authorize('admin'), announcementController.getHistory);

// Save announcement draft
router.post('/draft', authenticate, authorize('admin'), saveDraftValidator, validate, announcementController.saveDraft);

// Publish announcement immediately
router.post('/publish', authenticate, authorize('admin'), publishAnnouncementValidator, validate, announcementController.publishImmediate);

// Schedule announcement for future publication
router.post('/schedule', authenticate, authorize('admin'), scheduleAnnouncementValidator, validate, announcementController.schedule);

// Cancel / unpublish current active announcement
router.put('/cancel', authenticate, authorize('admin'), announcementController.cancel);

// Cancel / unpublish announcement by ID
router.put('/:id/cancel', authenticate, authorize('admin'), announcementController.cancel);

// Export configured router
module.exports = router;
