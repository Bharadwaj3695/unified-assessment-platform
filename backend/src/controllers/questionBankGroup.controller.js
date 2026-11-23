const questionBankGroupService = require('../services/questionBankGroup.service');

class QuestionBankGroupController {
  async createBank(req, res, next) {
    try {
      const bank = await questionBankGroupService.createBank(req.user, req.body);
      res.status(201).json({
        success: true,
        message: 'Question bank created successfully',
        data: bank,
      });
    } catch (err) {
      next(err);
    }
  }

  async getBanks(req, res, next) {
    try {
      const banks = await questionBankGroupService.getBanks(req.query, req.user);
      res.status(200).json({
        success: true,
        data: banks,
      });
    } catch (err) {
      next(err);
    }
  }

  async getBankById(req, res, next) {
    try {
      const bank = await questionBankGroupService.getBankById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: bank,
      });
    } catch (err) {
      next(err);
    }
  }

  async addQuestions(req, res, next) {
    try {
      const questionIds = req.body.questionIds || [];
      const bank = await questionBankGroupService.addQuestionsToBank(req.params.id, questionIds, req.user);
      res.status(200).json({
        success: true,
        message: 'Questions added to bank successfully',
        data: bank,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new QuestionBankGroupController();
