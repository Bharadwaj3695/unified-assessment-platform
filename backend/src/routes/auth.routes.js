const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
} = require('../validators/auth.validator');

router.post('/register', registerValidator, validate, authController.register);
router.post('/login', loginValidator, validate, authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.put('/change-password', authenticate, updatePasswordValidator, validate, authController.changePassword);

module.exports = router;
