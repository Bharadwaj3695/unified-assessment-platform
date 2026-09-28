const questionBankService = require('../services/questionBank.service');

class QuestionBankController {
  async createQuestion(req, res, next) {
    try {
      const instructorId = req.user.id;
      const question = await questionBankService.createQuestion(instructorId, req.body);
      return res.status(201).json({
        success: true,
        message: 'Question successfully added to Question Bank',
        data: question,
      });
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({
          success: false,
          message: err.message,
          duplicateQuestion: err.duplicateQuestion,
        });
      }
      next(err);
    }
  }

  async getQuestions(req, res, next) {
    try {
      const result = await questionBankService.getQuestions({
        requestingUser: req.user,
        ...req.query,
      });
      return res.status(200).json({
        success: true,
        ...result,
        data: result.questions,
      });
    } catch (err) {
      next(err);
    }
  }

  async getQuestionById(req, res, next) {
    try {
      const question = await questionBankService.getQuestionById(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        data: question,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQuestion(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      const updated = await questionBankService.updateQuestion(
        req.params.id,
        req.user.id,
        req.body,
        isAdmin
      );
      return res.status(200).json({
        success: true,
        message: 'Question Bank item successfully updated',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteQuestion(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      const result = await questionBankService.deleteQuestion(
        req.params.id,
        req.user.id,
        isAdmin
      );
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req, res, next) {
    try {
      const instructorId = req.user.role === 'admin' ? null : req.user.id;
      const categories = await questionBankService.getCategories(instructorId);
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTags(req, res, next) {
    try {
      const instructorId = req.user.role === 'admin' ? null : req.user.id;
      const tags = await questionBankService.getTags(instructorId);
      return res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (err) {
      next(err);
    }
  }

  async checkDuplicate(req, res, next) {
    try {
      const { questionText } = req.body;
      const existing = await questionBankService.checkDuplicate(questionText, req.user.id);
      return res.status(200).json({
        success: true,
        isDuplicate: Boolean(existing),
        duplicateQuestion: existing || null,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new QuestionBankController();
