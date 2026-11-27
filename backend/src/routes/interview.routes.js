const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interview.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validation.middleware');
const {
  createInterviewValidator,
  updateInterviewValidator,
  transitionInterviewValidator,
  rescheduleInterviewValidator,
  transcriptSegmentValidator,
  mediaControlValidator,
} = require('../validators/interview.validator');

router.use(authenticate);

// List & get interviews (role-filtered in service)
router.get('/', authorize('student', 'instructor', 'admin'), interviewController.listInterviews);
router.get('/:id', authorize('student', 'instructor', 'admin'), interviewController.getInterviewById);

// Faculty / Admin interview authoring & lifecycle
router.post(
  '/',
  authorize('instructor', 'admin'),
  createInterviewValidator,
  validate,
  interviewController.createInterview
);
router.put(
  '/:id',
  authorize('instructor', 'admin'),
  updateInterviewValidator,
  validate,
  interviewController.updateInterview
);
router.post(
  '/:id/transition',
  authorize('instructor', 'admin'),
  transitionInterviewValidator,
  validate,
  interviewController.transitionStatus
);
router.post(
  '/:id/reschedule',
  authorize('instructor', 'admin'),
  rescheduleInterviewValidator,
  validate,
  interviewController.rescheduleInterview
);

// Interview Session Management (start/join, camera telemetry, responses, complete/leave)
router.post(
  '/:id/session/start',
  authorize('student', 'instructor', 'admin'),
  interviewController.startOrJoinSession
);
router.post(
  '/:id/session/camera',
  authorize('student', 'instructor', 'admin'),
  interviewController.updateCameraStatus
);
router.put(
  '/:id/session/responses',
  authorize('student'),
  interviewController.saveStudentResponses
);
router.post(
  '/:id/session/complete',
  authorize('student', 'instructor', 'admin'),
  interviewController.completeOrLeaveSession
);
router.post(
  '/:id/session/media-control',
  authorize('instructor', 'admin'),
  mediaControlValidator,
  validate,
  interviewController.controlStudentMedia
);

// Evaluation & Reports (strict RBAC separation)
router.post(
  '/:id/evaluate',
  authorize('instructor', 'admin'),
  interviewController.evaluateInterview
);
router.get(
  '/:id/reports/student',
  authorize('student', 'instructor', 'admin'),
  interviewController.getStudentPerformanceReport
);
router.get(
  '/:id/reports/behavioral',
  authorize('instructor', 'admin'),
  interviewController.getBehavioralReport
);
router.post(
  '/:id/reports/behavioral/finalize',
  authorize('instructor', 'admin'),
  interviewController.finalizeBehavioralReport
);
router.get(
  '/:id/reports/faculty',
  authorize('instructor', 'admin'),
  interviewController.getFacultyReport
);

// Transcript (faculty/admin only; students blocked with 403)
router.get(
  '/:id/transcript',
  authorize('instructor', 'admin'),
  interviewController.getTranscript
);
router.post(
  '/:id/transcript',
  authorize('instructor', 'admin'),
  transcriptSegmentValidator,
  validate,
  interviewController.addTranscriptSegment
);

// AI Processing Pipeline triggers (faculty/admin only)
router.post(
  '/:id/ai/transcript',
  authorize('instructor', 'admin'),
  interviewController.processAiTranscript
);
router.post(
  '/:id/ai/proctoring',
  authorize('instructor', 'admin'),
  interviewController.processAiProctoring
);

module.exports = router;
