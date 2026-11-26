const { body } = require('express-validator');

const createInterviewValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Interview title is required')
    .isLength({ min: 3 })
    .withMessage('Interview title must be at least 3 characters'),
  body('instructions').optional().isString().trim(),
  body('interviewType')
    .optional()
    .isIn(['technical', 'viva', 'oral_assessment', 'project_review'])
    .withMessage('Invalid interviewType'),
  body('studentId')
    .notEmpty()
    .withMessage('Assigned student is required')
    .isMongoId()
    .withMessage('studentId must be a valid User ID'),
  body('scheduledStartAt').optional({ nullable: true }).isISO8601().withMessage('scheduledStartAt must be ISO8601 date'),
  body('scheduledEndAt').optional({ nullable: true }).isISO8601().withMessage('scheduledEndAt must be ISO8601 date'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 5, max: 240 })
    .withMessage('durationMinutes must be between 5 and 240'),
  body('passingPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('passingPercentage must be between 0 and 100'),
  body('status')
    .optional()
    .isIn(['draft', 'scheduled', 'ready'])
    .withMessage('Initial status must be draft, scheduled, or ready'),
  body('questions').optional().isArray().withMessage('questions must be an array'),
  body('proctoringConfig').optional().isObject().withMessage('proctoringConfig must be an object'),
  body('proctoringConfig.cameraProctoringEnabled').optional().isBoolean(),
  body('proctoringConfig.aiProctoringEnabled').optional().isBoolean(),
  body('proctoringConfig.liveMonitoringEnabled').optional().isBoolean(),
  body('proctoringConfig.cameraPermissionRequired').optional().isBoolean(),
  body('proctoringConfig.disclosureText').optional().isString().trim(),
];

const updateInterviewValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Interview title must be at least 3 characters'),
  body('instructions').optional().isString().trim(),
  body('interviewType')
    .optional()
    .isIn(['technical', 'viva', 'oral_assessment', 'project_review'])
    .withMessage('Invalid interviewType'),
  body('studentId').optional().isMongoId().withMessage('studentId must be a valid User ID'),
  body('scheduledStartAt').optional({ nullable: true }).isISO8601().withMessage('scheduledStartAt must be ISO8601 date'),
  body('scheduledEndAt').optional({ nullable: true }).isISO8601().withMessage('scheduledEndAt must be ISO8601 date'),
  body('durationMinutes').optional().isInt({ min: 5, max: 240 }),
  body('passingPercentage').optional().isFloat({ min: 0, max: 100 }),
  body('questions').optional().isArray(),
  body('proctoringConfig').optional().isObject(),
  body('proctoringConfig.cameraProctoringEnabled').optional().isBoolean(),
  body('proctoringConfig.aiProctoringEnabled').optional().isBoolean(),
  body('proctoringConfig.liveMonitoringEnabled').optional().isBoolean(),
  body('proctoringConfig.cameraPermissionRequired').optional().isBoolean(),
  body('proctoringConfig.disclosureText').optional().isString().trim(),
];

const transitionInterviewValidator = [
  body('status')
    .notEmpty()
    .withMessage('Target status is required')
    .isIn(['draft', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid target status'),
  body('reason').optional().isString().trim(),
  body('scheduledStartAt').optional({ nullable: true }).isISO8601(),
  body('scheduledEndAt').optional({ nullable: true }).isISO8601(),
];

const rescheduleInterviewValidator = [
  body('scheduledStartAt').notEmpty().withMessage('scheduledStartAt is required').isISO8601(),
  body('scheduledEndAt').optional({ nullable: true }).isISO8601(),
  body('durationMinutes').optional().isInt({ min: 5, max: 240 }),
];

const transcriptSegmentValidator = [
  body('speakerRole')
    .notEmpty()
    .isIn(['faculty', 'student'])
    .withMessage('speakerRole must be faculty or student'),
  body('text').optional().isString().trim(),
  body('status').optional().isIn(['final', 'unclear', 'edited']),
  body('confidence').optional({ nullable: true }).isFloat({ min: 0, max: 1 }),
  body('startTimestamp').optional({ nullable: true }).isISO8601(),
  body('endTimestamp').optional({ nullable: true }).isISO8601(),
];

const mediaControlValidator = [
  body('command')
    .notEmpty()
    .isIn([
      'STUDENT_CAMERA_ENABLE',
      'STUDENT_CAMERA_DISABLE',
      'STUDENT_MIC_ENABLE',
      'STUDENT_MIC_DISABLE',
    ])
    .withMessage('Invalid media control command'),
];

module.exports = {
  createInterviewValidator,
  updateInterviewValidator,
  transitionInterviewValidator,
  rescheduleInterviewValidator,
  transcriptSegmentValidator,
  mediaControlValidator,
};
