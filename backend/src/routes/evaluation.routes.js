const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluation.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validation.middleware');
const { submitEvaluationValidator } = require('../validators/evaluation.validator');

// Instructor routes
router.get(
  '/instructor/submissions',
  authenticate,
  authorize('instructor', 'admin'),
  evaluationController.getSubmissionsForInstructor
);

router.post(
  '/submission/:id',
  authenticate,
  authorize('instructor', 'admin'),
  submitEvaluationValidator,
  validate,
  evaluationController.evaluateSubmission
);

module.exports = router;
