const express = require('express');
const router = express.Router();
const proctoringController = require('../controllers/proctoring.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/sessions/:sessionId', proctoringController.getSession);
router.get('/submissions/:submissionId', proctoringController.getBySubmission);
router.post('/sessions/:sessionId/events', proctoringController.recordEvent);
router.post('/sessions/:sessionId/end', proctoringController.endSession);

module.exports = router;
