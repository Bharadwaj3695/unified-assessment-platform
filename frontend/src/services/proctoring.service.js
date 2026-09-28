import api from './api';

export const proctoringService = {
  getSessionBySubmission: async (submissionId) => {
    const res = await api.get(`/proctoring/submissions/${submissionId}`);
    return res.data;
  },

  getSession: async (sessionId) => {
    const res = await api.get(`/proctoring/sessions/${sessionId}`);
    return res.data;
  },

  recordEvent: async (sessionId, eventData) => {
    const res = await api.post(`/proctoring/sessions/${sessionId}/events`, eventData);
    return res.data;
  },

  endSession: async (sessionId, reason = 'NORMAL_COMPLETION') => {
    const res = await api.post(`/proctoring/sessions/${sessionId}/end`, { reason });
    return res.data;
  },
};

export default proctoringService;
