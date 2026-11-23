const aiQuestionGenerationService = require('../services/aiQuestionGeneration.service');

class AiQuestionGenerationController {
  async createJob(req, res, next) {
    try {
      const job = await aiQuestionGenerationService.createGenerationJob(req.user, req.body);
      res.status(201).json({
        success: true,
        message: 'AI Question Generation job created successfully',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  async getJob(req, res, next) {
    try {
      const job = await aiQuestionGenerationService.getGenerationJob(req.params.jobId, req.user);
      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  async approveQuestion(req, res, next) {
    try {
      const questionIdOrIndex = req.body.questionId || req.body.questionIndex || req.body.index;
      const result = await aiQuestionGenerationService.approveGeneratedQuestion(
        req.params.jobId,
        questionIdOrIndex,
        req.user,
        req.body.overrideData || {}
      );
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.question,
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectQuestion(req, res, next) {
    try {
      const questionIdOrIndex = req.body.questionId || req.body.questionIndex || req.body.index;
      const result = await aiQuestionGenerationService.rejectGeneratedQuestion(
        req.params.jobId,
        questionIdOrIndex,
        req.user,
        req.body.reason || ''
      );
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AiQuestionGenerationController();
