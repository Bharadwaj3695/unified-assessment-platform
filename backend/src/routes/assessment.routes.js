// Express web framework for constructing modular route handlers
const express = require('express');
// Initialize isolated Express Router instance for assessment endpoints
const router = express.Router();
// Controller containing business logic for assessment retrieval, creation, updates, and deletion
const assessmentController = require('../controllers/assessment.controller');
// Controller handling reassignment requests and reviewer workflows
const reassignmentRequestController = require('../controllers/reassignmentRequest.controller');
// Controller handling student certificate retrieval
const certificateController = require('../controllers/certificate.controller');
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
// Field validation rule arrays for reassignment requests
const {
  createReassignmentRequestValidator,
  reviewReassignmentRequestValidator,
} = require('../validators/reassignmentRequest.validator');

// List student's own reassignment requests (GET /api/assessments/reassignment-requests/mine)
router.get(
  '/reassignment-requests/mine',
  authenticate,
  authorize('student'),
  reassignmentRequestController.getMyRequests
);

// List student's own certificates (GET /api/assessments/certificates/mine)
router.get(
  '/certificates/mine',
  authenticate,
  authorize('student'),
  certificateController.getMyCertificates
);

// Review a reassignment request (PATCH /api/assessments/reassignment-requests/:requestId)
router.patch(
  '/reassignment-requests/:requestId',
  authenticate,
  authorize('instructor', 'admin'),
  reviewReassignmentRequestValidator,
  validate,
  reassignmentRequestController.reviewRequest
);

// List assessments endpoint (GET /api/assessments) filtered according to caller's role (student/instructor/admin)
router.get('/', authenticate, assessmentController.getAssessments);

// Submit reassignment request for a specific assessment (POST /api/assessments/:id/reassignment-request)
router.post(
  '/:id/reassignment-request',
  authenticate,
  authorize('student'),
  createReassignmentRequestValidator,
  validate,
  reassignmentRequestController.createRequest
);

// Get student's reassignment request status for a specific assessment (GET /api/assessments/:id/reassignment-request)
router.get(
  '/:id/reassignment-request',
  authenticate,
  authorize('student'),
  reassignmentRequestController.getRequestForAssessment
);

// Get all reassignment requests for a specific assessment (GET /api/assessments/:id/reassignment-requests)
router.get(
  '/:id/reassignment-requests',
  authenticate,
  authorize('instructor', 'admin'),
  reassignmentRequestController.getAssessmentRequests
);

// Get approved certificate templates for assessment configuration (GET /api/assessments/certificate-templates)
router.get(
  '/certificate-templates',
  authenticate,
  authorize('instructor', 'admin'),
  assessmentController.getCertificateTemplates
);

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
