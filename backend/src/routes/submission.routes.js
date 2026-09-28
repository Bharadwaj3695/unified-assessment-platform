const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submission.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { documentUpload } = require('../middleware/upload.middleware');

// Student routes
router.post('/start', authenticate, authorize('student'), submissionController.startAttempt);
router.patch('/:submissionId/answers/:questionId', authenticate, authorize('student'), submissionController.autosaveAnswer);
router.post('/:submissionId/answers/:questionId/file', authenticate, authorize('student'), documentUpload.single('file'), submissionController.uploadAnswerFile);
router.post('/:submissionId/answers/:questionId/google-docs', authenticate, authorize('student'), submissionController.attachGoogleDocsUrl);
router.delete('/:submissionId/answers/:questionId/file', authenticate, authorize('student'), submissionController.removeAnswerFile);
router.put('/:id/progress', authenticate, authorize('student'), submissionController.saveProgress);
router.post('/:id/submit', authenticate, authorize('student'), submissionController.submitAssessment);
router.get('/student', authenticate, authorize('student'), submissionController.getStudentSubmissions);

// Document view/download route (authorized student owner, instructor assessment owner, or admin)
router.get('/:submissionId/answers/:questionId/file', authenticate, submissionController.getAnswerFile);

// General detail route (student, instructor, admin)
router.get('/:id', authenticate, submissionController.getSubmissionById);

module.exports = router;
