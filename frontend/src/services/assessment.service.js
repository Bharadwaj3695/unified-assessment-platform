import api from './api';

export const assessmentService = {
  getAssessments: async (params = {}) => {
    const res = await api.get('/assessments', { params });
    return res;
  },
  getAssessmentById: async (id) => {
    const res = await api.get(`/assessments/${id}`);
    return res.data;
  },
  createAssessment: async (data) => {
    const res = await api.post('/assessments', data);
    return res.data;
  },
  updateAssessment: async (id, data) => {
    const res = await api.put(`/assessments/${id}`, data);
    return res.data;
  },
  deleteAssessment: async (id) => {
    const res = await api.delete(`/assessments/${id}`);
    return res.data;
  },
};

export default assessmentService;
