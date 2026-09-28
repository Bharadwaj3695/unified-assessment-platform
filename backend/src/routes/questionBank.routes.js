const express = require('express');
const router = express.Router();
const questionBankController = require('../controllers/questionBank.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  createQuestionValidator,
  updateQuestionValidator,
} = require('../validators/questionBank.validator');

// All Question Bank endpoints require authentication and instructor/admin roles
router.use(authenticate, authorize('instructor', 'admin'));

// Metadata endpoints
router.get('/categories', questionBankController.getCategories);
router.get('/tags', questionBankController.getTags);
router.post('/check-duplicate', questionBankController.checkDuplicate);

// List questions
router.get('/', questionBankController.getQuestions);

// Single question operations
router.get('/:id', questionBankController.getQuestionById);
router.post('/', createQuestionValidator, questionBankController.createQuestion);
router.put('/:id', updateQuestionValidator, questionBankController.updateQuestion);
router.delete('/:id', questionBankController.deleteQuestion);

module.exports = router;
