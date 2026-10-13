// Import body validator builder from express-validator
const { body } = require('express-validator');

// Validation rules array for assessment creation (POST /api/assessments)
const createAssessmentValidator = [
  // Validate that title is non-empty, trimmed, and at least 3 characters long
  body('title').trim().notEmpty().withMessage('Assessment title is required').isLength({ min: 3 }),
  // Validate that durationMinutes is an integer of at least 1 minute
  body('durationMinutes').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  // Validate that passingScore if provided is an integer percentage between 0 and 100
  body('passingScore').optional().isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  // Validate that category if provided is non-empty after trimming whitespace
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
  // Validate that accessType if provided is either public or restricted
  body('accessType').optional().isIn(['public', 'restricted']).withMessage('accessType must be public or restricted'),
  // Validate that assignedStudents if provided is a valid JSON array
  body('assignedStudents').optional().isArray().withMessage('assignedStudents must be an array of student IDs'),
  // Validate that each entry in assignedStudents is a valid MongoDB ObjectId
  body('assignedStudents.*').optional().isMongoId().withMessage('Each assigned student must be a valid User ID'),
  // Validate that status if provided is one of draft, published, or archived
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Status must be draft, published, or archived'),
  // Validate that questions if provided is an array
  body('questions').optional().isArray().withMessage('Questions must be an array'),
  // Validate question prompt text within questions array
  body('questions.*.questionText').optional().trim().notEmpty().withMessage('Question text is required'),
  // Validate allowed question type formats
  body('questions.*.type').optional().isIn(['mcq', 'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'code', 'file_upload']).withMessage('Invalid question type'),
  // Validate that points per question must be positive integer of at least 1
  body('questions.*.points').optional().isInt({ min: 1 }).withMessage('Points must be at least 1'),
  // Validate that fileUploadConfig if provided is an object
  body('questions.*.fileUploadConfig').optional().isObject().withMessage('fileUploadConfig must be an object'),
  // Validate that proctoringEnabled is boolean
  body('proctoringEnabled').optional().isBoolean().withMessage('proctoringEnabled must be a boolean'),
  // Validate that cameraRequired is boolean
  body('cameraRequired').optional().isBoolean().withMessage('cameraRequired must be a boolean'),
];

// Validation rules array for assessment updates (PUT /api/assessments/:id)
const updateAssessmentValidator = [
  // Validate title if supplied is non-empty after trimming
  body('title').optional().trim().notEmpty().withMessage('Assessment title cannot be empty'),
  // Validate durationMinutes if supplied is integer >= 1
  body('durationMinutes').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  // Validate passingScore if supplied is integer between 0 and 100
  body('passingScore').optional().isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  // Validate category if supplied is non-empty
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
  // Validate status if supplied is draft, published, or archived
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Status must be draft, published, or archived'),
  // Validate accessType if supplied is public or restricted
  body('accessType').optional().isIn(['public', 'restricted']).withMessage('accessType must be public or restricted'),
  // Validate assignedStudents if supplied is array
  body('assignedStudents').optional().isArray().withMessage('assignedStudents must be an array of student IDs'),
  // Validate each assigned student ID is valid MongoDB ObjectId
  body('assignedStudents.*').optional().isMongoId().withMessage('Each assigned student must be a valid User ID'),
  // Validate questions array if supplied
  body('questions').optional().isArray().withMessage('Questions must be an array'),
  // Validate question prompt text within questions array
  body('questions.*.questionText').optional().trim().notEmpty().withMessage('Question text is required'),
  // Validate allowed question type formats
  body('questions.*.type').optional().isIn(['mcq', 'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'code', 'file_upload']).withMessage('Invalid question type'),
  // Validate that points per question must be positive integer of at least 1
  body('questions.*.points').optional().isInt({ min: 1 }).withMessage('Points must be at least 1'),
  // Validate that fileUploadConfig if provided is an object
  body('questions.*.fileUploadConfig').optional().isObject().withMessage('fileUploadConfig must be an object'),
  // Validate that proctoringEnabled is boolean
  body('proctoringEnabled').optional().isBoolean().withMessage('proctoringEnabled must be a boolean'),
  // Validate that cameraRequired is boolean
  body('cameraRequired').optional().isBoolean().withMessage('cameraRequired must be a boolean'),
];

// Export assessment validation chains
module.exports = {
  createAssessmentValidator,
  updateAssessmentValidator,
};
