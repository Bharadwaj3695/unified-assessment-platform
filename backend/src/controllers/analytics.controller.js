const analyticsService = require('../services/analytics.service');
const { successResponse } = require('../utils/response');

class AnalyticsController {
  async getStudentPerformance(req, res, next) {
    try {
      const studentId = req.query.studentId || req.user.id;
      const { dateFilter, startDate, endDate } = req.query;

      const performance = await analyticsService.getStudentPerformance(studentId, req.user, {
        dateFilter,
        startDate,
        endDate,
      });

      return successResponse(res, 'Student performance analytics retrieved successfully', performance);
    } catch (err) {
      next(err);
    }
  }

  async getStudentTrends(req, res, next) {
    try {
      const studentId = req.query.studentId || req.user.id;
      const { dateFilter, startDate, endDate } = req.query;

      const trends = await analyticsService.getStudentTrends(studentId, req.user, {
        dateFilter,
        startDate,
        endDate,
      });

      return successResponse(res, 'Student score trends retrieved successfully', trends);
    } catch (err) {
      next(err);
    }
  }

  async getStudentStreak(req, res, next) {
    try {
      const studentId = req.query.studentId || req.user.id;
      const streak = await analyticsService.getStudentStreak(studentId, req.user);

      return successResponse(res, 'Student streak details retrieved successfully', streak);
    } catch (err) {
      next(err);
    }
  }

  async getLeaderboard(req, res, next) {
    try {
      const { scope, assessmentId, category, page, limit } = req.query;

      const leaderboard = await analyticsService.getLeaderboard({
        scope,
        assessmentId,
        category,
        requestingUser: req.user,
        page,
        limit,
      });

      return successResponse(res, 'Leaderboard rankings retrieved successfully', leaderboard);
    } catch (err) {
      next(err);
    }
  }

  async getInstructorAssessmentAnalytics(req, res, next) {
    try {
      const assessmentId = req.params.id;
      const analytics = await analyticsService.getInstructorAssessmentAnalytics(
        assessmentId,
        req.user
      );

      return successResponse(res, 'Assessment analytics retrieved successfully', analytics);
    } catch (err) {
      next(err);
    }
  }

  async getInstructorQuestionAnalytics(req, res, next) {
    try {
      const assessmentId = req.params.id;
      const analytics = await analyticsService.getInstructorQuestionAnalytics(
        assessmentId,
        req.user
      );

      return successResponse(res, 'Question-level analytics retrieved successfully', analytics);
    } catch (err) {
      next(err);
    }
  }

  async getAdminOverview(req, res, next) {
    try {
      const { dateFilter } = req.query;
      const overview = await analyticsService.getAdminOverview({ dateFilter });

      return successResponse(res, 'Platform overview analytics retrieved successfully', overview);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
