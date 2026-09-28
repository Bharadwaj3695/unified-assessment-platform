import api from './api';

export const analyticsService = {
  getStudentPerformance: async (params = {}) => {
    const res = await api.get('/analytics/student/performance', { params });
    return res.data;
  },

  getStudentTrends: async (params = {}) => {
    const res = await api.get('/analytics/student/trends', { params });
    return res.data;
  },

  getStudentStreak: async (params = {}) => {
    const res = await api.get('/analytics/student/streak', { params });
    return res.data;
  },

  getLeaderboard: async (params = {}) => {
    const res = await api.get('/analytics/leaderboard', { params });
    return res.data;
  },

  getInstructorAssessmentAnalytics: async (assessmentId) => {
    const res = await api.get(`/analytics/instructor/assessment/${assessmentId}`);
    return res.data;
  },

  getInstructorQuestionAnalytics: async (assessmentId) => {
    const res = await api.get(`/analytics/instructor/assessment/${assessmentId}/questions`);
    return res.data;
  },

  getAdminOverview: async (params = {}) => {
    const res = await api.get('/analytics/admin/overview', { params });
    return res.data;
  },
};

export default analyticsService;
