// Express web framework for assembling modular routing endpoints
const express = require('express');
// Initialize isolated Express Router instance for proctoring endpoints
const router = express.Router();
// Controller containing business logic for proctoring sessions, camera checks, and integrity violation logs
const proctoringController = require('../controllers/proctoring.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');

// Protect all proctoring endpoints with bearer token authentication
router.use(authenticate);

// Retrieve active or completed proctoring session by session ID (GET /api/proctoring/sessions/:sessionId)
router.get('/sessions/:sessionId', proctoringController.getSession);
// Retrieve proctoring session associated with a specific submission (GET /api/proctoring/submissions/:submissionId)
router.get('/submissions/:submissionId', proctoringController.getBySubmission);
// Log client-side integrity event such as camera permission or copy-paste block (POST /api/proctoring/sessions/:sessionId/events)
router.post('/sessions/:sessionId/events', proctoringController.recordEvent);
// Terminate an active proctoring session upon assessment completion (POST /api/proctoring/sessions/:sessionId/end)
router.post('/sessions/:sessionId/end', proctoringController.endSession);

// Export configured proctoring router
module.exports = router;
