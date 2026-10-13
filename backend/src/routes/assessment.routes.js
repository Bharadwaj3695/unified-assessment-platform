// Express web framework for constructing modular route handlers
const express = require('express');
// Initialize isolated Express Router instance for assessment endpoints
const router = express.Router();
// Controller containing business logic for assessment retrieval, creation, updates, and deletion
const assessmentController = require('../controllers/assessment.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');
// Schema validation middleware formatting express-validator field rules
const { validate } = require('../middleware/validation.middleware');
// Field validation rule arrays for assessment creation and modification
const {
  createAssessmentValidator,
  updateAssessmentValidator,
} = require('../validators/assessment.validator');

// List assessments endpoint (GET /api/assessments) filtered according to caller's role (student/instructor/admin)
router.get('/', authenticate, assessmentController.getAssessments);

// Get single assessment details endpoint (GET /api/assessments/:id) with role-aware question filtering
router.get('/:id', authenticate, assessmentController.getAssessmentById);

// Create new assessment endpoint (POST /api/assessments) restricted to instructors and administrators
router.post(
  '/',
  authenticate,
  authorize('instructor', 'admin'),
  createAssessmentValidator,
  validate,
  assessmentController.createAssessment
);

// Update existing assessment endpoint (PUT /api/assessments/:id) restricted to author instructor or admin
router.put(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  updateAssessmentValidator,
  validate,
  assessmentController.updateAssessment
);

// Delete or archive assessment endpoint (DELETE /api/assessments/:id) restricted to author instructor or admin
router.delete(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  assessmentController.deleteAssessment
);

// Export configured assessment router
module.exports = router;
