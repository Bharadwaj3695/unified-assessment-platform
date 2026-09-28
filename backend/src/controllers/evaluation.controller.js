const evaluationService = require('../services/evaluation.service');
const { successResponse, paginatedResponse } = require('../utils/response');

class EvaluationController {
  async getSubmissionsForInstructor(req, res, next) {
    try {
      const { assessmentId, status, search, page = 1, limit = 10 } = req.query;
      const { total, submissions } = await evaluationService.getSubmissionsForInstructor(
        req.user.id,
        { assessmentId, status, search, page, limit }
      );
      return paginatedResponse(res, 'Submissions retrieved successfully', submissions, page, limit, total);
    } catch (err) {
      next(err);
    }
  }

  async evaluateSubmission(req, res, next) {
    try {
      const result = await evaluationService.evaluateSubmission(
        req.user.id,
        req.params.id,
        req.body
      );
      return successResponse(res, 'Submission evaluated successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async sendStudentEmail(req, res, next) {
    try {
      const { subject, message } = req.body;
      const result = await evaluationService.sendStudentEmail(
        req.user.id,
        req.params.id,
        { subject, message }
      );
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EvaluationController();
