// Import Axios API client instance configured with authorization interceptors and base URL
import api from './api';

/**
 * Service client for student certificate API endpoints.
 * Handles fetching earned certificates, certificate details, and download actions.
 */
export const certificateService = {
  /**
   * Retrieves all certificates earned by the authenticated student.
   * Authentication is derived strictly from the active session/token.
   */
  getMyCertificates: async () => {
    const res = await api.get('/certificates/mine');
    return res.data;
  },

  /**
   * Retrieves a single certificate by its unique MongoDB or public certificate ID.
   */
  getCertificateById: async (id) => {
    const res = await api.get(`/certificates/${id}`);
    return res.data;
  },

  /**
   * Triggers download action for an authorized certificate.
   */
  downloadCertificate: async (id) => {
    const res = await api.get(`/certificates/${id}/download`);
    return res.data;
  },
};

export default certificateService;
