// Import the Express web framework module
const express = require('express');
// Create a new Express router instance for administrative routes
const router = express.Router();
// Import the administrator controller handling general admin operations
const adminController = require('../controllers/admin.controller');
// Import the admin registry controller handling student and faculty registry management
const adminRegistryController = require('../controllers/adminRegistry.controller');
// Import the announcement controller handling broadcast banner management
const announcementController = require('../controllers/announcement.controller');
// Import authentication middleware to verify JWT identity
const { authenticate } = require('../middleware/auth.middleware');
// Import authorization middleware to enforce role-based access control
const { authorize } = require('../middleware/role.middleware');
// Import Multer upload middleware configured for spreadsheet file parsing
const { spreadsheetUpload } = require('../middleware/upload.middleware');
// Import validation middleware to catch and return validation errors
const { validate } = require('../middleware/validation.middleware');
// Destructure validation rules for admin registry requests
const {
  // Validation schema for creating a new student account
  createStudentValidator,
  // Validation schema for creating a new faculty account
  createFacultyValidator,
  // Validation schema for creating/updating student registry records
  studentRegistryValidator,
  // Validation schema for creating/updating faculty registry records
  facultyRegistryValidator,
  // Validation schema for confirming bulk student import batches
  confirmBulkImportValidator,
// End of admin registry validator destructuring
} = require('../validators/adminRegistry.validator');
// Destructure validation rules for announcement requests
const {
  saveDraftValidator,
  publishAnnouncementValidator,
  scheduleAnnouncementValidator,
} = require('../validators/announcement.validator');

// Protect all router endpoints requiring authentication and admin role authorization
router.use(authenticate, authorize('admin'));

// Route to fetch aggregated administrator dashboard statistics
router.get('/stats', adminController.getDashboardStats);
// Route to retrieve a list of all registered platform users
router.get('/users', adminController.getAllUsers);
// Route to retrieve users pending administrative approval
router.get('/users/pending', adminController.getPendingUsers);
// Route to bulk approve pending user registrations
router.post('/users/bulk-approve', adminController.bulkApproveUsers);
// Route to bulk reject pending user registrations
router.post('/users/bulk-reject', adminController.bulkRejectUsers);
// Route to bulk revoke active user accounts (backward compatibility)
router.post('/users/bulk-revoke', adminController.bulkRevokeUsers);
// Route to bulk deactivate active user accounts
router.post('/users/bulk-deactivate', adminController.bulkDeactivateUsers);
// Route to bulk activate inactive user accounts
router.post('/users/bulk-activate', adminController.bulkActivateUsers);
// Route to retrieve detailed profile and activity for a specific user ID
router.get('/users/:id', adminController.getUserDetails);
// Route to approve a pending user account registration
router.put('/users/:id/approve', adminController.approveUser);
// Route to reject a pending user account registration
router.put('/users/:id/reject', adminController.rejectUser);
// Route to activate an inactive user account
router.put('/users/:id/activate', adminController.activateUser);
// Route to deactivate an active user account
router.put('/users/:id/deactivate', adminController.deactivateUser);
// Route to revoke access for an active user account (backward compatibility)
router.put('/users/:id/revoke', adminController.revokeUser);
// Route to restore a revoked or deactivated user account (backward compatibility)
router.put('/users/:id/restore', adminController.restoreUser);
// Route to toggle active/inactive status of a user account
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);
// Route to retrieve all assessments created across the platform
router.get('/assessments', adminController.getAllAssessments);
// Route to update publication or lifecycle status of an assessment
router.put('/assessments/:id/status', adminController.updateAssessmentStatus);
// Route to retrieve system activity and security audit logs
router.get('/logs', adminController.getLogs);
// Route to retrieve real-time operational alerts and incidents
router.get('/alerts', adminController.getOperationalAlerts);
// Route to fetch platform configuration system settings
router.get('/settings', adminController.getSettings);
// Route to update platform configuration system settings
router.put('/settings', adminController.updateSettings);

