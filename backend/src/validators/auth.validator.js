const { body } = require('express-validator');

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .custom((value) => {
      if (value === 'admin') {
        throw new Error('Administrator accounts cannot be created via public registration');
      }
      if (value && !['student', 'instructor'].includes(value)) {
        throw new Error('Role must be student or instructor');
      }
      return true;
    }),
  body('instituteCode').optional().trim(),
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const updatePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
];

const mfaSetupConfirmValidator = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
];

const mfaVerifyValidator = [
  body('mfaToken').trim().notEmpty().withMessage('MFA challenge token is required'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('TOTP code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('TOTP code must be exactly 6 digits')
    .isNumeric()
    .withMessage('TOTP code must contain only numbers'),
];

const mfaRecoveryValidator = [
  body('mfaToken').trim().notEmpty().withMessage('MFA challenge token is required'),
  body('recoveryCode').trim().notEmpty().withMessage('Recovery code is required'),
];

const mfaDisableValidator = [
  body('password').optional().isString(),
  body('code').optional().isString(),
];

const refreshValidator = [
  body('refreshToken')
    .custom((value, { req }) => {
      const hasAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
      const token = value || (hasAuth ? req.headers.authorization.split(' ')[1] : null);
      if (!token || typeof token !== 'string' || !token.trim()) {
        throw new Error('Refresh token is required');
      }
      return true;
    }),
];

module.exports = {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
  mfaSetupConfirmValidator,
  mfaVerifyValidator,
  mfaRecoveryValidator,
  mfaDisableValidator,
  refreshValidator,
};
