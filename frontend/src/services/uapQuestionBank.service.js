import api from './api';

export const uapQuestionBankService = {
  // --- SUBJECTS & TOPICS ---
  async getSubjects(params = {}) {
    const res = await api.get('/subjects', { params });
    return res.data;
  },

  async createSubject(data) {
    const res = await api.post('/subjects', data);
    return res.data;
  },

  async getSubjectById(id) {
    const res = await api.get(`/subjects/${id}`);
    return res.data;
  },

  async getTopics(params = {}) {
    const res = await api.get('/topics', { params });
    return res.data;
  },

  async createTopic(data) {
    const res = await api.post('/topics', data);
    return res.data;
  },

  async getTopicHierarchy(subjectId) {
    const res = await api.get(`/subjects/${subjectId}/hierarchy`);
    return res.data;
  },

  // --- QUESTION MANAGEMENT ---
  async getQuestions(params = {}) {
    const res = await api.get('/questions', { params });
    return res.data;
  },

  async getQuestionById(id) {
    const res = await api.get(`/questions/${id}`);
    return res.data;
  },

  async createQuestion(data) {
    const res = await api.post('/questions', data);
    return res.data;
  },

  async updateQuestion(id, data) {
    const res = await api.patch(`/questions/${id}`, data);
    return res.data;
  },

  async validateQuestion(id) {
    const res = await api.post(`/questions/${id}/validate`);
    return res.data;
  },

  async publishQuestion(id) {
    const res = await api.post(`/questions/${id}/publish`);
    return res.data;
  },

  async archiveQuestion(id) {
    const res = await api.post(`/questions/${id}/archive`);
    return res.data;
  },

  async getQuestionVersions(id) {
    const res = await api.get(`/questions/${id}/versions`);
    return res.data;
  },

  // --- QUESTION BANKS ---
  async getQuestionBanks(params = {}) {
    const res = await api.get('/question-banks', { params });
    return res.data;
  },

  async getQuestionBankById(id) {
    const res = await api.get(`/question-banks/${id}`);
    return res.data;
  },

  async createQuestionBank(data) {
    const res = await api.post('/question-banks', data);
    return res.data;
  },

  async addQuestionsToBank(bankId, questionIds) {
    const res = await api.post(`/question-banks/${bankId}/questions`, { questionIds });
    return res.data;
  },

  // --- AI GENERATION ---
  async createAiGenerationJob(data) {
    const res = await api.post('/question-generation', data);
    return res.data;
  },

  async getAiGenerationJob(jobId) {
    const res = await api.get(`/question-generation/${jobId}`);
    return res.data;
  },

  async approveAiQuestion(jobId, questionId, overrideData = {}) {
    const res = await api.post(`/question-generation/${jobId}/approve`, {
      questionId,
      overrideData,
    });
    return res.data;
  },

  async rejectAiQuestion(jobId, questionId, reason = '') {
    const res = await api.post(`/question-generation/${jobId}/reject`, {
      questionId,
      reason,
    });
    return res.data;
  },

  // --- BULK IMPORT ---
  async uploadImportFile(formData) {
    const res = await api.post('/questions/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async getImportJob(jobId) {
    const res = await api.get(`/questions/import/${jobId}`);
    return res.data;
  },

  async commitImportJob(jobId, options = {}) {
    const res = await api.post(`/questions/import/${jobId}/commit`, options);
    return res.data;
  },

  // --- MOCK TESTS & BLUEPRINTS ---
  async getMockTests(params = {}) {
    const res = await api.get('/mock-tests', { params });
    return res.data;
  },

  async getMockTestById(id) {
    const res = await api.get(`/mock-tests/${id}`);
    return res.data;
  },

  async createMockTest(data) {
    const res = await api.post('/mock-tests', data);
    return res.data;
  },

  async updateMockTest(id, data) {
    const res = await api.patch(`/mock-tests/${id}`, data);
    return res.data;
  },

  async generateMockTestBlueprint(id) {
    const res = await api.post(`/mock-tests/${id}/generate`);
    return res.data;
  },

  async publishMockTest(id) {
    const res = await api.post(`/mock-tests/${id}/publish`);
    return res.data;
  },

  // --- STUDENT MOCK TEST EXPERIENCE ---
  async startMockTestAttempt(testId) {
    const res = await api.post(`/mock-tests/${testId}/attempt`);
    return res.data;
  },

  async uploadMockTestFile(attemptId, questionId, file, onUploadProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(
      `/mock-tests/attempts/${attemptId}/questions/${questionId}/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      }
    );
    return res.data;
  },

  async submitMockTestAttempt(testId, attemptId, payload) {
    const res = await api.post(`/mock-tests/${testId}/submit`, {
      attemptId,
      ...payload,
    });
    return res.data;
  },

  async getMockTestAnalytics(attemptId) {
    const res = await api.get(`/mock-tests/attempts/${attemptId}/analytics`);
    return res.data;
  },

  // --- FACULTY MOCK TEST MANUAL EVALUATION ---
  async getMockTestAttempts(mockTestId) {
    const res = await api.get(`/mock-tests/${mockTestId}/attempts`);
    return res.data;
  },

  async getMockTestAttemptForReview(attemptId) {
    const res = await api.get(`/mock-tests/attempts/${attemptId}/review`);
    return res.data;
  },

  async evaluateMockTestAttempt(attemptId, payload) {
    const res = await api.post(`/mock-tests/attempts/${attemptId}/evaluate`, payload);
    return res.data;
  },
};

export default uapQuestionBankService;
