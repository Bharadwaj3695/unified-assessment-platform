import api from './api';
import { API_BASE_URL } from '../utils/constants';

export const interviewService = {
  getSignalingUrl: () => {
    const rawBase = String(API_BASE_URL || '/api').replace(/\/+$/, '');
    if (/^https?:\/\//i.test(rawBase)) {
      const parsed = new URL(rawBase);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/interviews/ws`;
      parsed.search = '';
      return parsed.toString();
    }
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
    const prefix = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
    return `${proto}//${host}${prefix}/interviews/ws`;
  },

  listInterviews: async (params = {}) => {
    const res = await api.get('/interviews', { params });
    return res.data || res || [];
  },

  getInterviewById: async (id) => {
    const res = await api.get(`/interviews/${id}`);
    return res.data || res;
  },

  createInterview: async (payload) => {
    const res = await api.post('/interviews', payload);
    return res.data || res;
  },

  updateInterview: async (id, payload) => {
    const res = await api.put(`/interviews/${id}`, payload);
    return res.data || res;
  },

  transitionStatus: async (id, status, extra = {}) => {
    const res = await api.post(`/interviews/${id}/transition`, { status, ...extra });
    return res.data || res;
  },

  rescheduleInterview: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/reschedule`, payload);
    return res.data || res;
  },

  startOrJoinSession: async (id, payload = {}) => {
    const res = await api.post(`/interviews/${id}/session/start`, payload);
    return res.data || res;
  },

  updateCameraStatus: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/session/camera`, payload);
    return res.data || res;
  },

  saveStudentResponses: async (id, payload) => {
    const res = await api.put(`/interviews/${id}/session/responses`, payload);
    return res.data || res;
  },

  completeOrLeaveSession: async (id, payload = {}) => {
    const res = await api.post(`/interviews/${id}/session/complete`, payload);
    return res.data || res;
  },

  controlStudentMedia: async (id, command) => {
    const res = await api.post(`/interviews/${id}/session/media-control`, { command });
    return res.data || res;
  },

  evaluateInterview: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/evaluate`, payload);
    return res.data || res;
  },

  getTranscript: async (id) => {
    const res = await api.get(`/interviews/${id}/transcript`);
    return res.data || res;
  },

  addTranscriptSegment: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/transcript`, payload);
    return res.data || res;
  },

  getStudentPerformanceReport: async (id) => {
    const res = await api.get(`/interviews/${id}/reports/student`);
    return res.data || res;
  },

  getBehavioralReport: async (id) => {
    const res = await api.get(`/interviews/${id}/reports/behavioral`);
    return res.data || res;
  },

  finalizeBehavioralReport: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/reports/behavioral/finalize`, payload);
    return res.data || res;
  },

  getFacultyReport: async (id) => {
    const res = await api.get(`/interviews/${id}/reports/faculty`);
    return res.data || res;
  },

  processAiTranscript: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/ai/transcript`, payload);
    return res.data || res;
  },

  processAiProctoring: async (id, payload) => {
    const res = await api.post(`/interviews/${id}/ai/proctoring`, payload);
    return res.data || res;
  },
};

export default interviewService;
