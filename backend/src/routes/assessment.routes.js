const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validation.middleware');
const {
  createAssessmentValidator,
  updateAssessmentValidator,
} = require('../validators/assessment.validator');

// List assessments (role-filtered)
router.get('/', authenticate, assessmentController.getAssessments);

// Get single assessment
router.get('/:id', authenticate, assessmentController.getAssessmentById);

// Create assessment (instructor or admin)
router.post(
  '/',
  authenticate,
  authorize('instructor', 'admin'),
  createAssessmentValidator,
  validate,
  assessmentController.createAssessment
);

// Update assessment (instructor or admin)
router.put(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  updateAssessmentValidator,
  validate,
  assessmentController.updateAssessment
);

// Delete assessment (instructor or admin)
router.delete(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  assessmentController.deleteAssessment
);

module.exports = router;
