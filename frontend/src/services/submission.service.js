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
  uploadAnswerFile: async (submissionId, questionId, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/submissions/${submissionId}/answers/${questionId}/file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return res.data;
  },
  attachGoogleDocsUrl: async (submissionId, questionId, googleDocsUrl) => {
    const res = await api.post(`/submissions/${submissionId}/answers/${questionId}/google-docs`, {
      googleDocsUrl,
    });
    return res.data;
  },
  removeAnswerFile: async (submissionId, questionId) => {
    const res = await api.delete(`/submissions/${submissionId}/answers/${questionId}/file`);
    return res.data;
  },
  getAnswerFileBlob: async (submissionId, questionId, download = false) => {
    const res = await api.get(`/submissions/${submissionId}/answers/${questionId}/file`, {
      params: { download: download ? 'true' : 'false' },
      responseType: 'blob',
    });
    return res;
  },
};

export default submissionService;
