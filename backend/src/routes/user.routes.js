const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

router.put('/profile', authenticate, userController.updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);
router.get('/students', authenticate, authorize('instructor', 'admin'), userController.getStudents);

module.exports = router;
