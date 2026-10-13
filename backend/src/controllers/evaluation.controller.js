// Import the evaluation service handling submission grading, score recording, and feedback dispatch
const evaluationService = require('../services/evaluation.service');
// Import standardized API response formatting utilities for single resource and paginated results
const { successResponse, paginatedResponse } = require('../utils/response');

/**
 * Controller handling submission evaluation endpoints for instructors.
 * Coordinates retrieving submission grading queues, recording manual evaluations, and sending student feedback emails.
 */
class EvaluationController {
  // Retrieves paginated student submissions for assessments owned by the authenticated instructor
  async getSubmissionsForInstructor(req, res, next) {
    // Begin request processing in try-catch block
    try {
      // Destructure query parameters with fallback defaults (page 1, limit 10)
      const { assessmentId, status, search, page = 1, limit = 10 } = req.query;
      // Fetch matching submissions and total count through evaluation service
      const { total, submissions } = await evaluationService.getSubmissionsForInstructor(
        // Authenticated instructor ID to restrict results to their authored exams
        req.user.id,
        // Query filters and pagination settings
        { assessmentId, status, search, page, limit }
      );
      // Return paginated response envelope with submissions list and metadata
      return paginatedResponse(res, 'Submissions retrieved successfully', submissions, page, limit, total);
    // Forward errors to centralized error handling middleware
    } catch (err) {
      // Pass error to Express error middleware
      next(err);
    }
  }

  // Records instructor grades, per-question score adjustments, and qualitative feedback for a student attempt
  async evaluateSubmission(req, res, next) {
    // Begin try block
    try {
      // Delegate evaluation logic and final score aggregation to evaluation service
      const result = await evaluationService.evaluateSubmission(
        // Authenticated instructor ID performing the evaluation
        req.user.id,
        // Submission attempt ID from route parameters
        req.params.id,
        // Evaluation payload containing question scores and feedback notes
        req.body
      );
      // Return HTTP 200 with evaluation summary and updated submission
      return successResponse(res, 'Submission evaluated successfully', result);
    // Forward errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }

  // Sends an instructor feedback email to the student regarding their evaluated assessment submission
  async sendStudentEmail(req, res, next) {
    // Begin try block
    try {
      // Extract email subject and message body from request payload
      const { subject, message } = req.body;
      // Dispatch email via evaluation service using Nodemailer SMTP
      const result = await evaluationService.sendStudentEmail(
        // Authenticated instructor ID
        req.user.id,
        // Target submission attempt ID
        req.params.id,
        // Email content payload
        { subject, message }
      );
      // Return success response with delivery confirmation
      return successResponse(res, result.message, result);
    // Forward errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }
}

// Export singleton instance of EvaluationController
module.exports = new EvaluationController();
