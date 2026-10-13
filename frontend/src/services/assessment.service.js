// Import the configured Axios API client instance with interceptors for auth tokens and error formatting
import api from './api';

/**
 * Service client for assessment management API endpoints.
 * Handles fetching, creating, updating, and deleting assessment exams.
 */
export const assessmentService = {
  // Retrieves a paginated and filtered list of assessments based on user role and query parameters
  getAssessments: async (params = {}) => {
    // Send an asynchronous HTTP GET request to /assessments with query parameters (search, category, status)
    const res = await api.get('/assessments', { params });
    // Return full response containing paginated data and pagination envelope
    return res;
  },

  // Retrieves detailed configuration and questions for a specific assessment by its unique ID
  getAssessmentById: async (id) => {
    // Send an asynchronous HTTP GET request to retrieve assessment metadata and questions
    const res = await api.get(`/assessments/${id}`);
    // Return the response data body
    return res.data;
  },

  // Creates a new assessment exam with scheduling, questions, and proctoring settings
  createAssessment: async (data) => {
    // Send an asynchronous HTTP POST request to /assessments with assessment payload
    const res = await api.post('/assessments', data);
    // Return the newly created assessment object
    return res.data;
  },

  // Updates an existing assessment's scheduling, status, or questions by ID
  updateAssessment: async (id, data) => {
    // Send an asynchronous HTTP PUT request to /assessments/:id with updated fields
    const res = await api.put(`/assessments/${id}`, data);
    // Return the updated assessment document
    return res.data;
  },

  // Deletes or archives an assessment by its unique ID
  deleteAssessment: async (id) => {
    // Send an asynchronous HTTP DELETE request to remove the assessment
    const res = await api.delete(`/assessments/${id}`);
    // Return confirmation response data
    return res.data;
  },
};

// Export assessmentService as default export
export default assessmentService;
