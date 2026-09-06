import api from './api';

export const submissionService = {
  startAttempt: async (assessmentId) => {
    const res = await api.post('/submissions/start', { assessmentId });
    return res.data;
  },
  autosaveAnswer: async (submissionId, questionId, answer) => {
    const res = await api.patch(`/submissions/${submissionId}/answers/${questionId}`, { answer });
    return res.data;
  },
  saveProgress: async (submissionId, answers) => {
    const res = await api.put(`/submissions/${submissionId}/progress`, { answers });
    return res.data;
  },
  submitAssessment: async (submissionId, answers = null) => {
    const res = await api.post(`/submissions/${submissionId}/submit`, { answers });
    return res.data;
  },
  getStudentSubmissions: async () => {
    const res = await api.get('/submissions/student');
    return res.data;
  },
  getSubmissionById: async (submissionId) => {
    const res = await api.get(`/submissions/${submissionId}`);
    return res.data;
  },
};

export default submissionService;
