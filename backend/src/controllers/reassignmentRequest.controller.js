// Import reassignment request service layer
const reassignmentRequestService = require('../services/reassignmentRequest.service');
// Import standardized API response formatting utilities
const { successResponse } = require('../utils/response');

/**
 * Controller handling HTTP requests for student reassignment requests and reviewer workflows.
 */
class ReassignmentRequestController {
  /**
   * Submit a new reassignment request (POST /api/assessments/:id/reassignment-request)
   * Enforces that student identity is taken strictly from req.user.id.
   */
  async createRequest(req, res, next) {
    try {
      const request = await reassignmentRequestService.requestReassignment(
        req.user.id,
        req.params.id,
        req.body.reason,
        req.ip
      );
      return successResponse(
        res,
        'Reassignment request submitted successfully',
        request,
        201
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve all reassignment requests for authenticated student (GET /api/assessments/reassignment-requests/mine)
   */
  async getMyRequests(req, res, next) {
    try {
      const requests = await reassignmentRequestService.getStudentRequests(req.user.id);
      return successResponse(
        res,
        'Reassignment requests retrieved successfully',
        requests
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve reassignment request for a specific assessment (GET /api/assessments/:id/reassignment-request)
   */
  async getRequestForAssessment(req, res, next) {
    try {
      const request = await reassignmentRequestService.getRequestForAssessment(
        req.user.id,
        req.params.id
      );
      return successResponse(
        res,
        'Assessment reassignment request retrieved',
        request
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve all requests for a specific assessment (GET /api/assessments/:id/reassignment-requests)
   * Restricted to instructor (owner) and admin.
   */
  async getAssessmentRequests(req, res, next) {
    try {
      const requests = await reassignmentRequestService.getAssessmentRequests(
        req.params.id,
        req.user
      );
      return successResponse(
        res,
        'Assessment reassignment requests retrieved',
        requests
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Review (approve or reject) a reassignment request (PATCH /api/assessments/reassignment-requests/:requestId)
   * Restricted to instructor (owner) and admin.
   */
  async reviewRequest(req, res, next) {
    try {
      const request = await reassignmentRequestService.reviewRequest(
        req.params.requestId,
        req.user,
        req.body,
        req.ip
      );
      return successResponse(
        res,
        `Reassignment request ${req.body.status} successfully`,
        request
      );
    } catch (err) {
      next(err);
    }
  }
}

// Export singleton instance
module.exports = new ReassignmentRequestController();
