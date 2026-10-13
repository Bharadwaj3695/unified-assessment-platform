// Import assessment service handling assessment creation, scheduling, questions linkage, and lifecycle logic
const assessmentService = require('../services/assessment.service');
// Import standardized API response formatting utilities for single resource and paginated results
const { successResponse, paginatedResponse } = require('../utils/response');

/**
 * Controller handling assessment endpoints for instructors, students, and administrators.
 * Bridges HTTP routing to the assessment business logic layer.
 */
class AssessmentController {
  // Handles creation of a new assessment exam with scheduling and configuration options
  async createAssessment(req, res, next) {
    // Wrap execution in try-catch block for error forwarding
    try {
      // Delegate creation to service, associating the new assessment with the authenticated instructor ID
      const assessment = await assessmentService.createAssessment(req.user.id, req.body);
      // Return HTTP 201 Created with the newly created assessment document
      return successResponse(res, 'Assessment created successfully', assessment, 201);
    // Forward any validation or database errors to error middleware
    } catch (err) {
      // Pass error to centralized handler
      next(err);
    }
  }

  // Handles updating an existing assessment's metadata, scheduling, or question list
  async updateAssessment(req, res, next) {
    // Begin try block
    try {
      // Determine if current user possesses platform administrator privileges
      const isAdmin = req.user.role === 'admin';
      // Delegate update to service, allowing owner instructor or administrator to modify
      const assessment = await assessmentService.updateAssessment(
        // Assessment ID to update
        req.params.id,
        // Requesting user ID for ownership verification
        req.user.id,
        // Update payload
        req.body,
        // Administrator override flag
        isAdmin
      );
      // Return HTTP 200 with updated assessment object
      return successResponse(res, 'Assessment updated successfully', assessment);
    // Forward errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }

  // Retrieves paginated assessments filtered by user role, search query, category, and date
  async getAssessments(req, res, next) {
    // Begin try block
    try {
      // Destructure query parameters with fallback defaults (page 1, limit 200)
      const { status, category, search, page = 1, limit = 200, dateFilter } = req.query;
      // Query assessments through service applying role-specific visibility rules
      const { total, assessments } = await assessmentService.getAssessments({
        // User role (student, instructor, or admin)
        role: req.user.role,
        // Authenticated user ID
        userId: req.user.id,
        // Status filter (e.g. published, draft, archived)
        status,
        // Academic category or subject filter
        category,
        // Free text search keyword
        search,
        // Requested page number
        page,
        // Requested page size limit
        limit,
        // Date range filter option
        dateFilter,
      });
      // Return paginated response envelope with assessments array and paging metadata
      return paginatedResponse(res, 'Assessments retrieved successfully', assessments, page, limit, total);
    // Forward errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }

  // Retrieves details of a single assessment by ID with role-aware question filtering
  async getAssessmentById(req, res, next) {
    // Begin try block
    try {
      // Query assessment by ID passing user context to strip correct answers for active student test-takers
      const assessment = await assessmentService.getAssessmentById(req.params.id, req.user);
      // Return assessment data wrapped in success response
      return successResponse(res, 'Assessment retrieved successfully', assessment);
    // Forward errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }

  // Deletes an assessment by ID after checking instructor ownership or admin privileges
  async deleteAssessment(req, res, next) {
    // Begin try block
    try {
      // Check if authenticated user is administrator
      const isAdmin = req.user.role === 'admin';
      // Delegate deletion to service
      const result = await assessmentService.deleteAssessment(req.params.id, req.user.id, isAdmin);
      // Return success response with deletion confirmation
      return successResponse(res, result.message);
    // Forward errors
    } catch (err) {
      // Pass error to centralized error middleware
      next(err);
    }
  }
}

// Export singleton instance of AssessmentController
module.exports = new AssessmentController();
