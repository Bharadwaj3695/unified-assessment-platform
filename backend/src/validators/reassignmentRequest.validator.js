// Import body validator builder from express-validator
const { body } = require('express-validator');

// Validation rules array for student reassignment request submission
const createReassignmentRequestValidator = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason for request is required')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
    .custom((val) => {
      const nonWhitespace = (val || '').replace(/\s+/g, '');
      if (nonWhitespace.length < 10) {
        throw new Error('Reason must contain at least 10 non-whitespace characters');
      }
      return true;
    }),
];

// Validation rules array for instructor or admin review of reassignment requests
const reviewReassignmentRequestValidator = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Review decision status is required')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either approved or rejected'),
  body('reviewNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Review notes cannot exceed 500 characters'),
];

module.exports = {
  createReassignmentRequestValidator,
  reviewReassignmentRequestValidator,
};
