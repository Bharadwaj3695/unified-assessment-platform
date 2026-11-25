const express = require('express');
const router = express.Router();
const mockTestController = require('../controllers/mockTest.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { documentUpload } = require('../middleware/upload.middleware');

router.use(authenticate);

// Faculty authoring & publishing endpoints
router.post('/', authorize('instructor', 'admin'), mockTestController.createMockTest);
router.get('/', mockTestController.getMockTests);
router.get('/:id', mockTestController.getMockTestById);
router.patch('/:id', authorize('instructor', 'admin'), mockTestController.updateMockTest);
router.post('/:id/generate', authorize('instructor', 'admin'), mockTestController.generateFromBlueprint);
router.post('/:id/publish', authorize('instructor', 'admin'), mockTestController.publishMockTest);

// Faculty manual grading and review endpoints
router.get('/:id/attempts', authorize('instructor', 'admin'), mockTestController.getMockTestAttempts);
router.get('/attempts/:attemptId/review', authorize('instructor', 'admin'), mockTestController.getAttemptForReview);
router.post('/attempts/:attemptId/evaluate', authorize('instructor', 'admin'), mockTestController.evaluateAttempt);

// Student attempt, submission, file upload, download and analytics endpoints
router.post('/:id/attempt', authorize('student'), mockTestController.startAttempt);
router.post('/:id/attempts', authorize('student'), mockTestController.startAttempt);
router.post('/attempts/:attemptId/submit', authorize('student'), (req, res, next) => {
  req.body.attemptId = req.params.attemptId;
  return mockTestController.submitAttempt(req, res, next);
});
router.post('/:id/submit', authorize('student'), mockTestController.submitAttempt);
router.post('/submit', authorize('student'), mockTestController.submitAttempt);
router.post('/attempts/:attemptId/questions/:questionId/upload', authorize('student'), documentUpload.single('file'), mockTestController.uploadAttemptFile);
router.get('/attempts/:attemptId/questions/:questionId/file', mockTestController.downloadAttemptFile);
router.get('/attempts/:attemptId/analytics', mockTestController.getAttemptAnalytics);

module.exports = router;
