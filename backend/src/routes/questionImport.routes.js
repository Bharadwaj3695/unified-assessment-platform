// Express web framework for constructing RESTful route handlers
const express = require('express');
// Initialize isolated Express Router instance for Question Import pipeline endpoints
const router = express.Router();
// Controller containing business logic for document parsing, Google Forms import, and question staging review
const questionImportController = require('../controllers/questionImport.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');
// Multer file upload middleware configuring file size, storage destination, and permitted document types
const { documentUpload } = require('../middleware/upload.middleware');
// Validation chains for individual review, bulk review, and Google Forms import schemas
const {
  reviewQuestionValidator,
  bulkReviewValidator,
  googleFormsImportValidator,
} = require('../validators/questionBank.validator');

// All import endpoints require authentication and instructor/admin roles
router.use(authenticate, authorize('instructor', 'admin'));

// File import (PDF, DOC, DOCX)
// Upload and parse physical document into candidate questions (POST /api/question-import/file)
router.post('/file', (req, res, next) => {
  // Execute single file upload handler using documentUpload multer configuration
  documentUpload.single('file')(req, res, (err) => {
    // If upload fails due to size limit or invalid extension, return HTTP 400
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }
    // Proceed to file import controller
    next();
  });
}, questionImportController.importFile);

// Google Forms import
// Parse questions from Google Form URL or form definition structure (POST /api/question-import/google-forms)
router.post(
  '/google-forms',
  googleFormsImportValidator,
  questionImportController.importGoogleForms
);

// Import jobs management
// Retrieve list of past and in-progress import jobs (GET /api/question-import/jobs)
router.get('/jobs', questionImportController.getJobs);
// Retrieve status details for a specific import job by ID (GET /api/question-import/jobs/:id)
router.get('/jobs/:id', questionImportController.getJobById);
// Preview parsed questions awaiting instructor review (GET /api/question-import/jobs/:id/preview)
router.get('/jobs/:id/preview', questionImportController.getJobPreview);

// Review actions
// Accept or reject an individual parsed candidate question (POST /api/question-import/jobs/:id/questions/:tempId/review)
router.post(
  '/jobs/:id/questions/:tempId/review',
  reviewQuestionValidator,
  questionImportController.reviewQuestion
);

// Apply bulk accept/reject decision to multiple staged questions (POST /api/question-import/jobs/:id/bulk-review)
router.post(
  '/jobs/:id/bulk-review',
  bulkReviewValidator,
  questionImportController.bulkReview
);

// Export configured question import router
module.exports = router;
