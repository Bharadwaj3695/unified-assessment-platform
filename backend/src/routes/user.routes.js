// Express web framework for constructing modular route handlers
const express = require('express');
// Initialize isolated Express Router instance for user profile and directory endpoints
const router = express.Router();
// Controller containing business logic for user profiles, avatar uploads, and student rosters
const userController = require('../controllers/user.controller');
// Authentication middleware enforcing valid access JWT and active account status
const { authenticate } = require('../middleware/auth.middleware');
// Role-Based Access Control middleware restricting actions to authorized roles
const { authorize } = require('../middleware/role.middleware');
// Multer file upload middleware configured specifically for user profile avatar images
const { avatarUpload } = require('../middleware/upload.middleware');

// Retrieve authenticated user's own profile data (GET /api/users/profile)
router.get('/profile', authenticate, userController.getProfile);
// Update authenticated user's editable profile attributes (PUT /api/users/profile) enforcing academic ID immutability
router.put('/profile', authenticate, userController.updateProfile);
// Upload new avatar image file for the current user (POST /api/users/avatar)
router.post('/avatar', authenticate, avatarUpload.single('avatar'), userController.uploadAvatar);
// Remove existing avatar image file for the current user (DELETE /api/users/avatar)
router.delete('/avatar', authenticate, userController.deleteAvatar);
// Retrieve student roster list for course assignment (GET /api/users/students) restricted to instructors and admins
router.get('/students', authenticate, authorize('instructor', 'admin'), userController.getStudents);
// Retrieve detailed student profile by student ID (GET /api/users/student/:id) restricted to instructors and admins
router.get('/student/:id', authenticate, authorize('instructor', 'admin'), userController.getStudentProfile);

// Export configured user router
module.exports = router;
