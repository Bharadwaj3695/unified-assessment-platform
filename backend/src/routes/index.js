const express = require('express');
const router = express.Router();

const assessmentRoutes = require('./assessment.routes');
const mockTestRoutes = require('./mockTest.routes');
const submissionController = require('../controllers/submission.controller');
const evaluationController = require('../controllers/evaluation.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Create specialized unified router for assessments with attempt and evaluation lifecycle adapters
const unifiedAssessmentRouter = express.Router();

// Assessment Attempts (Submissions) Lifecycle Adapters under /assessments/attempts
unifiedAssessmentRouter.get(
  '/attempts/mine',
  authenticate,
  authorize('student'),
  submissionController.getStudentSubmissions
);

unifiedAssessmentRouter.get(
  '/attempts/:id',
  authenticate,
  submissionController.getSubmissionById
);

unifiedAssessmentRouter.post(
  '/:id/attempts',
  authenticate,
  authorize('student'),
  (req, res, next) => {
    if (req.params.id && !req.body.assessmentId) {
      req.body.assessmentId = req.params.id;
    }
    return submissionController.startAttempt(req, res, next);
  }
);

unifiedAssessmentRouter.patch(
  '/attempts/:submissionId/answers/:questionId',
  authenticate,
  authorize('student'),
  submissionController.autosaveAnswer
);

unifiedAssessmentRouter.put(
  '/attempts/:id/progress',
  authenticate,
  authorize('student'),
  submissionController.saveProgress
);

unifiedAssessmentRouter.post(
  '/attempts/:id/submit',
  authenticate,
  authorize('student'),
  submissionController.submitAssessment
);

// Assessment Evaluation Adapters under /assessments/evaluations and /assessments/attempts/:attemptId/evaluate
unifiedAssessmentRouter.get(
  '/evaluations/instructor/submissions',
  authenticate,
  authorize('instructor', 'admin'),
  evaluationController.getSubmissionsForInstructor
);

unifiedAssessmentRouter.get(
  '/evaluations',
  authenticate,
  authorize('instructor', 'admin'),
  evaluationController.getSubmissionsForInstructor
);

unifiedAssessmentRouter.post(
  '/attempts/:attemptId/evaluate',
  authenticate,
  authorize('instructor', 'admin'),
  (req, res, next) => {
    if (req.params.attemptId && !req.params.id) {
      req.params.id = req.params.attemptId;
    }
    return evaluationController.evaluateSubmission(req, res, next);
  }
);

// Mount the standard assessment routes onto the unified assessment router
unifiedAssessmentRouter.use('/', assessmentRoutes);

// Mount domain namespaces under /api/tests
router.use('/assessments', unifiedAssessmentRouter);
router.use('/mock-tests', mockTestRoutes);

// Extensible future architectural placeholders
router.use('/ai-interviews', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'AI Mock Interviews API domain is planned for a future release.',
  });
});

router.use('/faculty-interviews', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Faculty Face-to-Face Interviews API domain is planned for a future release.',
  });
});

module.exports = router;
