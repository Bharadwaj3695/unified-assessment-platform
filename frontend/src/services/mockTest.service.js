import api from './api';

export const mockTestService = {
  // --- MOCK TESTS & BLUEPRINTS ---
  async getMockTests(params = {}) {
    const res = await api.get('/tests/mock-tests', { params });
    return res.data;
  },

  async getMockTestById(id) {
    const res = await api.get(`/tests/mock-tests/${id}`);
    return res.data;
  },

  async createMockTest(data) {
    const res = await api.post('/tests/mock-tests', data);
    return res.data;
  },

  async updateMockTest(id, data) {
    const res = await api.patch(`/tests/mock-tests/${id}`, data);
    return res.data;
  },

  async generateMockTestBlueprint(id) {
    const res = await api.post(`/tests/mock-tests/${id}/generate`);
    return res.data;
  },

  async publishMockTest(id) {
    const res = await api.post(`/tests/mock-tests/${id}/publish`);
    return res.data;
  },

  // --- STUDENT MOCK TEST EXPERIENCE ---
  async startMockTestAttempt(testId) {
    const res = await api.post(`/tests/mock-tests/${testId}/attempts`);
    return res.data;
  },

  async uploadMockTestFile(attemptId, questionId, file, onUploadProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(
      `/tests/mock-tests/attempts/${attemptId}/questions/${questionId}/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      }
    );
    return res.data;
  },

  async submitMockTestAttempt(testId, attemptId, payload) {
    const res = await api.post(`/tests/mock-tests/attempts/${attemptId}/submit`, {
      ...payload,
    });
    return res.data;
  },

  async getMockTestAnalytics(attemptId) {
    const res = await api.get(`/tests/mock-tests/attempts/${attemptId}/analytics`);
    return res.data;
  },

  // --- FACULTY MOCK TEST MANUAL EVALUATION ---
  async getMockTestAttempts(mockTestId) {
    const res = await api.get(`/tests/mock-tests/${mockTestId}/attempts`);
    return res.data;
  },

  async getMockTestAttemptForReview(attemptId) {
    const res = await api.get(`/tests/mock-tests/attempts/${attemptId}/review`);
    return res.data;
  },

  async evaluateMockTestAttempt(attemptId, payload) {
    const res = await api.post(`/tests/mock-tests/attempts/${attemptId}/evaluate`, payload);
    return res.data;
  },
};

export default mockTestService;
