// Express web framework for assembling RESTful routing endpoints
const express = require('express');
// Initialize isolated Express Router instance for submission endpoints
const router = express.Router();
// Controller containing business logic for assessment attempts, autosaving, file uploads, and submission
const submissionController = require('../controllers/submission.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');
// Multer file upload middleware configuring file size, storage destination, and permitted document types
const { documentUpload } = require('../middleware/upload.middleware');

// Student routes
// Start new assessment attempt endpoint (POST /api/submissions/start) enforcing one-attempt rule and access windows
router.post('/start', authenticate, authorize('student'), submissionController.startAttempt);
// Granular autosave endpoint (PATCH /api/submissions/:submissionId/answers/:questionId) saving single question response
router.patch('/:submissionId/answers/:questionId', authenticate, authorize('student'), submissionController.autosaveAnswer);
// Upload physical document response endpoint (POST /api/submissions/:submissionId/answers/:questionId/file)
router.post('/:submissionId/answers/:questionId/file', authenticate, authorize('student'), documentUpload.single('file'), submissionController.uploadAnswerFile);
// Attach cloud Google Docs URL endpoint (POST /api/submissions/:submissionId/answers/:questionId/google-docs)
router.post('/:submissionId/answers/:questionId/google-docs', authenticate, authorize('student'), submissionController.attachGoogleDocsUrl);
// Remove uploaded response file endpoint (DELETE /api/submissions/:submissionId/answers/:questionId/file)
router.delete('/:submissionId/answers/:questionId/file', authenticate, authorize('student'), submissionController.removeAnswerFile);
// Bulk progress save endpoint (PUT /api/submissions/:id/progress) updating multiple answers simultaneously
router.put('/:id/progress', authenticate, authorize('student'), submissionController.saveProgress);
// Final assessment submission endpoint (POST /api/submissions/:id/submit) calculating autoScore and finalizing attempt
router.post('/:id/submit', authenticate, authorize('student'), submissionController.submitAssessment);
// List all submissions for the logged-in student (GET /api/submissions/student)
router.get('/student', authenticate, authorize('student'), submissionController.getStudentSubmissions);

// Document view/download route (authorized student owner, instructor assessment owner, or admin)
router.get('/:submissionId/answers/:questionId/file', authenticate, submissionController.getAnswerFile);

// General detail route (student, instructor, admin)
router.get('/:id', authenticate, submissionController.getSubmissionById);

// Export configured submission router
module.exports = router;
