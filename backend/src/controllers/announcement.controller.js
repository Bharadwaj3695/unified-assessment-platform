// Import announcement service
const announcementService = require('../services/announcement.service');
// Import standardized API response helpers
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Announcement Controller
 * Handles incoming HTTP requests for active announcement queries and administrative
 * lifecycle operations (draft, publish, schedule, cancel).
 */
class AnnouncementController {
  /**
   * Retrieve active announcement for client viewports
   * Public or authenticated. Returns only public display fields.
   */
  async getActive(req, res, next) {
    try {
      const userRole = req.user ? req.user.role : null;
      const data = await announcementService.getActiveAnnouncement(userRole);
      return successResponse(res, 'Active announcement retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve current announcement document and metadata for administrators
   */
  async getCurrent(req, res, next) {
    try {
      const data = await announcementService.getCurrentAnnouncement();
      return successResponse(res, 'Current announcement retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve announcement history for administrators
   */
  async getHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const data = await announcementService.getAnnouncementHistory(limit, page);
      return successResponse(res, 'Announcement history retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Save an announcement draft
   */
  async saveDraft(req, res, next) {
    try {
      const data = await announcementService.saveDraft(req.body, req.user, req.ip);
      return successResponse(res, 'Announcement draft saved successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Publish an announcement immediately
   */
  async publishImmediate(req, res, next) {
    try {
      const data = await announcementService.publishImmediate(req.body, req.user, req.ip);
      return successResponse(res, 'Announcement published successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Schedule an announcement for future publication
   */
  async schedule(req, res, next) {
    try {
      const data = await announcementService.scheduleAnnouncement(req.body, req.user, req.ip);
      return successResponse(res, 'Announcement scheduled successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancel / unpublish an announcement
   */
  async cancel(req, res, next) {
    try {
      const id = req.params.id || req.body.id || null;
      const data = await announcementService.cancelAnnouncement(id, req.user, req.ip);
      return successResponse(res, 'Announcement cancelled successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }
}

// Export singleton controller instance
module.exports = new AnnouncementController();
