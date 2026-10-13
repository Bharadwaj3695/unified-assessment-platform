// Express web framework for assembling RESTful routing endpoints
const express = require('express');
// Initialize isolated Express Router instance for evaluation endpoints
const router = express.Router();
// Controller containing business logic for manual grading, rubric evaluation, and student grade emails
const evaluationController = require('../controllers/evaluation.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');
// Schema validation middleware formatting express-validator field rules
const { validate } = require('../middleware/validation.middleware');
// Field validation rule array for submission evaluation payloads
const { submitEvaluationValidator } = require('../validators/evaluation.validator');

// Instructor routes
// Retrieve list of submissions awaiting grading for assessments owned by the caller (GET /api/evaluations/instructor/submissions)
router.get(
  '/instructor/submissions',
  authenticate,
  authorize('instructor', 'admin'),
  evaluationController.getSubmissionsForInstructor
);

// Submit manual grades and question-by-question feedback for a submission (POST /api/evaluations/submission/:id)
router.post(
  '/submission/:id',
  authenticate,
  authorize('instructor', 'admin'),
  submitEvaluationValidator,
  validate,
  evaluationController.evaluateSubmission
);

// Dispatch grade notification email to student with scoring breakdown and feedback (POST /api/evaluations/submission/:id/email)
router.post(
  '/submission/:id/email',
  authenticate,
  authorize('instructor', 'admin'),
  evaluationController.sendStudentEmail
);

// Export configured evaluation router
module.exports = router;
