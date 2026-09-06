const { body } = require('express-validator');

const submitEvaluationValidator = [
  body('finalScore').optional().isFloat({ min: 0 }).withMessage('Final score must be a non-negative number'),
  body('generalFeedback').optional().trim(),
  body('questionFeedback').optional().isObject().withMessage('Question feedback must be an object'),
];

module.exports = {
  submitEvaluationValidator,
};
