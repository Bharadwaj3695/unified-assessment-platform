const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
  mfaSetupConfirmValidator,
  mfaVerifyValidator,
  mfaRecoveryValidator,
  mfaDisableValidator,
  refreshValidator,
} = require('../validators/auth.validator');

router.post('/register', registerValidator, validate, authController.register);
router.post('/login', loginValidator, validate, authController.login);
router.post('/refresh', refreshValidator, validate, authController.refresh);
router.get('/profile', authenticate, authController.getProfile);
router.put('/change-password', authenticate, updatePasswordValidator, validate, authController.changePassword);

// Multi-Factor Authentication (MFA / 2FA) routes
router.post('/mfa/setup', authenticate, authController.mfaSetup);
router.post('/mfa/setup-confirm', authenticate, mfaSetupConfirmValidator, validate, authController.mfaSetupConfirm);
router.post('/mfa/verify', mfaVerifyValidator, validate, authController.mfaVerify);
router.post('/mfa/recovery', mfaRecoveryValidator, validate, authController.mfaRecovery);
router.post('/mfa/disable', authenticate, mfaDisableValidator, validate, authController.mfaDisable);
router.post('/mfa/regenerate-recovery-codes', authenticate, mfaDisableValidator, validate, authController.mfaRegenerateRecoveryCodes);

// Google OAuth 2.0 / OpenID Connect routes
router.get('/google/url', authController.getGoogleAuthUrl);
router.post('/google', authController.googleLogin);
router.get('/google/callback', authController.googleAuthCallback);

module.exports = router;
