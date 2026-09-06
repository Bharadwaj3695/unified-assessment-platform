const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submission.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Student routes
router.post('/start', authenticate, authorize('student'), submissionController.startAttempt);
router.patch('/:submissionId/answers/:questionId', authenticate, authorize('student'), submissionController.autosaveAnswer);
router.put('/:id/progress', authenticate, authorize('student'), submissionController.saveProgress);
router.post('/:id/submit', authenticate, authorize('student'), submissionController.submitAssessment);
router.get('/student', authenticate, authorize('student'), submissionController.getStudentSubmissions);

// General detail route (student, instructor, admin)
router.get('/:id', authenticate, submissionController.getSubmissionById);

module.exports = router;
