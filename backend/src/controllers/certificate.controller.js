// Import CertificateService containing business logic for student credential retrieval
const certificateService = require('../services/certificate.service');
// Import standardized API response formatting helpers
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Controller handling student certificate endpoints.
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
   * Dispatches download action for a student certificate.
   * GET /api/certificates/:id/download
   */
  async downloadCertificate(req, res, next) {
    try {
      await certificateService.downloadCertificate(req.params.id, req.user.id);
    } catch (err) {
      if (err.statusCode === 501) {
        return errorResponse(res, err.message, 501);
      }
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
   * Administrator certificate registry inspection.
   * GET /api/certificates/admin/all
   */
  async getAllCertificatesAdmin(req, res, next) {
    try {
      const { search, status, assessmentId, page, limit } = req.query;
      const data = await certificateService.getAllCertificatesAdmin({
        search,
        status,
        assessmentId,
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
   * Administrator certificate revocation.
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
}

module.exports = new CertificateController();
