const { body } = require('express-validator');

const createAssessmentValidator = [
  body('title').trim().notEmpty().withMessage('Assessment title is required').isLength({ min: 3 }),
  body('durationMinutes').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('passingScore').optional().isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
  body('accessType').optional().isIn(['public', 'restricted']).withMessage('accessType must be public or restricted'),
  body('assignedStudents').optional().isArray().withMessage('assignedStudents must be an array of student IDs'),
  body('assignedStudents.*').optional().isMongoId().withMessage('Each assigned student must be a valid User ID'),
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Status must be draft, published, or archived'),
  body('questions').optional().isArray().withMessage('Questions must be an array'),
  body('questions.*.questionText').optional().trim().notEmpty().withMessage('Question text is required'),
  body('questions.*.type').optional().isIn(['mcq', 'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'code']).withMessage('Invalid question type'),
  body('questions.*.points').optional().isInt({ min: 1 }).withMessage('Points must be at least 1'),
];

const updateAssessmentValidator = [
  body('title').optional().trim().notEmpty().withMessage('Assessment title cannot be empty'),
  body('durationMinutes').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('passingScore').optional().isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Status must be draft, published, or archived'),
  body('accessType').optional().isIn(['public', 'restricted']).withMessage('accessType must be public or restricted'),
  body('assignedStudents').optional().isArray().withMessage('assignedStudents must be an array of student IDs'),
  body('assignedStudents.*').optional().isMongoId().withMessage('Each assigned student must be a valid User ID'),
  body('questions').optional().isArray().withMessage('Questions must be an array'),
  body('questions.*.questionText').optional().trim().notEmpty().withMessage('Question text is required'),
  body('questions.*.type').optional().isIn(['mcq', 'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'code']).withMessage('Invalid question type'),
  body('questions.*.points').optional().isInt({ min: 1 }).withMessage('Points must be at least 1'),
];

module.exports = {
  createAssessmentValidator,
  updateAssessmentValidator,
};
