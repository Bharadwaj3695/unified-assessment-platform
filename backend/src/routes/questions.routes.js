const express = require('express');
const router = express.Router();
const multer = require('multer');
const questionManagementController = require('../controllers/questionManagement.controller');
const questionBulkImportController = require('../controllers/questionBulkImport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validateCreateQuestion } = require('../validators/question.validator');

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

router.use(authenticate);

// Bulk Import Sub-pipeline
router.post(
  '/import',
  authorize('instructor', 'admin'),
  upload.single('file'),
  questionBulkImportController.uploadFile
);
router.get(
  '/import/:jobId',
  authorize('instructor', 'admin'),
  questionBulkImportController.getJobPreview
);
router.post(
  '/import/:jobId/commit',
  authorize('instructor', 'admin'),
  questionBulkImportController.commitJob
);

// Question Management Endpoints
router.post(
  '/',
  authorize('instructor', 'admin'),
  validateCreateQuestion,
  questionManagementController.createQuestion
);
router.get('/', questionManagementController.getQuestions);
router.get('/:id', questionManagementController.getQuestionById);
router.patch('/:id', authorize('instructor', 'admin'), questionManagementController.updateQuestion);
router.post('/:id/validate', authorize('instructor', 'admin'), questionManagementController.validateQuestion);
router.post('/:id/publish', authorize('instructor', 'admin'), questionManagementController.publishQuestion);
router.post('/:id/archive', authorize('instructor', 'admin'), questionManagementController.archiveQuestion);
router.get('/:id/versions', authorize('instructor', 'admin'), questionManagementController.getQuestionVersions);
router.post('/:id/versions', authorize('instructor', 'admin'), questionManagementController.createQuestionVersion);

module.exports = router;
