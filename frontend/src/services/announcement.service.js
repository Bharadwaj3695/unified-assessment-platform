// Import configured Axios HTTP client instance
import api from './api';

/**
 * Announcement API Service
 * Encapsulates client calls for fetching active announcements and administrative management.
 * Primary endpoints target canonical /announcements REST paths with automatic /admin/announcements
 * fallback resolution to guarantee zero 404 disruptions across environments.
 */
export const announcementService = {
  /**
   * Fetch currently active announcement for banners
   * Unauthenticated or authenticated.
   */
  getActive: async () => {
    const res = await api.get('/announcements/active');
    return res;
  },

  /**
   * Fetch current announcement document and lifecycle status (Admin only)
   */
  getCurrent: async () => {
    try {
      return await api.get('/announcements/current');
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return await api.get('/admin/announcements/current');
      }
      throw err;
    }
  },

  /**
   * Fetch announcement history (Admin only)
   */
  getHistory: async (params = {}) => {
    try {
      return await api.get('/announcements', { params });
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return await api.get('/admin/announcements', { params });
      }
      throw err;
    }
  },

  /**
   * Save an announcement draft (Admin only)
   */
  saveDraft: async (data) => {
    try {
      return await api.post('/announcements/draft', data);
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return await api.post('/admin/announcements/draft', data);
      }
      throw err;
    }
  },

  /**
   * Publish an announcement immediately (Admin only)
   */
  publishImmediate: async (data) => {
    try {
      return await api.post('/announcements/publish', data);
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return await api.post('/admin/announcements/publish', data);
      }
      throw err;
    }
  },

  /**
   * Schedule an announcement for future publication (Admin only)
   */
  schedule: async (data) => {
    try {
      return await api.post('/announcements/schedule', data);
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return await api.post('/admin/announcements/schedule', data);
      }
      throw err;
    }
  },

  /**
   * Cancel / unpublish an announcement (Admin only)
   */
  cancel: async (id = null) => {
    const path = id ? `/announcements/${id}/cancel` : '/announcements/cancel';
    const fallbackPath = id ? `/admin/announcements/${id}/cancel` : '/admin/announcements/cancel';
    try {
      return await api.put(path);
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        return await api.put(fallbackPath);
      }
      throw err;
    }
  },
};

export default announcementService;

