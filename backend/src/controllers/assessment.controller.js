const assessmentService = require('../services/assessment.service');
const { successResponse, paginatedResponse } = require('../utils/response');

class AssessmentController {
  async createAssessment(req, res, next) {
    try {
      const assessment = await assessmentService.createAssessment(req.user.id, req.body);
      return successResponse(res, 'Assessment created successfully', assessment, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateAssessment(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      const assessment = await assessmentService.updateAssessment(
        req.params.id,
        req.user.id,
        req.body,
        isAdmin
      );
      return successResponse(res, 'Assessment updated successfully', assessment);
    } catch (err) {
      next(err);
    }
  }

  async getAssessments(req, res, next) {
    try {
      const { status, category, search, page = 1, limit = 200, dateFilter } = req.query;
      const { total, assessments } = await assessmentService.getAssessments({
        role: req.user.role,
        userId: req.user.id,
        status,
        category,
        search,
        page,
        limit,
        dateFilter,
      });
      return paginatedResponse(res, 'Assessments retrieved successfully', assessments, page, limit, total);
    } catch (err) {
      next(err);
    }
  }

  async getAssessmentById(req, res, next) {
    try {
      const assessment = await assessmentService.getAssessmentById(req.params.id, req.user);
      return successResponse(res, 'Assessment retrieved successfully', assessment);
    } catch (err) {
      next(err);
    }
  }

  async deleteAssessment(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      const result = await assessmentService.deleteAssessment(req.params.id, req.user.id, isAdmin);
      return successResponse(res, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AssessmentController();
