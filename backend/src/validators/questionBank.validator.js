// Import express-validator helpers for body/query validation and error extraction
const { body, validationResult } = require('express-validator');

// Higher-order validation middleware runner executing an array of express-validator rules
const validate = (validations) => {
  // Returns Express middleware running validation array concurrently
  return async (req, res, next) => {
    // Run all validations in parallel across the current HTTP request
    await Promise.all(validations.map((validation) => validation.run(req)));
    // Extract any errors produced by the validation rules
    const errors = validationResult(req);
    // If no errors were generated, pass control to the next handler
    if (errors.isEmpty()) {
      return next();
    }
    // Return HTTP 422 Unprocessable Entity with error list
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  };
};

// Validation chain for creating a new Question Bank repository entry
const createQuestionValidator = validate([
  // Validate question prompt is at least 3 characters
  body('questionText')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Question text prompt must be at least 3 characters long'),
  // Validate allowed question type formats
  body('type')
    .optional()
    .isIn(['mcq', 'short_answer', 'long_answer', 'file_upload'])
    .withMessage('Invalid question type. Allowed: mcq, short_answer, long_answer, file_upload'),
  // Validate points must be positive integer
  body('points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  // Validate difficulty rating
  body('difficulty')
    .optional()
    .toUpperCase()
    .isIn(['EASY', 'MEDIUM', 'HARD'])
    .withMessage('Difficulty must be EASY, MEDIUM, or HARD'),
  // Validate Bloom's Taxonomy cognitive tier
  body('bloomLevel')
    .optional()
    .toUpperCase()
    .isIn(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'])
    .withMessage('Bloom taxonomy level must be one of: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE'),
  // Validate options array
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  // Trim correct answer string
  body('correctAnswer')
    .optional()
    .trim(),
]);

// Validation chain for modifying an existing Question Bank entry
const updateQuestionValidator = validate([
  // Validate updated prompt if supplied
  body('questionText')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Question text prompt must be at least 3 characters long'),
  // Validate updated question type
  body('type')
    .optional()
    .isIn(['mcq', 'short_answer', 'long_answer', 'file_upload'])
    .withMessage('Invalid question type. Allowed: mcq, short_answer, long_answer, file_upload'),
  // Validate updated point value
  body('points')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  // Validate updated difficulty
  body('difficulty')
    .optional()
    .toUpperCase()
    .isIn(['EASY', 'MEDIUM', 'HARD'])
    .withMessage('Difficulty must be EASY, MEDIUM, or HARD'),
  // Validate updated Bloom level
  body('bloomLevel')
    .optional()
    .toUpperCase()
    .isIn(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'])
    .withMessage('Bloom taxonomy level must be one of: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE'),
]);

// Validation chain for individual question review decisions ('ACCEPT' or 'REJECT')
const reviewQuestionValidator = validate([
  // Validate review decision action string
  body('action')
    .trim()
    .toUpperCase()
    .isIn(['ACCEPT', 'REJECT'])
    .withMessage('Review action must be either ACCEPT or REJECT'),
]);

// Validation chain for bulk review decisions applied to multiple staged questions
const bulkReviewValidator = validate([
  // Validate array of temporary question IDs
  body('tempIds')
    .isArray({ min: 1 })
    .withMessage('tempIds must be a non-empty array of question temporary identifiers'),
  // Validate bulk review action
  body('action')
    .trim()
    .toUpperCase()
    .isIn(['ACCEPT', 'REJECT'])
    .withMessage('Bulk review action must be either ACCEPT or REJECT'),
]);

// Validation chain for Google Forms import payload
const googleFormsImportValidator = validate([
  // Custom validation rule accepting either a form URL string, form ID string, or structure object
  body('formsUrlOrId')
    .custom((val) => {
      // Allow non-empty string URL or ID
      if (typeof val === 'string' && val.trim().length > 0) return true;
      // Allow structured object payload
      if (typeof val === 'object' && val !== null) return true;
      // Throw error if input is neither valid string nor object
      throw new Error('Valid Google Form URL, Form ID, or form structure object is required');
    }),
]);

// Export question bank and import validation chains
module.exports = {
  createQuestionValidator,
  updateQuestionValidator,
  reviewQuestionValidator,
  bulkReviewValidator,
  googleFormsImportValidator,
};
