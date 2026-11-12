// Import the Express framework module to define routes and middleware
const express = require('express');
// Create a new Express router instance to handle authentication-related endpoints
const router = express.Router();
// Import the authentication controller handling core authentication business logic
const authController = require('../controllers/auth.controller');
// Import the JWT authentication middleware to secure protected routes
const { authenticate } = require('../middleware/auth.middleware');
// Import the CSRF protection middleware for cookie-authenticated endpoints
const { csrfProtection } = require('../middleware/csrf.middleware');
// Import the validation middleware to check for express-validator validation errors
const { validate } = require('../middleware/validation.middleware');
// Destructure and import request validation rule sets for authentication routes
const {
  // Validator rule set for user registration requests
  registerValidator,
  // Validator rule set for user login credentials
  loginValidator,
  // Validator rule set for updating user passwords
  updatePasswordValidator,
  // Validator rule set for confirming MFA setup with TOTP code
  mfaSetupConfirmValidator,
  // Validator rule set for verifying MFA during 2FA login challenge
  mfaVerifyValidator,
  // Validator rule set for requesting an emailed one-time sign-in code
  mfaEmailOtpSendValidator,
  // Validator rule set for MFA account recovery using backup codes
  mfaRecoveryValidator,
  // Validator rule set for disabling MFA security
  mfaDisableValidator,
  // Validator rule set for JWT token refresh requests
  refreshValidator,
  // Validator rule set for initiating forgot-password reset requests
  forgotPasswordValidator,
  // Validator rule set for completing password reset with token
  resetPasswordValidator,
// End of validator rule imports from auth.validator
} = require('../validators/auth.validator');

// Route handling student and faculty user registration with validation checks
router.post('/register', registerValidator, validate, authController.register);
// Route handling user login authentication and credential verification
router.post('/login', loginValidator, validate, authController.login);
// Route handling JWT access token refresh using a valid refresh token (with CSRF verification)
router.post('/refresh', csrfProtection, refreshValidator, validate, authController.refresh);
// Route handling user session logout and cookie clearing (with CSRF verification)
router.post('/logout', csrfProtection, authController.logout);
// Route handling global user session termination across all devices (with CSRF verification)
router.post('/logout-all', authenticate, csrfProtection, authController.logoutAll);
// Route handling retrieval of authenticated user's profile information
router.get('/profile', authenticate, authController.getProfile);
// Route handling password change requests for authenticated users
router.put('/change-password', authenticate, updatePasswordValidator, validate, authController.changePassword);
// Route handling password reset request initiation by sending reset email
router.post('/forgot-password', forgotPasswordValidator, validate, authController.forgotPassword);
// Route handling password reset execution using verified token and new password
router.post('/reset-password', resetPasswordValidator, validate, authController.resetPassword);

// Multi-Factor Authentication (MFA / 2FA) routes
// Route handling MFA setup initiation and TOTP secret generation for authenticated users
router.post('/mfa/setup', authenticate, authController.mfaSetup);
// Route handling MFA confirmation by validating initial 6-digit TOTP code
router.post('/mfa/setup-confirm', authenticate, mfaSetupConfirmValidator, validate, authController.mfaSetupConfirm);
// Route handling verification of 6-digit MFA challenge code during login
router.post('/mfa/verify', mfaVerifyValidator, validate, authController.mfaVerify);
// Route emailing a one-time sign-in code as an alternative to the authenticator app during login
router.post('/mfa/email-otp/send', mfaEmailOtpSendValidator, validate, authController.mfaSendEmailOtp);
// Route handling MFA emergency login recovery using a one-time backup recovery code
router.post('/mfa/recovery', mfaRecoveryValidator, validate, authController.mfaRecovery);
// Route handling disabling of MFA protection for authenticated users
router.post('/mfa/disable', authenticate, mfaDisableValidator, validate, authController.mfaDisable);
// Route handling regeneration of MFA backup recovery codes for authenticated users
router.post('/mfa/regenerate-recovery-codes', authenticate, mfaDisableValidator, validate, authController.mfaRegenerateRecoveryCodes);

// Google OAuth 2.0 / OpenID Connect routes
// Route returning Google OAuth 2.0 authorization URL for client redirection
router.get('/google/url', authController.getGoogleAuthUrl);
// Route exchanging Google authorization code or ID token for user session
router.post('/google', authController.googleLogin);
// Route handling Google OAuth redirect callback endpoint
router.get('/google/callback', authController.googleAuthCallback);

// Export the configured router instance for mounting in the Express application
module.exports = router;
