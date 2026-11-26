// Import Axios API client instance configured with authorization interceptors and base URL
import api from './api';

/**
 * Service client for student certificate API endpoints and Admin Certification Studio.
 */
export const certificateService = {
  // Student Endpoints
  /**
   * Retrieves all certificates earned by the authenticated student.
   */
  getMyCertificates: async () => {
    const res = await api.get('/certificates/mine');
    return res.data?.data || res.data;
  },

  getMyCertificatesPaginated: async (params = {}) => {
    const res = await api.get('/certificates/mine', { params });
    return res;
  },

  /**
   * Retrieves a single certificate by its unique MongoDB or public certificate ID.
   */
  getCertificateById: async (id) => {
    const res = await api.get(`/certificates/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Triggers download action for an authorized certificate in PDF, PNG, or JPG format.
   */
  downloadCertificate: async (id, fallbackFilename = 'certificate.pdf', format = 'pdf') => {
    const normFormat = String(format || 'pdf').toLowerCase().trim();
    const res = await api.get(`/certificates/${id}/download`, {
      params: normFormat !== 'pdf' ? { format: normFormat } : undefined,
      responseType: 'blob',
    });

    // Extract filename from Content-Disposition if present
    const disposition = res.headers?.['content-disposition'] || '';
    let filename = fallbackFilename;
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }

    const mimeMap = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    const blob = new Blob([res.data], { type: mimeMap[normFormat] || 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return true;
  },

  /**
   * Public endpoint to verify a certificate by its verification code or certificate ID.
   * Zero student PII is exposed.
   */
  verifyCertificate: async (code) => {
    const res = await api.get(`/certificates/verify/${encodeURIComponent(code)}`);
    return res.data?.data || res.data;
  },

  // Admin Certification Studio Endpoints
  /**
   * Retrieves issuance & delivery analytics metrics for the administrator dashboard.
   */
  getAnalytics: async () => {
    const res = await api.get('/certificates/admin/analytics');
    return res.data?.data || res.data;
  },

  /**
   * Retrieves all issued certificates in the institution with search, status filters, and pagination.
   */
  getAllCertificatesAdmin: async (params = {}) => {
    const res = await api.get('/certificates/admin/all', { params });
    return res.data?.data || res.data;
  },

  /**
   * Retrieves detailed certificate record including academic snapshots and audit details.
   */
  getCertificateDetailsAdmin: async (id) => {
    const res = await api.get(`/certificates/admin/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Revokes an issued certificate with a mandatory reason.
   */
  revokeCertificate: async (id, reason) => {
    const res = await api.patch(`/certificates/admin/${id}/revoke`, { reason });
    return res.data?.data || res.data;
  },

  /**
   * Retries transactional email delivery for an issued certificate.
   */
  retryEmail: async (id) => {
    const res = await api.post(`/certificates/admin/${id}/retry-email`);
    return res.data?.data || res.data;
  },

  /**
   * Retries PDF generation and secure storage for a certificate marked failed.
   */
  retryIssuance: async (id) => {
    const res = await api.post(`/certificates/admin/${id}/retry-issuance`);
    return res.data?.data || res.data;
  },

  /**
   * Lists certificate templates with optional status filtering.
   */
  getTemplates: async (params = {}) => {
    const res = await api.get('/certificates/admin/templates', { params });
    return res.data?.data || res.data;
  },

  /**
   * Retrieves a single certificate template by ID.
   */
  getTemplateById: async (id) => {
    const res = await api.get(`/certificates/admin/templates/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Creates a new certificate template.
   */
  createTemplate: async (data) => {
    const res = await api.post('/certificates/admin/templates', data);
    return res.data?.data || res.data;
  },

  /**
   * Updates an existing certificate template (increments version if published).
   */
  updateTemplate: async (id, data) => {
    const res = await api.patch(`/certificates/admin/templates/${id}`, data);
    return res.data?.data || res.data;
  },

  /**
   * Sets a certificate template as the system-wide institutional default.
   */
  setDefaultTemplate: async (id) => {
    const res = await api.patch(`/certificates/admin/templates/${id}/set-default`);
    return res.data?.data || res.data;
  },

  /**
   * Generates a live preview PDF buffer for a draft template layout.
   */
  previewTemplate: async (templateData) => {
    const res = await api.post('/certificates/admin/templates/preview', templateData, {
      responseType: 'blob',
    });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  /**
   * Retrieves Institutional Certification Settings.
   */
  getSettings: async () => {
    const res = await api.get('/certificates/admin/settings');
    return res.data?.data || res.data;
  },

  /**
   * Updates Institutional Certification Settings.
   */
  updateSettings: async (data) => {
    const res = await api.put('/certificates/admin/settings', data);
    return res.data?.data || res.data;
  },
};

export default certificateService;
