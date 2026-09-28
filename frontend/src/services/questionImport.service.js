import api from './api';

export const questionImportService = {
  /**
   * Upload file (PDF, DOC, DOCX) to initiate import job
   */
  async importFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/question-import/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Submit Google Forms URL or structure for import
   */
  async importGoogleForms({ formsUrlOrId, accessToken }) {
    return api.post('/question-import/google-forms', {
      formsUrlOrId,
      accessToken,
    });
  },

  /**
   * Get list of import jobs for current instructor
   */
  async getJobs() {
    return api.get('/question-import/jobs');
  },

  /**
   * Get import job status and details
   */
  async getJobById(id) {
    return api.get(`/question-import/jobs/${id}`);
  },

  /**
   * Get extracted questions preview for review
   */
  async getJobPreview(id) {
    return api.get(`/question-import/jobs/${id}/preview`);
  },

  /**
   * Review single question: Accept or Reject with optional faculty edits
   */
  async reviewQuestion(jobId, tempId, action, reviewData = {}) {
    return api.post(`/question-import/jobs/${jobId}/questions/${tempId}/review`, {
      action,
      reviewData,
    });
  },

  /**
   * Bulk review questions: Accept or Reject selected tempIds
   */
  async bulkReview(jobId, tempIds, action) {
    return api.post(`/question-import/jobs/${jobId}/bulk-review`, {
      tempIds,
      action,
    });
  },
};

export default questionImportService;
