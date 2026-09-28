const express = require('express');
const router = express.Router();
const questionImportController = require('../controllers/questionImport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { documentUpload } = require('../middleware/upload.middleware');
const {
  reviewQuestionValidator,
  bulkReviewValidator,
  googleFormsImportValidator,
} = require('../validators/questionBank.validator');

// All import endpoints require authentication and instructor/admin roles
router.use(authenticate, authorize('instructor', 'admin'));

// File import (PDF, DOC, DOCX)
router.post('/file', (req, res, next) => {
  documentUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }
    next();
  });
}, questionImportController.importFile);

// Google Forms import
router.post(
  '/google-forms',
  googleFormsImportValidator,
  questionImportController.importGoogleForms
);

// Import jobs management
router.get('/jobs', questionImportController.getJobs);
router.get('/jobs/:id', questionImportController.getJobById);
router.get('/jobs/:id/preview', questionImportController.getJobPreview);

// Review actions
router.post(
  '/jobs/:id/questions/:tempId/review',
  reviewQuestionValidator,
  questionImportController.reviewQuestion
);

router.post(
  '/jobs/:id/bulk-review',
  bulkReviewValidator,
  questionImportController.bulkReview
);

module.exports = router;
