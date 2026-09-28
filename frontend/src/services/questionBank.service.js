import api from './api';

export const questionBankService = {
  /**
   * Fetch paginated and filtered Question Bank items
   */
  async getQuestions(params = {}) {
    return api.get('/question-bank', { params });
  },

  /**
   * Fetch single question with full version history
   */
  async getQuestionById(id) {
    return api.get(`/question-bank/${id}`);
  },

  /**
   * Create new Question Bank item
   */
  async createQuestion(questionData) {
    return api.post('/question-bank', questionData);
  },

  /**
   * Update existing question (creates a new version if already referenced in an assessment)
   */
  async updateQuestion(id, questionData) {
    return api.put(`/question-bank/${id}`, questionData);
  },

  /**
   * Archive / delete question
   */
  async deleteQuestion(id) {
    return api.delete(`/question-bank/${id}`);
  },

  /**
   * Fetch distinct categories
   */
  async getCategories() {
    return api.get('/question-bank/categories');
  },

  /**
   * Fetch distinct tags
   */
  async getTags() {
    return api.get('/question-bank/tags');
  },

  /**
   * Check for duplicate question text
   */
  async checkDuplicate(questionText) {
    return api.post('/question-bank/check-duplicate', { questionText });
  },
};

export default questionBankService;
