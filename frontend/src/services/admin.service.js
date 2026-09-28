

import api from './api';

export const adminService = {
  getStats: async () => {
    const res = await api.get('/admin/stats');
    return res.data;
  },
  getUsers: async (params = {}) => {
    const res = await api.get('/admin/users', { params });
    return res;
  },
  getPendingUsers: async () => {
    const res = await api.get('/admin/users/pending');
    return res.data;
  },
  getUserDetails: async (id) => {
    const res = await api.get(`/admin/users/${id}`);
    return res.data;
  },
  approveUser: async (id, data = {}) => {
    const res = await api.put(`/admin/users/${id}/approve`, data);
    return res.data;
  },
  rejectUser: async (id, data = {}) => {
    const res = await api.put(`/admin/users/${id}/reject`, data);
    return res.data;
  },
  revokeUser: async (id, data = {}) => {
    const res = await api.put(`/admin/users/${id}/revoke`, data);
    return res.data;
  },
  toggleUserStatus: async (id) => {
    const res = await api.put(`/admin/users/${id}/toggle-status`);
    return res.data;
  },
  getAssessments: async (params = {}) => {
    const res = await api.get('/admin/assessments', { params });
    return res;
  },
  getLogs: async (params = {}) => {
    const res = await api.get('/admin/logs', { params });
    return res;
  },
  getAlerts: async () => {
    const res = await api.get('/admin/alerts');
    return res.data;
  },
  updateAssessmentStatus: async (id, status) => {
    const res = await api.put(`/admin/assessments/${id}/status`, { status });
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/admin/settings');
    return res.data;
  },
  updateSettings: async (settings) => {
    const res = await api.put('/admin/settings', settings);
    return res.data;
  },
};

export default adminService;