// Announcement Management routes
// Route to retrieve current announcement configuration and server-time status
router.get('/announcements/current', announcementController.getCurrent);
// Route to retrieve announcement history
router.get('/announcements', announcementController.getHistory);
// Route to save an announcement draft
router.post('/announcements/draft', saveDraftValidator, validate, announcementController.saveDraft);
// Route to publish an announcement immediately
router.post('/announcements/publish', publishAnnouncementValidator, validate, announcementController.publishImmediate);
// Route to schedule an announcement for future publication
router.post('/announcements/schedule', scheduleAnnouncementValidator, validate, announcementController.schedule);
// Route to cancel/unpublish current active announcement
router.put('/announcements/cancel', announcementController.cancel);
// Route to cancel/unpublish an announcement by ID
router.put('/announcements/:id/cancel', announcementController.cancel);

// Master Student Registry routes
// Route to list and search records in the master student registry
router.get('/student-registry', adminController.getStudentRegistry);
// Route to create a new record in the master student registry with validation
router.post('/student-registry', studentRegistryValidator, validate, adminController.createStudentRegistryRecord);
// Route to get a single master student registry record by its ID
router.get('/student-registry/:id', adminController.getStudentRegistryRecordById);
// Route to update an existing master student registry record by ID
router.put('/student-registry/:id', adminController.updateStudentRegistryRecord);
// Route to delete a record from the master student registry by ID
router.delete('/student-registry/:id', adminController.deleteStudentRegistryRecord);
// Route to provision an active user account directly from a student registry record
router.post('/student-registry/:id/create-account', adminRegistryController.createAccountForStudentRegistry);

// Student Account Management routes
// Route to create a student account directly with validation
router.post('/students', createStudentValidator, validate, adminRegistryController.createStudent);
// Route to list all existing student user accounts
router.get('/students', adminRegistryController.listStudents);
// Route to retrieve a single student account by user ID
router.get('/students/:id', adminRegistryController.getStudentById);
// Route to partially update a student account by user ID
router.patch('/students/:id', adminRegistryController.updateStudent);

// Student Bulk Import routes
// Route to parse and preview uploaded spreadsheet rows for student import
router.post('/students/import/preview', spreadsheetUpload.single('file'), adminRegistryController.previewStudentBulkImport);
// Route to confirm and execute bulk import of validated student records
router.post('/students/import/confirm', confirmBulkImportValidator, validate, adminRegistryController.confirmStudentBulkImport);

// Faculty Account Management routes
// Route to create a faculty account directly with validation
router.post('/faculty', createFacultyValidator, validate, adminRegistryController.createFaculty);
// Route to list all existing faculty user accounts
router.get('/faculty', adminRegistryController.listFaculty);
// Route to retrieve a single faculty account by user ID
router.get('/faculty/:id', adminRegistryController.getFacultyById);
// Route to partially update a faculty account by user ID
router.patch('/faculty/:id', adminRegistryController.updateFaculty);
// Route to provision an active user account directly from a faculty registry record
router.post('/faculty-registry/:id/create-account', adminRegistryController.createAccountForFacultyRegistry);

// Master Faculty Registry routes
// Route to list and search records in the master faculty registry
router.get('/faculty-registry', adminRegistryController.getFacultyRegistry);
// Route to create a new record in the master faculty registry with validation
router.post('/faculty-registry', facultyRegistryValidator, validate, adminRegistryController.createFacultyRegistryRecord);
// Route to get a single master faculty registry record by ID
router.get('/faculty-registry/:id', adminRegistryController.getFacultyRegistryRecordById);
// Route to update an existing master faculty registry record by ID
router.put('/faculty-registry/:id', adminRegistryController.updateFacultyRegistryRecord);
// Route to delete a record from the master faculty registry by ID
router.delete('/faculty-registry/:id', adminRegistryController.deleteFacultyRegistryRecord);

// Export the configured router instance for use in main Express server application
module.exports = router;
