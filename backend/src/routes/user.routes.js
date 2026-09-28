const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { avatarUpload } = require('../middleware/upload.middleware');

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), userController.uploadAvatar);
router.get('/students', authenticate, authorize('instructor', 'admin'), userController.getStudents);
router.get('/student/:id', authenticate, authorize('instructor', 'admin'), userController.getStudentProfile);

module.exports = router;
