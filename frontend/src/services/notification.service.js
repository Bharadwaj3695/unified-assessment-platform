import api from './api';

export const notificationService = {
  getNotifications: async (params = {}) => {
    const res = await api.get('/notifications', { params });
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await api.patch('/notifications/read-all');
    return res;
  },

  deleteNotification: async (id) => {
    const res = await api.delete(`/notifications/${id}`);
    return res;
  },
};

export default notificationService;
