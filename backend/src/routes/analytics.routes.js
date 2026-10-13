// Express web framework for constructing modular route handlers
const express = require('express');
// Initialize isolated Express Router instance for platform analytics endpoints
const router = express.Router();
// Controller containing aggregation pipeline logic for student metrics, faculty assessment reports, and admin KPIs
const analyticsController = require('../controllers/analytics.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');

// Student Analytics (Student, Instructor, Admin - with strict ownership check inside service)
// Query student performance breakdown across categories and subjects (GET /api/analytics/student/performance)
router.get(
  '/student/performance',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getStudentPerformance
);

// Query chronological student score trends over time (GET /api/analytics/student/trends)
router.get(
  '/student/trends',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getStudentTrends
);

// Query student consecutive assessment activity streak metrics (GET /api/analytics/student/streak)
router.get(
  '/student/streak',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getStudentStreak
);

// Leaderboard (All authenticated roles)
// Retrieve top performing students leaderboard across platform assessments (GET /api/analytics/leaderboard)
router.get(
  '/leaderboard',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getLeaderboard
);

// Faculty Assessment & Question Analytics (Instructor owner or Admin)
// Query high-level score distributions, pass rates, and completion times for an assessment (GET /api/analytics/instructor/assessment/:id)
router.get(
  '/instructor/assessment/:id',
  authenticate,
  authorize('instructor', 'admin'),
  analyticsController.getInstructorAssessmentAnalytics
);

// Query granular question-level accuracy and distractor frequency analytics (GET /api/analytics/instructor/assessment/:id/questions)
router.get(
  '/instructor/assessment/:id/questions',
  authenticate,
  authorize('instructor', 'admin'),
  analyticsController.getInstructorQuestionAnalytics
);

// Admin Platform Overview Analytics (Admin only)
// Query platform-wide operational KPIs, user growth trends, and assessment totals (GET /api/analytics/admin/overview)
router.get(
  '/admin/overview',
  authenticate,
  authorize('admin'),
  analyticsController.getAdminOverview
);

// Export configured analytics router
module.exports = router;
