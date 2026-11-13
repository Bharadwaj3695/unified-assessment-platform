// Import body validator builder from express-validator
const { body } = require('express-validator');

/**
 * Helper to compute combined duration in minutes
 */
const computeDurationMinutes = (Day, hours, minutes) => {
  const d = parseInt(Day, 10) || 0;
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  return (d * 24 * 60) + (h * 60) + m;
};

// Maximum permitted duration: 365 Day in minutes (525,600)
const MAX_DURATION_MINUTES = 365 * 24 * 60;

/**
 * Validation rules for saving an announcement draft
 */
const saveDraftValidator = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Announcement message is required')
    .isLength({ max: 500 })
    .withMessage('Announcement message cannot exceed 500 characters'),

  body('targetAudience')
    .optional()
    .isIn(['all', 'students', 'instructors', 'admins'])
    .withMessage('Target audience must be one of: all, students, instructors, admins'),

  body('durationDay')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration Day must be an integer greater than or equal to 0'),

  body('durationHours')
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage('Duration hours must be between 0 and 23'),

  body('durationMinutes')
    .optional()
    .isInt({ min: 0, max: 59 })
    .withMessage('Duration minutes must be between 0 and 59'),
];

/**
 * Validation rules for immediate publication of an announcement
 */
const publishAnnouncementValidator = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Announcement message is required')
    .isLength({ max: 500 })
    .withMessage('Announcement message cannot exceed 500 characters'),

  body('targetAudience')
    .optional()
    .isIn(['all', 'students', 'instructors', 'admins'])
    .withMessage('Target audience must be one of: all, students, instructors, admins'),

  body('durationDay')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration Day must be an integer greater than or equal to 0'),

  body('durationHours')
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage('Duration hours must be between 0 and 23'),

  body('durationMinutes')
    .optional()
    .isInt({ min: 0, max: 59 })
    .withMessage('Duration minutes must be between 0 and 59'),

  body().custom((value, { req }) => {
    const totalMinutes = computeDurationMinutes(
      req.body.durationDay,
      req.body.durationHours,
      req.body.durationMinutes
    );
    if (totalMinutes <= 0) {
      throw new Error('Announcement duration must be greater than 0 minutes');
    }
    if (totalMinutes > MAX_DURATION_MINUTES) {
      throw new Error('Announcement duration cannot exceed 365 Day');
    }
    return true;
  }),
];

/**
 * Validation rules for scheduled publication of an announcement
 */
const scheduleAnnouncementValidator = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Announcement message is required')
    .isLength({ max: 500 })
    .withMessage('Announcement message cannot exceed 500 characters'),

  body('targetAudience')
    .optional()
    .isIn(['all', 'students', 'instructors', 'admins'])
    .withMessage('Target audience must be one of: all, students, instructors, admins'),

  body('startDate')
    .notEmpty()
    .withMessage('Scheduled start date is required')
    .isISO8601()
    .withMessage('Scheduled start date must be a valid ISO 8601 date string')
    .custom((val) => {
      const scheduledDate = new Date(val);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Invalid scheduled start date');
      }
      // Allow up to 30 seconds clock skew tolerance, but reject clearly past dates
      const now = new Date(Date.now() - 30 * 1000);
      if (scheduledDate <= now) {
        throw new Error('Scheduled start time must be in the future');
      }
      return true;
    }),

  body('durationDay')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration Day must be an integer greater than or equal to 0'),

  body('durationHours')
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage('Duration hours must be between 0 and 23'),

  body('durationMinutes')
    .optional()
    .isInt({ min: 0, max: 59 })
    .withMessage('Duration minutes must be between 0 and 59'),

  body().custom((value, { req }) => {
    const totalMinutes = computeDurationMinutes(
      req.body.durationDay,
      req.body.durationHours,
      req.body.durationMinutes
    );
    if (totalMinutes <= 0) {
      throw new Error('Announcement duration must be greater than 0 minutes');
    }
    if (totalMinutes > MAX_DURATION_MINUTES) {
      throw new Error('Announcement duration cannot exceed 365 Day');
    }
    return true;
  }),
];

module.exports = {
  computeDurationMinutes,
  saveDraftValidator,
  publishAnnouncementValidator,
  scheduleAnnouncementValidator,
};
