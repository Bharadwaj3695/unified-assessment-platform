const { body, param, query } = require('express-validator');

/**
 * Validation rules for certificate and template management requests.
 */

const createTemplateValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Certificate template title is required')
    .isLength({ min: 3 })
    .withMessage('Template title must be at least 3 characters'),
  body('orientation')
    .optional()
    .isIn(['landscape', 'portrait'])
    .withMessage('Orientation must be either landscape or portrait'),
  body('pageSize')
    .optional()
    .isIn(['A4', 'Letter'])
    .withMessage('Page size must be either A4 or Letter'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean flag'),
  body('canvas.borderStyle')
    .optional()
    .isIn(['classic-gold', 'modern-slate', 'ornate-bronze', 'minimal-navy', 'none'])
    .withMessage('Invalid border style selection'),
];

const updateTemplateValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Template title must be at least 3 characters'),
  body('orientation')
    .optional()
    .isIn(['landscape', 'portrait'])
    .withMessage('Orientation must be either landscape or portrait'),
  body('pageSize')
    .optional()
    .isIn(['A4', 'Letter'])
    .withMessage('Page size must be either A4 or Letter'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean flag'),
  body('canvas.borderStyle')
    .optional()
    .isIn(['classic-gold', 'modern-slate', 'ornate-bronze', 'minimal-navy', 'none'])
    .withMessage('Invalid border style selection'),
];

const revokeCertificateValidator = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Revocation reason is required')
    .isLength({ min: 3 })
    .withMessage('Revocation reason must be at least 3 characters'),
];

const updateCertificationSettingsValidator = [
  body('institutionName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Institution name cannot be empty'),
  body('defaultSignatoryName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Signatory name cannot be empty'),
  body('autoEmailCertificates')
    .optional()
    .isBoolean()
    .withMessage('autoEmailCertificates must be a boolean flag'),
];

module.exports = {
  createTemplateValidator,
  updateTemplateValidator,
  revokeCertificateValidator,
  updateCertificationSettingsValidator,
};
