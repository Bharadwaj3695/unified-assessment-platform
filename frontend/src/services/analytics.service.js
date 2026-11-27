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

  getStudentTopics: async (params = {}) => {
    const res = await api.get('/analytics/student/topics', { params });
    return res.data;
  },

  getStudentStreak: async (params = {}) => {
    const res = await api.get('/analytics/student/streak', { params });
    return res.data;
  },

  getStudentExamProgress: async (params = {}) => {
    const res = await api.get('/analytics/student/exam-progress', { params });
    return res.data;
  },

  getStudentAiPredictor: async (params = {}) => {
    const res = await api.get('/analytics/student/ai-predictor', { params });
    return res.data;
  },

  getIndividualExamReport: async (attemptType, attemptId) => {
    const res = await api.get(`/analytics/reports/${attemptType}/${attemptId}`);
    return res.data;
  },

  downloadIndividualExamReportPdf: async (attemptType, attemptId) => {
    const res = await api.get(`/analytics/reports/${attemptType}/${attemptId}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([res], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `uap-exam-report-${attemptId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  },

  getLeaderboard: async (params = {}) => {
    const res = await api.get('/analytics/leaderboard', { params });
    return res.data;
  },

  getInstructorOverview: async (params = {}) => {
    const res = await api.get('/analytics/instructor/overview', { params });
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

  getInstructorMockTestAnalytics: async (mockTestId) => {
    const res = await api.get(`/analytics/instructor/mock-test/${mockTestId}`);
    return res.data;
  },

  getAdminOverview: async (params = {}) => {
    const res = await api.get('/analytics/admin/overview', { params });
    return res.data;
  },

  getAdminFacultyActivity: async (params = {}) => {
    const res = await api.get('/analytics/admin/faculty-activity', { params });
    return res.data;
  },
};

export default analyticsService;
