const { body, query, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  };
};

const createQuestionValidator = validate([
  body('questionText')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Question text prompt must be at least 3 characters long'),
  body('type')
    .optional()
    .isIn(['mcq', 'short_answer', 'long_answer', 'file_upload'])
    .withMessage('Invalid question type. Allowed: mcq, short_answer, long_answer, file_upload'),
  body('points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  body('difficulty')
    .optional()
    .toUpperCase()
    .isIn(['EASY', 'MEDIUM', 'HARD'])
    .withMessage('Difficulty must be EASY, MEDIUM, or HARD'),
  body('bloomLevel')
    .optional()
    .toUpperCase()
    .isIn(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'])
    .withMessage('Bloom taxonomy level must be one of: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE'),
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  body('correctAnswer')
    .optional()
    .trim(),
]);

const updateQuestionValidator = validate([
  body('questionText')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Question text prompt must be at least 3 characters long'),
  body('type')
    .optional()
    .isIn(['mcq', 'short_answer', 'long_answer', 'file_upload'])
    .withMessage('Invalid question type. Allowed: mcq, short_answer, long_answer, file_upload'),
  body('points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  body('difficulty')
    .optional()
    .toUpperCase()
    .isIn(['EASY', 'MEDIUM', 'HARD'])
    .withMessage('Difficulty must be EASY, MEDIUM, or HARD'),
  body('bloomLevel')
    .optional()
    .toUpperCase()
    .isIn(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'])
    .withMessage('Bloom taxonomy level must be one of: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE'),
]);

const reviewQuestionValidator = validate([
  body('action')
    .trim()
    .toUpperCase()
    .isIn(['ACCEPT', 'REJECT'])
    .withMessage('Review action must be either ACCEPT or REJECT'),
]);

const bulkReviewValidator = validate([
  body('tempIds')
    .isArray({ min: 1 })
    .withMessage('tempIds must be a non-empty array of question temporary identifiers'),
  body('action')
    .trim()
    .toUpperCase()
    .isIn(['ACCEPT', 'REJECT'])
    .withMessage('Bulk review action must be either ACCEPT or REJECT'),
]);

const googleFormsImportValidator = validate([
  body('formsUrlOrId')
    .custom((val) => {
      if (typeof val === 'string' && val.trim().length > 0) return true;
      if (typeof val === 'object' && val !== null) return true;
      throw new Error('Valid Google Form URL, Form ID, or form structure object is required');
    }),
]);

module.exports = {
  createQuestionValidator,
  updateQuestionValidator,
  reviewQuestionValidator,
  bulkReviewValidator,
  googleFormsImportValidator,
};
