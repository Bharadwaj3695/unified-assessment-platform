// Express web framework for constructing modular route handlers
const express = require('express');
// Initialize isolated Express Router instance for Question Bank endpoints
const router = express.Router();
// Controller containing business logic for question bank taxonomy, versioning, search, and CRUD
const questionBankController = require('../controllers/questionBank.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');
// Schema validation chains for question bank item creation and updates
const {
  createQuestionValidator,
  updateQuestionValidator,
} = require('../validators/questionBank.validator');

// All Question Bank endpoints require authentication and instructor/admin roles
router.use(authenticate, authorize('instructor', 'admin'));

// Metadata endpoints
// Retrieve distinct question bank categories list (GET /api/question-bank/categories)
router.get('/categories', questionBankController.getCategories);
// Retrieve distinct question tags list (GET /api/question-bank/tags)
router.get('/tags', questionBankController.getTags);
// Check if question prompt duplicates an existing bank item (POST /api/question-bank/check-duplicate)
router.post('/check-duplicate', questionBankController.checkDuplicate);

// List questions
// Paginated question bank query with category, difficulty, Bloom level, and search filters (GET /api/question-bank)
router.get('/', questionBankController.getQuestions);

// Single question operations
// Retrieve specific question by ID with version details (GET /api/question-bank/:id)
router.get('/:id', questionBankController.getQuestionById);
// Create new question bank entry with automatic normalization and classification (POST /api/question-bank)
router.post('/', createQuestionValidator, questionBankController.createQuestion);
// Update existing question bank item creating a new revision version (PUT /api/question-bank/:id)
router.put('/:id', updateQuestionValidator, questionBankController.updateQuestion);
// Soft-delete question bank item (DELETE /api/question-bank/:id)
router.delete('/:id', questionBankController.deleteQuestion);

// Export configured question bank router
module.exports = router;
