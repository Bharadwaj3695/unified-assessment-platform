const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate, authorize('admin'));

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/users/pending', adminController.getPendingUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id/approve', adminController.approveUser);
router.put('/users/:id/reject', adminController.rejectUser);
router.put('/users/:id/revoke', adminController.revokeUser);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);
router.get('/assessments', adminController.getAllAssessments);
router.put('/assessments/:id/status', adminController.updateAssessmentStatus);
router.get('/logs', adminController.getLogs);
router.get('/alerts', adminController.getOperationalAlerts);
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
