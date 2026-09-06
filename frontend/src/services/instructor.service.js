import api from './api';

export const instructorService = {
  getStudents: async (params = {}) => {
    const res = await api.get('/users/students', { params });
    return res.data || res || [];
  },

  getInstructorSubmissions: async (params = {}) => {
    const res = await api.get('/evaluations/instructor/submissions', { params });
    return res;
  },

  searchWorkspace: async (query) => {
    if (!query || !query.trim()) {
      return { assessments: [], students: [], submissions: [] };
    }
    const q = query.trim();
    const [asmtRes, studRes, subRes] = await Promise.allSettled([
      api.get('/assessments', { params: { search: q, limit: 5 } }),
      api.get('/users/students', { params: { search: q } }),
      api.get('/evaluations/instructor/submissions', { params: { search: q, limit: 5 } }),
    ]);

    const assessments =
      asmtRes.status === 'fulfilled'
        ? asmtRes.value.data || asmtRes.value.assessments || []
        : [];
    const students =
      studRes.status === 'fulfilled'
        ? studRes.value.data || studRes.value || []
        : [];
    const submissions =
      subRes.status === 'fulfilled'
        ? subRes.value.data || subRes.value.submissions || []
        : [];

    return { assessments, students, submissions };
  },

  getSubmissionForEvaluation: async (submissionId) => {
    const res = await api.get(`/submissions/${submissionId}`);
    return res.data || res;
  },

  submitEvaluation: async (submissionId, data) => {
    const res = await api.post(`/evaluations/submission/${submissionId}`, data);
    return res.data || res;
  },
};

export default instructorService;
