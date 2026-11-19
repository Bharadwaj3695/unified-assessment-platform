// Express router assembling student certificate and administrator Certification Studio endpoints
const express = require('express');
const router = express.Router();

// Controller managing student certificate actions and admin Certification Studio
const certificateController = require('../controllers/certificate.controller');
// Authentication and RBAC middleware
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
// Schema validation middleware formatting express-validator field rules
const { validate } = require('../middleware/validation.middleware');
// Field validation rules
const {
  createTemplateValidator,
  updateTemplateValidator,
  revokeCertificateValidator,
  updateCertificationSettingsValidator,
} = require('../validators/certificate.validator');

// 1. Public certificate verification endpoint (unauthenticated)
// GET /api/certificates/verify/:code
router.get('/verify/:code', certificateController.verifyCertificate);

// 2. Administrator Certification Studio Endpoints
router.get(
  '/admin/all',
  authenticate,
  authorize('admin'),
  certificateController.getAllCertificatesAdmin
);

router.get(
  '/admin/analytics',
  authenticate,
  authorize('admin'),
  certificateController.getIssuanceAnalyticsAdmin
);

router.get(
  '/admin/settings',
  authenticate,
  authorize('admin'),
  certificateController.getCertificationSettingsAdmin
);

router.put(
  '/admin/settings',
  authenticate,
  authorize('admin'),
  updateCertificationSettingsValidator,
  validate,
  certificateController.updateCertificationSettingsAdmin
);

router.get(
  '/admin/templates',
  authenticate,
  authorize('admin'),
  certificateController.listTemplatesAdmin
);

router.post(
  '/admin/templates',
  authenticate,
  authorize('admin'),
  createTemplateValidator,
  validate,
  certificateController.createTemplateAdmin
);

router.post(
  '/admin/templates/preview',
  authenticate,
  authorize('admin'),
  certificateController.previewTemplateAdmin
);

router.get(
  '/admin/templates/:id',
  authenticate,
  authorize('admin'),
  certificateController.getTemplateByIdAdmin
);

router.patch(
  '/admin/templates/:id/set-default',
  authenticate,
  authorize('admin'),
  certificateController.setDefaultTemplateAdmin
);

router.patch(
  '/admin/templates/:id',
  authenticate,
  authorize('admin'),
  updateTemplateValidator,
  validate,
  certificateController.updateTemplateAdmin
);

router.get(
  '/admin/:id/download',
  authenticate,
  authorize('admin'),
  certificateController.downloadCertificate
);

router.get(
  '/admin/:id',
  authenticate,
  authorize('admin'),
  certificateController.getCertificateDetailsAdmin
);

router.patch(
  '/admin/:id/revoke',
  authenticate,
  authorize('admin'),
  revokeCertificateValidator,
  validate,
  certificateController.revokeCertificate
);

router.post(
  '/admin/:id/retry-email',
  authenticate,
  authorize('admin'),
  certificateController.retryEmailDeliveryAdmin
);

router.post(
  '/admin/:id/retry-issuance',
  authenticate,
  authorize('admin'),
  certificateController.retryIssuanceAdmin
);

// 3. Student Certificate Endpoints
// Retrieve all certificates earned by the authenticated student
// GET /api/certificates/mine
router.get(
  '/mine',
  authenticate,
  authorize('student'),
  certificateController.getMyCertificates
);

// Alternative canonical endpoint for student certificates collection
// GET /api/certificates
router.get(
  '/',
  authenticate,
  authorize('student'),
  certificateController.getMyCertificates
);

// Download certificate PDF endpoint (authorized for student owner or admin)
// GET /api/certificates/:id/download
router.get(
  '/:id/download',
  authenticate,
  authorize('student', 'admin'),
  certificateController.downloadCertificate
);

// Retrieve details for a specific certificate owned by the authenticated student
// GET /api/certificates/:id
router.get(
  '/:id',
  authenticate,
  authorize('student'),
  certificateController.getCertificateById
);

module.exports = router;
