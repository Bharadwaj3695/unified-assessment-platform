// Import the preconfigured Axios HTTP client instance for sending API requests
import api from './api';

// Export an object containing all administrative API service methods
export const adminService = {
  // Method to fetch high-level system dashboard analytics and operational metrics
  getStats: async () => {
    // Send an asynchronous HTTP GET request to retrieve system statistics
    const res = await api.get('/admin/stats');
    // Return the response data payload containing statistical metrics
    return res.data;
  // Conclude the getStats method definition
  },
  // Method to retrieve a paginated and filtered list of user accounts
  getUsers: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the users endpoint with query parameters
    const res = await api.get('/admin/users', { params });
    // Return the full HTTP response object including headers and pagination data
    return res;
  // Conclude the getUsers method definition
  },
  // Method to retrieve accounts awaiting administrative review or approval
  getPendingUsers: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the pending user queue endpoint with optional filter params
    const res = await api.get('/admin/users/pending', { params });
    // Return the list of pending user records from the response body
    return res.data;
  // Conclude the getPendingUsers method definition
  },
  // Method to bulk approve pending applicant accounts
  bulkApproveUsers: async (userIds) => {
    // Send an asynchronous HTTP POST request to the bulk approval endpoint
    const res = await api.post('/admin/users/bulk-approve', { userIds });
    // Return the bulk approval response payload containing counts and outcome details
    return res.data;
  // Conclude the bulkApproveUsers method definition
  },
  // Method to bulk reject pending applicant accounts
  bulkRejectUsers: async (userIds, data = {}) => {
    // Send an asynchronous HTTP POST request to the bulk rejection endpoint
    const res = await api.post('/admin/users/bulk-reject', { userIds, ...data });
    // Return the bulk rejection response payload containing counts and outcome details
    return res.data;
  // Conclude the bulkRejectUsers method definition
  },
  // Method to bulk revoke active user accounts (backward compatibility)
  bulkRevokeUsers: async (userIds, data = {}) => {
    // Send an asynchronous HTTP POST request to the bulk revocation endpoint
    const res = await api.post('/admin/users/bulk-revoke', { userIds, ...data });
    // Return the bulk revocation response payload containing counts and outcome details
    return res.data;
  // Conclude the bulkRevokeUsers method definition
  },
  // Method to bulk deactivate active user accounts
  bulkDeactivateUsers: async (userIds, data = {}) => {
    const res = await api.post('/admin/users/bulk-deactivate', { userIds, ...data });
    return res.data;
  },
  // Method to bulk activate inactive user accounts
  bulkActivateUsers: async (userIds, data = {}) => {
    const res = await api.post('/admin/users/bulk-activate', { userIds, ...data });
    return res.data;
  },
  // Method to activate an inactive user account
  activateUser: async (id) => {
    const res = await api.put(`/admin/users/${id}/activate`);
    return res.data;
  },
  // Method to deactivate an active user account
  deactivateUser: async (id, data = {}) => {
    const res = await api.put(`/admin/users/${id}/deactivate`, data);
    return res.data;
  },
  // Method to restore a revoked or deactivated user account
  restoreUser: async (id) => {
    // Send an asynchronous HTTP PUT request to restore user account
    const res = await api.put(`/admin/users/${id}/restore`);
    // Return the response data confirming user restoration
    return res.data;
  // Conclude the restoreUser method definition
  },
  // Method to retrieve complete profile details and audit history for a specific user ID
  getUserDetails: async (id) => {
    // Send an asynchronous HTTP GET request to the user detail endpoint using the unique user ID
    const res = await api.get(`/admin/users/${id}`);
    // Return the user detail object from the response data
    return res.data;
  // Conclude the getUserDetails method definition
  },
  // Method to approve a pending user account registration
  approveUser: async (id, data = {}) => {
    // Send an asynchronous HTTP PUT request to approve the user with optional role/department data
    const res = await api.put(`/admin/users/${id}/approve`, data);
    // Return the response data confirming user approval
    return res.data;
  // Conclude the approveUser method definition
  },
  // Method to reject a pending user registration application
  rejectUser: async (id, data = {}) => {
    // Send an asynchronous HTTP PUT request to reject the user with an optional rejection reason
    const res = await api.put(`/admin/users/${id}/reject`, data);
    // Return the response data confirming user rejection
    return res.data;
  // Conclude the rejectUser method definition
  },
  // Method to revoke platform access from an active user account
  revokeUser: async (id, data = {}) => {
    // Send an asynchronous HTTP PUT request to revoke user permissions and invalidate sessions
    const res = await api.put(`/admin/users/${id}/revoke`, data);
    // Return the response data confirming access revocation
    return res.data;
  // Conclude the revokeUser method definition
  },
  // Method to toggle a user's active/disabled status
  toggleUserStatus: async (id) => {
    // Send an asynchronous HTTP PUT request to invert the active status flag of the user
    const res = await api.put(`/admin/users/${id}/toggle-status`);
    // Return the response data containing the updated user record
    return res.data;
  // Conclude the toggleUserStatus method definition
  },
  // Method to retrieve a paginated and filtered list of all assessments in the platform
  getAssessments: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the assessments endpoint with filter parameters
    const res = await api.get('/admin/assessments', { params });
    // Return the full HTTP response object containing assessment data and total count
    return res;
  // Conclude the getAssessments method definition
  },
  // Method to retrieve system audit logs, security events, and compliance telemetry
  getLogs: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the audit logs endpoint with search and date filters
    const res = await api.get('/admin/logs', { params });
    // Return the full HTTP response object containing the log entries
    return res;
  // Conclude the getLogs method definition
  },
  // Method to retrieve active system alerts, errors, and operational warnings
  getAlerts: async () => {
    // Send an asynchronous HTTP GET request to the system alerts endpoint
    const res = await api.get('/admin/alerts');
    // Return the list of active alerts from the response body
    return res.data;
  // Conclude the getAlerts method definition
  },
  // Method to update the operational status of an assessment (e.g. published, archived, draft)
  updateAssessmentStatus: async (id, status) => {
    // Send an asynchronous HTTP PUT request updating the status field of the specified assessment
    const res = await api.put(`/admin/assessments/${id}/status`, { status });
    // Return the updated assessment record returned by the backend
    return res.data;
  // Conclude the updateAssessmentStatus method definition
  },
  // Method to fetch global platform settings and feature flags
  getSettings: async () => {
    // Send an asynchronous HTTP GET request to retrieve current system configuration
    const res = await api.get('/admin/settings');
    // Return the platform settings object from the response data
    return res.data;
  // Conclude the getSettings method definition
  },
  // Method to update global platform settings and system configuration
  updateSettings: async (settings) => {
    // Send an asynchronous HTTP PUT request transmitting the modified settings payload
    const res = await api.put('/admin/settings', settings);
    // Return the updated settings object returned by the server
    return res.data;
  // Conclude the updateSettings method definition
  },
  // Method to retrieve records from the authoritative student master registry
  getStudentRegistry: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the student registry endpoint with query filters
    const res = await api.get('/admin/student-registry', { params });
    // Return the full HTTP response containing registry records and pagination metadata
    return res;
  // Conclude the getStudentRegistry method definition
  },
  // Method to create a new student entry in the authoritative master registry
  createStudentRegistryRecord: async (data) => {
    // Send an asynchronous HTTP POST request with student demographic and enrollment data
    const res = await api.post('/admin/student-registry', data);
    // Return the newly created student registry record from the response body
    return res.data;
  // Conclude the createStudentRegistryRecord method definition
  },
  // Method to update an existing student record in the authoritative master registry
  updateStudentRegistryRecord: async (id, data) => {
    // Send an asynchronous HTTP PUT request with modified student details for the given ID
    const res = await api.put(`/admin/student-registry/${id}`, data);
    // Return the updated student registry entry from the response body
    return res.data;
  // Conclude the updateStudentRegistryRecord method definition
  },
  // Method to remove a student entry from the authoritative master registry
  deleteStudentRegistryRecord: async (id) => {
    // Send an asynchronous HTTP DELETE request to delete the student registry record by ID
    const res = await api.delete(`/admin/student-registry/${id}`);
    // Return the deletion confirmation payload from the response body
    return res.data;
  // Conclude the deleteStudentRegistryRecord method definition
  },
  // Method to provision a platform user login account for a verified student registry entry
  createAccountForStudentRegistry: async (id) => {
    // Send an asynchronous HTTP POST request to trigger automated account creation for the registry record
    const res = await api.post(`/admin/student-registry/${id}/create-account`);
    // Return the provisioned account details from the response data
    return res.data;
  // Conclude the createAccountForStudentRegistry method definition
  },

  // Student Account Management methods section
  // Method to fetch a list of student platform accounts with query parameters
  getStudents: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the student account listing endpoint
    const res = await api.get('/admin/students', { params });
    // Return the full HTTP response object containing student account records
    return res;
  // Conclude the getStudents method definition
  },
  // Method to fetch a single student platform account by its unique identifier
  getStudentById: async (id) => {
    // Send an asynchronous HTTP GET request to retrieve a specific student's account profile
    const res = await api.get(`/admin/students/${id}`);
    // Return the student account data from the response body
    return res.data;
  // Conclude the getStudentById method definition
  },
  // Method to manually create and provision a new student platform account
  createStudent: async (data) => {
    // Send an asynchronous HTTP POST request with new student account credentials and details
    const res = await api.post('/admin/students', data);
    // Return the created student account record from the response body
    return res.data;
  // Conclude the createStudent method definition
  },
  // Method to partially update an existing student platform account
  updateStudent: async (id, data) => {
    // Send an asynchronous HTTP PATCH request applying field updates to the student account
    const res = await api.patch(`/admin/students/${id}`, data);
    // Return the patched student account record from the response body
    return res.data;
  // Conclude the updateStudent method definition
  },

  // Student Bulk Import methods section
  // Method to upload a spreadsheet and preview parsed student bulk import records
  previewStudentBulkImport: async (formData) => {
    // Send an asynchronous HTTP POST request with multipart form-data to parse import records
    const res = await api.post('/admin/students/import/preview', formData, {
      // Set multipart form-data content type header for file streaming
      headers: { 'Content-Type': 'multipart/form-data' },
    // Conclude headers configuration and options
    });
    // Return the full HTTP response containing validation preview and parsed row records
    return res;
  // Conclude the previewStudentBulkImport method definition
  },
  // Method to commit and confirm validated student bulk import records into the database
  confirmStudentBulkImport: async (records) => {
    // Send an asynchronous HTTP POST request containing verified bulk student records to import
    const res = await api.post('/admin/students/import/confirm', { records });
    // Return the full HTTP response indicating import batch execution results
    return res;
  // Conclude the confirmStudentBulkImport method definition
  },

  // Faculty Account Management methods section
  // Method to fetch a paginated list of faculty user accounts
  getFaculty: async (params = {}) => {
    // Send an asynchronous HTTP GET request to the faculty account listing endpoint
    const res = await api.get('/admin/faculty', { params });
    // Return the full HTTP response object containing faculty account records
    return res;
  // Conclude the getFaculty method definition
  },
  // Method to retrieve details for a specific faculty account by ID
  getFacultyById: async (id) => {
    // Send an asynchronous HTTP GET request to fetch a specific faculty member's profile
    const res = await api.get(`/admin/faculty/${id}`);
    // Return the faculty member's account information from the response data
    return res.data;
  // Conclude the getFacultyById method definition
  },
  // Method to manually create and provision a new faculty account
  createFaculty: async (data) => {
    // Send an asynchronous HTTP POST request with faculty account credentials and department info
    const res = await api.post('/admin/faculty', data);
    // Return the created faculty account record from the response body
    return res.data;
  // Conclude the createFaculty method definition
  },
  // Method to update details of an existing faculty account
  updateFaculty: async (id, data) => {
    // Send an asynchronous HTTP PATCH request with updated faculty fields
    const res = await api.patch(`/admin/faculty/${id}`, data);
    // Return the modified faculty record from the response body
    return res.data;
  // Conclude the updateFaculty method definition
  },
  // Method to provision a platform user login account for a verified faculty registry entry
  createAccountForFacultyRegistry: async (id) => {
    // Send an asynchronous HTTP POST request to provision a faculty account from registry master data
    const res = await api.post(`/admin/faculty-registry/${id}/create-account`);
    // Return the newly provisioned faculty account details
    return res.data;
  // Conclude the createAccountForFacultyRegistry method definition
  },

  // Faculty Registry methods section
  // Method to fetch records from the authoritative faculty master registry
  getFacultyRegistry: async (params = {}) => {
    // Send an asynchronous HTTP GET request to retrieve faculty registry entries with query filters
    const res = await api.get('/admin/faculty-registry', { params });
    // Return the full HTTP response containing registry records and count
    return res;
  // Conclude the getFacultyRegistry method definition
  },
  // Method to fetch a single faculty registry entry by ID
  getFacultyRegistryById: async (id) => {
    // Send an asynchronous HTTP GET request to retrieve a specific faculty registry record
    const res = await api.get(`/admin/faculty-registry/${id}`);
    // Return the faculty registry record from the response body
    return res.data;
  // Conclude the getFacultyRegistryById method definition
  },
  // Method to create a new faculty record in the master registry
  createFacultyRegistryRecord: async (data) => {
    // Send an asynchronous HTTP POST request with faculty master demographic information
    const res = await api.post('/admin/faculty-registry', data);
    // Return the newly created faculty registry entry from the response body
    return res.data;
  // Conclude the createFacultyRegistryRecord method definition
  },
  // Method to update an existing faculty entry in the master registry
  updateFacultyRegistryRecord: async (id, data) => {
    // Send an asynchronous HTTP PUT request with modified faculty master details
    const res = await api.put(`/admin/faculty-registry/${id}`, data);
    // Return the updated faculty registry entry from the response body
    return res.data;
  // Conclude the updateFacultyRegistryRecord method definition
  },
  // Method to delete a faculty entry from the master registry
  deleteFacultyRegistryRecord: async (id) => {
    // Send an asynchronous HTTP DELETE request to remove the faculty registry record by ID
    const res = await api.delete(`/admin/faculty-registry/${id}`);
    // Return the deletion response payload from the response body
    return res.data;
  // Conclude the deleteFacultyRegistryRecord method definition
  },
// Conclude the adminService object definition
};

// Export the adminService object as the default export of this module
export default adminService;
