// Import the body validation middleware factory from the express-validator package
const { body } = require('express-validator');

// Define validation middleware chain for user registration endpoint
const registerValidator = [
  // Validate, sanitize, check non-empty, and check minimum length of 2 characters for the name field
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  // Validate email address format and normalize email to canonical lowercase form
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  // Validate that password meets the minimum length requirement of 6 characters
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  // Validate the optional confirmPassword field to ensure it matches password
  body('confirmPassword')
    // Make confirmPassword field optional in request body
    .optional()
    // Perform custom validation matching confirmPassword against the submitted password
    .custom((value, { req }) => {
      // Check if value is present and does not strictly equal req.body.password
      if (value && value !== req.body.password) {
        // Throw validation error when passwords do not match
        throw new Error('Passwords do not match');
      // Close password mismatch conditional check
      }
      // Return true to indicate successful validation
      return true;
    // Close custom validation function
    }),
  // Validate optional studentId field and trim whitespace
  body('studentId').optional().trim(),
  // Validate optional dateOfBirth field and trim whitespace
  body('dateOfBirth').optional().trim(),
  // Validate optional role field ensuring only valid roles can be registered publicly
  body('role')
    // Make role field optional, defaulting to student if omitted
    .optional()
    // Perform custom validation preventing self-assignment of admin role
    .custom((value) => {
      // Check if user is attempting to register with the admin role
      if (value === 'admin') {
        // Reject administrative registration attempts via public endpoint
        throw new Error('Administrator accounts cannot be created via public registration');
      // Close admin role check
      }
      // Ensure role is either 'student' or 'instructor' if specified
      if (value && !['student', 'instructor'].includes(value)) {
        // Reject invalid or unrecognized role strings
        throw new Error('Role must be student or instructor');
      // Close role inclusion check
      }
      // Return true to indicate valid role value
      return true;
    // Close custom role validation function
    }),
  // Validate optional instituteCode field and trim whitespace
  body('instituteCode').optional().trim(),
// End of registerValidator middleware array
];

// Define validation middleware chain for user login endpoint
const loginValidator = [
  // Validate, trim, and normalize the email field for user login
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  // Require that the password field is provided and not empty
  body('password').notEmpty().withMessage('Password is required'),
// End of loginValidator middleware array
];

// Define validation middleware chain for user password change endpoint
const updatePasswordValidator = [
  // Require that the current password field is provided
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  // Require that the new password is at least 6 characters long
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
// End of updatePasswordValidator middleware array
];

// Define validation middleware chain for confirming MFA setup with an authenticator app code
const mfaSetupConfirmValidator = [
  // Target the code field in the request body
  body('code')
    // Remove leading and trailing whitespace from the TOTP code
    .trim()
    // Require code to not be empty
    .notEmpty()
    // Provide error message if code is missing
    .withMessage('Verification code is required')
    // Require verification code to be exactly 6 characters in length
    .isLength({ min: 6, max: 6 })
    // Provide error message if code length is not exactly 6 characters
    .withMessage('Verification code must be exactly 6 digits')
    // Require verification code to contain digits only
    .isNumeric()
    // Provide error message if code contains non-numeric characters
    .withMessage('Verification code must contain only numbers'),
// End of mfaSetupConfirmValidator middleware array
];

// Define validation middleware chain for verifying second-factor TOTP challenge during login
const mfaVerifyValidator = [
  // Validate that mfaToken is provided and not empty
  body('mfaToken').trim().notEmpty().withMessage('MFA challenge token is required'),
  // Target the code field in the request body
  body('code')
    // Remove leading and trailing whitespace from the TOTP code
    .trim()
    // Require TOTP code to not be empty
    .notEmpty()
    // Provide error message if TOTP code is missing
    .withMessage('TOTP code is required')
    // Require TOTP code to be exactly 6 characters in length
    .isLength({ min: 6, max: 6 })
    // Provide error message if TOTP code length is not exactly 6 characters
    .withMessage('TOTP code must be exactly 6 digits')
    // Require TOTP code to contain digits only
    .isNumeric()
    // Provide error message if TOTP code contains non-numeric characters
    .withMessage('TOTP code must contain only numbers'),
// End of mfaVerifyValidator middleware array
];

