// Import CertificateService containing business logic for student credential retrieval, PDF streaming, and admin controls
const certificateService = require('../services/certificate.service');
// Import standardized API response formatting helpers
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Controller handling student certificate endpoints and administrator Certification Studio actions.
 */
class CertificateController {
  /**
   * Retrieves all certificates belonging to the authenticated student.
   * Student identity is resolved strictly from req.user.id (JWT claims).
   * GET /api/certificates/mine
   * GET /api/certificates
   */
  async getMyCertificates(req, res, next) {
    try {
      const studentId = req.user.id;
      const certificates = await certificateService.getStudentCertificates(studentId);
      return successResponse(res, 'Certificates retrieved successfully', certificates);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves single certificate details by identifier for the authenticated student.
   * GET /api/certificates/:id
   */
  async getCertificateById(req, res, next) {
    try {
      const certificate = await certificateService.getCertificateById(
        req.params.id,
        req.user.id
      );
      return successResponse(res, 'Certificate retrieved successfully', certificate);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dispatches download action for a certificate (returns streaming PDF).
   * Authorized for the owning student OR an administrator.
   * GET /api/certificates/:id/download
   */
  async downloadCertificate(req, res, next) {
    try {
      const result = await certificateService.downloadCertificate(
        req.params.id,
        req.user
      );

      res.setHeader('Content-Type', result.contentType || 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename || 'certificate.pdf'}"`
      );
      res.setHeader('Content-Length', result.buffer.length);
      return res.status(200).send(result.buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public verification endpoint verifying credential authenticity without leaking sensitive student PII.
   * GET /api/certificates/verify/:code
   */
  async verifyCertificate(req, res, next) {
    try {
      const result = await certificateService.verifyCertificate(req.params.code);
      if (!result.valid) {
        return errorResponse(res, result.message, 404);
      }
      return successResponse(res, 'Certificate verified successfully', result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator certificate registry inspection with search, status filters, and pagination.
   * GET /api/certificates/admin/all
   */
  async getAllCertificatesAdmin(req, res, next) {
    try {
      const { search, status, assessmentId, emailStatus, page, limit } = req.query;
      const data = await certificateService.getAllCertificatesAdmin({
        search,
        status,
        assessmentId,
        emailStatus,
        page,
        limit,
      });
      return successResponse(res, 'Certificates retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator certificate details inspection.
   * GET /api/certificates/admin/:id
   */
  async getCertificateDetailsAdmin(req, res, next) {
    try {
      const certificate = await certificateService.getCertificateDetailsAdmin(req.params.id);
      return successResponse(res, 'Certificate details retrieved successfully', certificate);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator certificate revocation with mandatory reason.
   * PATCH /api/certificates/admin/:id/revoke
   */
  async revokeCertificate(req, res, next) {
    try {
      const { reason } = req.body;
      const certificate = await certificateService.revokeCertificate(
        req.params.id,
        req.user.id,
        reason
      );
      return successResponse(res, 'Certificate revoked successfully', certificate);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator template listing.
   * GET /api/certificates/admin/templates
   */
  async listTemplatesAdmin(req, res, next) {
    try {
      const templates = await certificateService.getTemplatesAdmin({ status: req.query.status });
      return successResponse(res, 'Templates retrieved successfully', templates);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator single template details.
   * GET /api/certificates/admin/templates/:id
   */
  async getTemplateByIdAdmin(req, res, next) {
    try {
      const template = await certificateService.getTemplateByIdAdmin(req.params.id);
      return successResponse(res, 'Template retrieved successfully', template);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator template creation.
   * POST /api/certificates/admin/templates
   */
  async createTemplateAdmin(req, res, next) {
    try {
      const template = await certificateService.createTemplateAdmin(req.user.id, req.body);
      return successResponse(res, 'Certificate template created successfully', template, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator template modification.
   * PATCH /api/certificates/admin/templates/:id
   */
  async updateTemplateAdmin(req, res, next) {
    try {
      const template = await certificateService.updateTemplateAdmin(
        req.params.id,
        req.user.id,
        req.body
      );
      return successResponse(res, 'Certificate template updated successfully', template);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator set template as system-wide default.
   * PATCH /api/certificates/admin/templates/:id/set-default
   */
  async setDefaultTemplateAdmin(req, res, next) {
    try {
      const template = await certificateService.setDefaultTemplateAdmin(
        req.params.id,
        req.user.id
      );
      return successResponse(res, 'Default template updated successfully', template);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator template live preview PDF streaming.
   * POST /api/certificates/admin/templates/preview
   */
  async previewTemplateAdmin(req, res, next) {
    try {
      const pdfBuffer = await certificateService.previewTemplate(req.body);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="template-preview.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator Certification Studio issuance & delivery analytics.
   * GET /api/certificates/admin/analytics
   */
  async getIssuanceAnalyticsAdmin(req, res, next) {
    try {
      const analytics = await certificateService.getIssuanceAnalyticsAdmin();
      return successResponse(res, 'Issuance analytics retrieved successfully', analytics);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator retry certificate email delivery.
   * POST /api/certificates/admin/:id/retry-email
   */
  async retryEmailDeliveryAdmin(req, res, next) {
    try {
      const result = await certificateService.retryEmailDeliveryAdmin(
        req.params.id,
        req.user.id
      );
      return successResponse(res, 'Email delivery attempt completed', result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator retry certificate PDF issuance.
   * POST /api/certificates/admin/:id/retry-issuance
   */
  async retryIssuanceAdmin(req, res, next) {
    try {
      const cert = await certificateService.retryIssuanceAdmin(
        req.params.id,
        req.user.id
      );
      return successResponse(res, 'Certificate issuance retried successfully', cert);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator retrieve Institutional Certification Settings.
   * GET /api/certificates/admin/settings
   */
  async getCertificationSettingsAdmin(req, res, next) {
    try {
      const settings = await certificateService.getCertificationSettingsAdmin();
      return successResponse(res, 'Certification settings retrieved successfully', settings);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Administrator update Institutional Certification Settings.
   * PUT /api/certificates/admin/settings
   */
  async updateCertificationSettingsAdmin(req, res, next) {
    try {
      const settings = await certificateService.updateCertificationSettingsAdmin(
        req.user.id,
        req.body
      );
      return successResponse(res, 'Certification settings updated successfully', settings);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CertificateController();
