const questionManagementService = require('../services/questionManagement.service');

class QuestionManagementController {
  async createQuestion(req, res, next) {
    try {
      const question = await questionManagementService.createQuestion(req.user, req.body);
      res.status(201).json({
        success: true,
        message: 'Question created successfully',
        data: question,
      });
    } catch (err) {
      next(err);
    }
  }

  async getQuestions(req, res, next) {
    try {
      const result = await questionManagementService.getQuestions(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result.questions,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getQuestionById(req, res, next) {
    try {
      const question = await questionManagementService.getQuestionById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: question,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQuestion(req, res, next) {
    try {
      const updated = await questionManagementService.updateQuestion(req.params.id, req.user, req.body);
      res.status(200).json({
        success: true,
        message: 'Question updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async validateQuestion(req, res, next) {
    try {
      const report = await questionManagementService.validateQuestion(req.params.id);
      res.status(200).json({
        success: true,
        valid: report.valid,
        errors: report.errors,
        warnings: report.warnings,
      });
    } catch (err) {
      next(err);
    }
  }

  async publishQuestion(req, res, next) {
    try {
      const published = await questionManagementService.publishQuestion(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Question published successfully',
        data: published,
      });
    } catch (err) {
      next(err);
    }
  }

  async archiveQuestion(req, res, next) {
    try {
      const archived = await questionManagementService.archiveQuestion(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Question archived successfully',
        data: archived,
      });
    } catch (err) {
      next(err);
    }
  }

  async getQuestionVersions(req, res, next) {
    try {
      const versions = await questionManagementService.getQuestionVersions(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: versions,
      });
    } catch (err) {
      next(err);
    }
  }

  async createQuestionVersion(req, res, next) {
    try {
      const updated = await questionManagementService.updateQuestion(req.params.id, req.user, {
        ...req.body,
        changeSummary: req.body.changeSummary || 'Manual version increment',
      });
      res.status(201).json({
        success: true,
        message: 'New question version created successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new QuestionManagementController();
