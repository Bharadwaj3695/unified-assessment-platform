const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Student Analytics (Student, Instructor, Admin - with strict ownership check inside service)
router.get(
  '/student/performance',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getStudentPerformance
);

router.get(
  '/student/trends',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getStudentTrends
);

router.get(
  '/student/streak',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getStudentStreak
);

// Leaderboard (All authenticated roles)
router.get(
  '/leaderboard',
  authenticate,
  authorize('student', 'instructor', 'admin'),
  analyticsController.getLeaderboard
);

// Faculty Assessment & Question Analytics (Instructor owner or Admin)
router.get(
  '/instructor/assessment/:id',
  authenticate,
  authorize('instructor', 'admin'),
  analyticsController.getInstructorAssessmentAnalytics
);

router.get(
  '/instructor/assessment/:id/questions',
  authenticate,
  authorize('instructor', 'admin'),
  analyticsController.getInstructorQuestionAnalytics
);

// Admin Platform Overview Analytics (Admin only)
router.get(
  '/admin/overview',
  authenticate,
  authorize('admin'),
  analyticsController.getAdminOverview
);

module.exports = router;