// Define validation middleware chain for MFA recovery code verification during login
const mfaRecoveryValidator = [
  // Validate that mfaToken is provided and not empty
  body('mfaToken').trim().notEmpty().withMessage('MFA challenge token is required'),
  // Validate that recoveryCode is provided and not empty
  body('recoveryCode').trim().notEmpty().withMessage('Recovery code is required'),
// End of mfaRecoveryValidator middleware array
];

// Define validation middleware chain for disabling MFA on an account
const mfaDisableValidator = [
  // Validate that optional password field is a string if provided
  body('password').optional().isString(),
  // Validate that optional code field is a string if provided
  body('code').optional().isString(),
// End of mfaDisableValidator middleware array
];

// Define validation middleware chain for access token refresh endpoint
const refreshValidator = [
  // Target the refreshToken field in the request body
  body('refreshToken')
    // Custom validator to accept refreshToken from body or fallback to Bearer header
    .custom((value, { req }) => {
      // Check if authorization header exists and starts with Bearer prefix
      const hasAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
      // Extract token from body, cookie, or parse from authorization Bearer header
      const token = value || req.cookies?.uap_refresh || (hasAuth ? req.headers.authorization.split(' ')[1] : null);
      // Validate that token exists, is a string, and is not just whitespace
      if (!token || typeof token !== 'string' || !token.trim()) {
        // Throw validation error when no valid refresh token is found
        throw new Error('Refresh token is required');
      // Close token validity check
      }
      // Return true to indicate token is present and valid
      return true;
    // Close custom validation function
    }),
// End of refreshValidator middleware array
];

// Define validation middleware chain for initiating a forgotten password reset
const forgotPasswordValidator = [
  // Target the email field in the request body
  body('email')
    // Strip leading and trailing whitespace from email
    .trim()
    // Require email to not be empty
    .notEmpty()
    // Provide error message if email is missing
    .withMessage('Email is required')
    // Validate email format conforms to standard email syntax
    .isEmail()
    // Provide error message if email syntax is invalid
    .withMessage('Please provide a valid email address')
    // Normalize email to lowercase canonical format without stripping dots
    .normalizeEmail({ gmail_remove_dots: false }),
// End of forgotPasswordValidator middleware array
];

// Define validation middleware chain for completing password reset using a reset token
const resetPasswordValidator = [
  // Target the reset token field in the request body
  body('token')
    // Strip leading and trailing whitespace from the reset token
    .trim()
    // Require reset token to not be empty
    .notEmpty()
    // Provide error message if reset token is missing
    .withMessage('Reset token is required'),
  // Target the new password field in the request body
  body('password')
    // Validate that new password is at least 6 characters in length
    .isLength({ min: 6 })
    // Provide error message if new password has fewer than 6 characters
    .withMessage('Password must be at least 6 characters long'),
  // Target the optional confirmPassword field in the request body
  body('confirmPassword')
    // Mark confirmPassword as optional
    .optional()
    // Perform custom validation matching confirmPassword against the new password
    .custom((value, { req }) => {
      // Check if confirmPassword is provided and does not match new password
      if (value && value !== req.body.password) {
        // Throw error if passwords do not match
        throw new Error('Passwords do not match');
      // Close confirmation check
      }
      // Return true indicating matching confirmation password
      return true;
    // Close custom validation function
    }),
// End of resetPasswordValidator middleware array
];

// Export all authentication validator middleware arrays
module.exports = {
  // Export user registration validator
  registerValidator,
  // Export user login validator
  loginValidator,
  // Export user password change validator
  updatePasswordValidator,
  // Export MFA setup confirmation validator
  mfaSetupConfirmValidator,
  // Export MFA TOTP verification validator
  mfaVerifyValidator,
  // Export MFA backup recovery code validator
  mfaRecoveryValidator,
  // Export MFA disable validator
  mfaDisableValidator,
  // Export refresh token validator
  refreshValidator,
  // Export forgot password validator
  forgotPasswordValidator,
  // Export reset password validator
  resetPasswordValidator,
// End of module.exports object
};
