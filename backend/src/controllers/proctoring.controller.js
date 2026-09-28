const proctoringService = require('../services/proctoring.service');
const { successResponse, errorResponse } = require('../utils/response');

class ProctoringController {
  async getSession(req, res, next) {
    try {
      const data = await proctoringService.getSessionById(
        req.params.sessionId,
        req.user._id,
        req.user.role
      );
      return successResponse(res, 'Proctoring session retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  async getBySubmission(req, res, next) {
    try {
      const data = await proctoringService.getSessionBySubmissionId(
        req.params.submissionId,
        req.user._id,
        req.user.role
      );
      return successResponse(res, 'Proctoring data for submission retrieved', data);
    } catch (err) {
      next(err);
    }
  }

  async recordEvent(req, res, next) {
    try {
      const { eventType, severity, metadata } = req.body;
      if (!eventType) {
        return errorResponse(res, 'eventType is required', 400);
      }

      const event = await proctoringService.recordEvent(
        req.params.sessionId,
        req.user._id,
        { eventType, severity, metadata }
      );
      return successResponse(res, 'Proctoring event recorded', event, 201);
    } catch (err) {
      next(err);
    }
  }

  async endSession(req, res, next) {
    try {
      const { reason } = req.body;
      const session = await proctoringService.endSession(
        req.params.sessionId,
        req.user._id,
        reason
      );
      return successResponse(res, 'Proctoring session ended', session);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProctoringController();
