// Express router assembling student certificate management endpoints
const express = require('express');
const router = express.Router();

// Controller managing student certificate actions
const certificateController = require('../controllers/certificate.controller');
// Authentication and RBAC middleware
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// Public certificate verification endpoint (unauthenticated)
// GET /api/certificates/verify/:code
router.get('/verify/:code', certificateController.verifyCertificate);

// Admin certificate and template management endpoints
router.get(
  '/admin/all',
  authenticate,
  authorize('admin'),
  certificateController.getAllCertificatesAdmin
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
  certificateController.createTemplateAdmin
);

router.patch(
  '/admin/templates/:id',
  authenticate,
  authorize('admin'),
  certificateController.updateTemplateAdmin
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
  certificateController.revokeCertificate
);

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

// Download certificate file endpoint (documents pending backend implementation)
// GET /api/certificates/:id/download
router.get(
  '/:id/download',
  authenticate,
  authorize('student'),
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
