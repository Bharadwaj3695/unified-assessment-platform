// Import body validator builder from express-validator
const { body } = require('express-validator');

// Validation rules array for manual instructor submission evaluations (POST /api/evaluations/submission/:id)
const submitEvaluationValidator = [
  // Validate that finalScore if supplied is a non-negative floating point number
  body('finalScore').optional().isFloat({ min: 0 }).withMessage('Final score must be a non-negative number'),
  // Normalize generalFeedback string by trimming outer whitespace
  body('generalFeedback').optional().trim(),
  // Validate that questionFeedback if supplied is an object mapping question IDs to feedback sub-objects
  body('questionFeedback').optional().isObject().withMessage('Question feedback must be an object'),
  body('questionFeedback.*.pointsAwarded')
    .optional()
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        throw new Error('Points awarded must be a non-negative number');
      }
      return true;
    }),
];

// Export evaluation validation chain
module.exports = {
  submitEvaluationValidator,
};
