// Import the admin registry service providing business logic for student and faculty registries and bulk operations
const adminRegistryService = require('../services/adminRegistry.service');
// Destructure standardized JSON response formatting utility methods for success, pagination, and error responses
const { successResponse, paginatedResponse, errorResponse } = require('../utils/response');

// Define AdminRegistryController class managing student and faculty registry operations and account synchronization
class AdminRegistryController {
  // =========================================================================
  // Section Header: Student Account & Registry Management Endpoints
  // =========================================================================

  // Controller action to create and register a new student account
  async createStudent(req, res, next) {
    // Begin try block to catch synchronous exceptions and rejected promises during student creation
    try {
      // Destructure required student fields from incoming request body
      const { studentId, name, dateOfBirth, email, password } = req.body;
      // Invoke createStudent on adminRegistryService passing payload, authenticated admin, and client IP
      const result = await adminRegistryService.createStudent(
        // Consolidate student account credentials and biographical fields into an object
        { studentId, name, dateOfBirth, email, password },
        // Pass authenticated administrator user object from auth middleware
        req.user,
        // Pass client IP address for security audit logging
        req.ip
      // Terminate createStudent invocation
      );
      // Return HTTP 201 Created response indicating successful registration
      return successResponse(res, 'Student created and registered successfully', result, 201);
    // Catch block for handling validation or database conflict errors
    } catch (err) {
      // Check if the error object carries an explicit HTTP status code
      if (err.statusCode) {
        // Return structured error response with the specific status code and message
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code conditional branch
      }
      // Check if the error is a MongoDB duplicate key constraint violation (code 11000)
      if (err.code === 11000) {
        // Extract the duplicated field name from keyPattern, falling back to 'field'
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        // Return HTTP 409 Conflict response informing client of unique constraint collision
        return errorResponse(res, `A record with this ${field} already exists`, 409);
      // Terminate duplicate key conditional branch
      }
      // Forward unhandled runtime errors to global Express error middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate createStudent method definition
  }

  // Controller action to list all student accounts with search, filter, and pagination
  async listStudents(req, res, next) {
    // Begin try block for querying paginated student accounts
    try {
      // Extract pagination and query filtering parameters with default fallbacks from req.query
      const { page = 1, limit = 10, search = '', status = '' } = req.query;
      // Fetch students and pagination statistics from adminRegistryService
      const data = await adminRegistryService.listStudents({ page, limit, search, status });
      // Return HTTP 200 response with structured pagination metadata and student records
      return paginatedResponse(
        // Express response object
        res,
        // Informative status message
        'Students retrieved successfully',
        // Array of student user objects
        data.students,
        // Current active page number
        data.pagination.page,
        // Page size limit
        data.pagination.limit,
        // Total matching document count
        data.pagination.total
      // Terminate paginatedResponse invocation
      );
    // Catch block for database or querying errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate listStudents method definition
  }

  // Controller action to retrieve an individual student's details by database ID
  async getStudentById(req, res, next) {
    // Begin try block for finding student by identifier
    try {
      // Query adminRegistryService using target student ID from route URL parameters
      const data = await adminRegistryService.getStudentById(req.params.id);
      // Return HTTP 200 response containing student record details
      return successResponse(res, 'Student retrieved successfully', data);
    // Catch block for lookup failures
    } catch (err) {
      // Evaluate if error contains a custom HTTP status code (e.g. 404 Not Found)
      if (err.statusCode) {
        // Return structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code conditional
      }
      // Forward unexpected errors to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate getStudentById method definition
  }

  // Controller action to update student account details such as name, status, and active flag
  async updateStudent(req, res, next) {
    // Begin try block for student update operation
    try {
      // Extract mutable student fields from request body
      const { name, status, isActive } = req.body;
      // Update student via adminRegistryService passing ID, update fields, admin context, and client IP
      const updatedUser = await adminRegistryService.updateStudent(
        // Target student user ID from URL route parameters
        req.params.id,
        // Object containing updated student properties
        { name, status, isActive },
        // Authenticated admin user performing the modification
        req.user,
        // Request IP address for audit trail
        req.ip
      // Terminate updateStudent invocation
      );
      // Return HTTP 200 response confirming student account update
      return successResponse(res, 'Student account updated successfully', updatedUser);
    // Catch block for update errors
    } catch (err) {
      // Check if a specific HTTP status code was thrown
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate updateStudent method definition
  }

  // Controller action to automatically generate a student user account from an existing registry entry
  async createAccountForStudentRegistry(req, res, next) {
    // Begin try block for creating student account from registry record
    try {
      // Invoke createAccountForStudentRegistry on service with registry ID, admin user, and IP
      const result = await adminRegistryService.createAccountForStudentRegistry(
        // Target registry entry ID from route URL parameter
        req.params.id,
        // Authenticated admin user performing action
        req.user,
        // Request IP address for audit trail
        req.ip
      // Terminate createAccountForStudentRegistry invocation
      );
      // Return HTTP 201 Created response indicating student account was provisioned
      return successResponse(res, 'User account successfully created from Student Registry', result, 201);
    // Catch block for account provisioning failures
    } catch (err) {
      // Evaluate if error specifies an HTTP status code
      if (err.statusCode) {
        // Return structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate error status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate createAccountForStudentRegistry method definition
  }

  // =========================================================================
  // Section Header: Faculty Account & Registry Management Endpoints
  // =========================================================================

  // Controller action to create and register a new faculty member account
  async createFaculty(req, res, next) {
    // Begin try block for faculty account creation
    try {
      // Extract faculty profile attributes from request body
      const { facultyId, name, email, department, password } = req.body;
      // Delegate faculty creation to adminRegistryService passing payload, admin user, and client IP
      const result = await adminRegistryService.createFaculty(
        // Object containing faculty details
        { facultyId, name, email, department, password },
        // Authenticated administrator user object
        req.user,
        // Client IP address for audit logging
        req.ip
      // Terminate createFaculty invocation
      );
      // Return HTTP 201 Created response upon successful faculty account creation
      return successResponse(res, 'Faculty created and registered successfully', result, 201);
    // Catch block for handling validation, duplicate, or service errors
    } catch (err) {
      // Check if error contains an explicit HTTP status code
      if (err.statusCode) {
        // Return custom error response matching error status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Check if error corresponds to MongoDB duplicate key error code 11000
      if (err.code === 11000) {
        // Determine the collided key attribute name from error pattern
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        // Return HTTP 409 Conflict response detailing duplicate field
        return errorResponse(res, `A record with this ${field} already exists`, 409);
      // Terminate duplicate key check
      }
      // Forward unexpected errors to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate createFaculty method definition
  }

  // Controller action to retrieve paginated list of faculty accounts with filters
  async listFaculty(req, res, next) {
    // Begin try block for querying faculty list
    try {
      // Destructure query parameters for pagination, search, and status with defaults
      const { page = 1, limit = 10, search = '', status = '' } = req.query;
      // Fetch faculty members and pagination data from adminRegistryService
      const data = await adminRegistryService.listFaculty({ page, limit, search, status });
      // Return HTTP 200 response with structured pagination metadata and faculty records
      return paginatedResponse(
        // Express response object
        res,
        // Success description message
        'Faculty list retrieved successfully',
        // Array of faculty user objects
        data.faculty,
        // Active page index
        data.pagination.page,
        // Items per page
        data.pagination.limit,
        // Total matching items count
        data.pagination.total
      // Terminate paginatedResponse invocation
      );
    // Catch block for listing errors
    } catch (err) {
      // Forward error to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate listFaculty method definition
  }

  // Controller action to get a specific faculty member's profile by ID
  async getFacultyById(req, res, next) {
    // Begin try block for faculty lookup
    try {
      // Query faculty details from adminRegistryService using URL parameter ID
      const data = await adminRegistryService.getFacultyById(req.params.id);
      // Return HTTP 200 response with faculty member data
      return successResponse(res, 'Faculty member retrieved successfully', data);
    // Catch block for lookup failures
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate getFacultyById method definition
  }

  // Controller action to update an existing faculty member's details
  async updateFaculty(req, res, next) {
    // Begin try block for updating faculty details
    try {
      // Extract mutable faculty properties from request body
      const { name, department, status, isActive } = req.body;
      // Delegate faculty update to adminRegistryService
      const updatedUser = await adminRegistryService.updateFaculty(
        // Target faculty ID from URL parameter
        req.params.id,
        // Updated properties object
        { name, department, status, isActive },
        // Authenticated admin user performing the action
        req.user,
        // Request IP address for audit trail
        req.ip
      // Terminate updateFaculty invocation
      );
      // Return HTTP 200 response confirming faculty account update
      return successResponse(res, 'Faculty account updated successfully', updatedUser);
    // Catch block for update errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate updateFaculty method definition
  }

  // Controller action to provision a user account for a faculty registry entry
  async createAccountForFacultyRegistry(req, res, next) {
    // Begin try block for provisioning account from faculty registry entry
    try {
      // Call createAccountForFacultyRegistry on service with registry ID, admin user, and client IP
      const result = await adminRegistryService.createAccountForFacultyRegistry(
        // Target faculty registry ID from URL parameter
        req.params.id,
        // Authenticated admin user performing the action
        req.user,
        // Request IP address for logging
        req.ip
      // Terminate createAccountForFacultyRegistry invocation
      );
      // Return HTTP 201 Created response indicating successful account provisioning
      return successResponse(res, 'User account successfully created from Faculty Registry', result, 201);
    // Catch block for provisioning errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate createAccountForFacultyRegistry method definition
  }

  // =========================================================================
  // Section Header: Faculty Registry Master Data CRUD Endpoints
  // =========================================================================

  // Controller action to fetch paginated faculty registry master records
  async getFacultyRegistry(req, res, next) {
    // Begin try block for fetching faculty registry records
    try {
      // Destructure query parameters for pagination, search, and status with defaults
      const { page = 1, limit = 10, search = '', status = '' } = req.query;
      // Fetch faculty registry records from adminRegistryService
      const data = await adminRegistryService.getFacultyRegistry({ page, limit, search, status });
      // Return HTTP 200 response with structured pagination metadata and registry records
      return paginatedResponse(
        // Express response object
        res,
        // Success status message
        'Faculty registry records retrieved',
        // Array of faculty registry records
        data.records,
        // Current active page index
        data.pagination.page,
        // Items limit per page
        data.pagination.limit,
        // Total count of matching records
        data.pagination.total
      // Terminate paginatedResponse invocation
      );
    // Catch block for registry query errors
    } catch (err) {
      // Forward error to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate getFacultyRegistry method definition
  }

  // Controller action to create a new master entry in the faculty registry
  async createFacultyRegistryRecord(req, res, next) {
    // Begin try block for creating faculty registry entry
    try {
      // Extract registry fields from request body
      const { facultyId, name, email, status } = req.body;
      // Create registry record via adminRegistryService
      const record = await adminRegistryService.createFacultyRegistryRecord(
        // Registry record attributes object
        { facultyId, name, email, status },
        // Authenticated admin user performing the action
        req.user,
        // Request IP address for logging
        req.ip
      // Terminate createFacultyRegistryRecord invocation
      );
      // Return HTTP 201 Created response with created registry record
      return successResponse(res, 'Faculty registry record created successfully', record, 201);
    // Catch block for creation failures
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Check if error corresponds to MongoDB duplicate key error code 11000
      if (err.code === 11000) {
        // Return HTTP 409 Conflict response detailing duplicate faculty ID or email
        return errorResponse(res, 'Faculty ID or Email already exists in registry', 409);
      // Terminate duplicate key check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate createFacultyRegistryRecord method definition
  }

  // Controller action to fetch a single faculty registry record by ID
  async getFacultyRegistryRecordById(req, res, next) {
    // Begin try block for fetching single faculty registry record
    try {
      // Query faculty registry record by ID using adminRegistryService
      const record = await adminRegistryService.getFacultyRegistryRecordById(req.params.id);
      // Return HTTP 200 response with retrieved faculty registry record
      return successResponse(res, 'Faculty registry record retrieved', record);
    // Catch block for lookup errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate getFacultyRegistryRecordById method definition
  }

  // Controller action to update an existing faculty registry record
  async updateFacultyRegistryRecord(req, res, next) {
    // Begin try block for updating faculty registry record
    try {
      // Extract mutable registry record fields from request body
      const { facultyId, name, email, status } = req.body;
      // Update faculty registry record via adminRegistryService
      const record = await adminRegistryService.updateFacultyRegistryRecord(
        // Target faculty registry record ID from URL parameter
        req.params.id,
        // Updated attributes object
        { facultyId, name, email, status },
        // Authenticated admin user performing the action
        req.user,
        // Request IP address for logging
        req.ip
      // Terminate updateFacultyRegistryRecord invocation
      );
      // Return HTTP 200 response with updated faculty registry record
      return successResponse(res, 'Faculty registry record updated successfully', record);
    // Catch block for update errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Check if error corresponds to MongoDB duplicate key error code 11000
      if (err.code === 11000) {
        // Return HTTP 409 Conflict response detailing duplicate faculty ID or email
        return errorResponse(res, 'Faculty ID or Email already exists in registry', 409);
      // Terminate duplicate key check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate updateFacultyRegistryRecord method definition
  }

  // Controller action to delete a record from the faculty registry
  async deleteFacultyRegistryRecord(req, res, next) {
    // Begin try block for deleting faculty registry record
    try {
      // Delete record via adminRegistryService
      const result = await adminRegistryService.deleteFacultyRegistryRecord(
        // Target faculty registry record ID from URL parameter
        req.params.id,
        // Authenticated admin user performing the action
        req.user,
        // Request IP address for logging
        req.ip
      // Terminate deleteFacultyRegistryRecord invocation
      );
      // Return HTTP 200 response confirming deletion
      return successResponse(res, 'Faculty registry record deleted successfully', result);
    // Catch block for deletion errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate deleteFacultyRegistryRecord method definition
  }

  // =========================================================================
  // Section Header: Bulk Student Import Endpoints
  // =========================================================================

  // Controller action to preview and validate a bulk student import spreadsheet
  async previewStudentBulkImport(req, res, next) {
    // Begin try block for previewing student spreadsheet import
    try {
      // Verify if a file was uploaded in the multipart request
      if (!req.file) {
        // Return HTTP 400 Bad Request if no file was uploaded
        return errorResponse(res, 'No spreadsheet file uploaded (.csv, .xlsx, .xls required)', 400);
      // Terminate file existence check
      }

      // Generate preview and validation summary from uploaded file buffer and name
      const previewData = await adminRegistryService.previewStudentBulkImport(
        // In-memory buffer of uploaded spreadsheet file
        req.file.buffer,
        // Original filename of uploaded spreadsheet
        req.file.originalname
      // Terminate previewStudentBulkImport invocation
      );

      // Return HTTP 200 response containing preview data and row validations
      return successResponse(res, 'Spreadsheet preview generated successfully', previewData);
    // Catch block for preview generation errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate previewStudentBulkImport method definition
  }

  // Controller action to confirm and execute bulk student import from validated records
  async confirmStudentBulkImport(req, res, next) {
    // Begin try block for confirming bulk student import
    try {
      // Extract records array from request body
      const { records } = req.body;
      // Validate that records exists and is an array
      if (!records || !Array.isArray(records)) {
        // Return HTTP 400 Bad Request if records array is missing or invalid
        return errorResponse(res, 'Valid records array is required for import confirmation', 400);
      // Terminate records validation check
      }

      // Delegate batch creation of student records to adminRegistryService
      const result = await adminRegistryService.confirmStudentBulkImport(
        // Array of validated student records to create
        records,
        // Authenticated admin user performing the import
        req.user,
        // Request IP address for audit logging
        req.ip
      // Terminate confirmStudentBulkImport invocation
      );

      // Return HTTP 200 response confirming bulk import completion with created count
      return successResponse(res, `Bulk import completed: ${result.createdCount} students created`, result);
    // Catch block for import confirmation errors
    } catch (err) {
      // Check if error contains an HTTP status code
      if (err.statusCode) {
        // Send structured error response with status code
        return errorResponse(res, err.message, err.statusCode);
      // Terminate status code check
      }
      // Forward unhandled exceptions to Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate confirmStudentBulkImport method definition
  }
// Terminate AdminRegistryController class definition
}

// Export singleton instance of AdminRegistryController for application routing
module.exports = new AdminRegistryController();
