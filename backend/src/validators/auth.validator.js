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

module.exports = {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
};
