const analyticsService = require('../services/analytics.service');
const examReportService = require('../services/examReport.service');
const pdfGenerator = require('../utils/pdfGenerator');
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

  async getStudentExamProgress(req, res, next) {
    try {
      // Strictly use authenticated server-side student identity for student callers
      const studentId =
        req.user.role === 'student'
          ? (req.query.studentId && req.query.studentId !== req.user.id ? req.query.studentId : req.user.id)
          : (req.query.studentId || req.user.id);
      const { search, examType, resultFilter, sortBy, page, limit, pendingPage, pendingLimit } = req.query;
      const progress = await examReportService.getStudentExamProgress(studentId, req.user, {
        search,
        examType,
        resultFilter,
        sortBy,
        page,
        limit,
        pendingPage,
        pendingLimit,
      });

      return successResponse(res, 'Exam-wise progress retrieved successfully', progress);
    } catch (err) {
      next(err);
    }
  }

  async getStudentAiPredictor(req, res, next) {
    try {
      const studentId =
        req.user.role === 'student'
          ? (req.query.studentId && req.query.studentId !== req.user.id ? req.query.studentId : req.user.id)
          : (req.query.studentId || req.user.id);
      const progress = await examReportService.getStudentExamProgress(studentId, req.user);

      return successResponse(
        res,
        'AI performance analysis integration status retrieved successfully',
        progress.Predictor
      );
    } catch (err) {
      next(err);
    }
  }

  async getIndividualExamReport(req, res, next) {
    try {
      const { attemptType, attemptId } = req.params;
      const report = await examReportService.getIndividualExamReport(
        attemptType,
        attemptId,
        req.user
      );

      return successResponse(res, 'Exam performance report retrieved successfully', report);
    } catch (err) {
      next(err);
    }
  }

  async downloadIndividualExamReportPdf(req, res, next) {
    try {
      const { attemptType, attemptId } = req.params;
      const report = await examReportService.getIndividualExamReport(
        attemptType,
        attemptId,
        req.user
      );
      const pdfBuffer = await pdfGenerator.generateExamReportPdf(report);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="uap-exam-report-${report.meta.attemptId}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
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
