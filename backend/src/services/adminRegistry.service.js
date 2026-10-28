// Import the built-in Node.js cryptographic module for secure random token and password generation
const crypto = require('crypto');
// Import the SheetJS (xlsx) library for reading and parsing Excel and CSV spreadsheet files
const XLSX = require('xlsx');
// Destructure database models for Users, Student Registry, Faculty Registry, and Audit Logs
const { User, StudentRegistry, FacultyRegistry, AuditLog } = require('../models');
// Import password hashing helper function based on bcrypt
const { hashPassword } = require('../utils/password');
// Import email service for dispatching notification and onboarding emails
const emailService = require('./email.service');
// Import application logger for logging warnings, errors, and system events
const logger = require('../utils/logger');

// Normalization utilities
// Helper arrow function to trim and uppercase identifier strings or return an empty string
const normalizeId = (val) => (val && typeof val === 'string' ? val.trim().toUpperCase() : '');
// Helper arrow function to trim and lowercase email address strings or return an empty string
const normalizeEmail = (val) => (val && typeof val === 'string' ? val.trim().toLowerCase() : '');
// Helper arrow function to trim and collapse multiple consecutive whitespace characters in names
const normalizeName = (val) => (val && typeof val === 'string' ? val.trim().replace(/\s+/g, ' ') : '');
// Helper arrow function to normalize different date of birth formats into an ISO YYYY-MM-DD string
const normalizeDob = (val) => {
  // If the value is falsey, return null
  if (!val) return null;
  // Check if value is already a Date object instance
  if (val instanceof Date) {
    // Verify Date is valid before slicing YYYY-MM-DD, otherwise return null
    return isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
  }
  // Check if value is a numeric Excel date serial number
  if (typeof val === 'number') {
    // Excel numeric date conversion
    // Convert Excel serial number (days since 1899-12-30) to JavaScript Date object
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    // Verify the converted date is valid before returning YYYY-MM-DD slice
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  // Check if value is a string representation of a date
  if (typeof val === 'string') {
    // Trim leading and trailing whitespace from the string
    const trimmed = val.trim();
    // Match date string starting with YYYY-MM-DD or YYYY/MM/DD
    const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    // If year-first pattern matches
    if (match) {
      // Extract the 4-digit year component
      const year = match[1];
      // Extract and pad the month component to 2 digits
      const month = match[2].padStart(2, '0');
      // Extract and pad the day component to 2 digits
      const day = match[3].padStart(2, '0');
      // Return formatted ISO date string YYYY-MM-DD
      return `${year}-${month}-${day}`;
    }
    // Match DD-MM-YYYY or DD/MM/YYYY
    // Match date string formatted as DD-MM-YYYY or DD/MM/YYYY
    const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    // If day-first pattern matches
    if (dmy) {
      // Extract and pad the day component to 2 digits
      const day = dmy[1].padStart(2, '0');
      // Extract and pad the month component to 2 digits
      const month = dmy[2].padStart(2, '0');
      // Extract the 4-digit year component
      const year = dmy[3];
      // Return formatted ISO date string YYYY-MM-DD
      return `${year}-${month}-${day}`;
    }
    // Attempt standard Date constructor parsing on the trimmed string
    const parsed = new Date(trimmed);
    // If parsed date is valid, return the YYYY-MM-DD slice
    if (!isNaN(parsed.getTime())) {
      // Extract and return the ISO date substring
      return parsed.toISOString().slice(0, 10);
    }
  }
  // Return null if none of the normalization formats could parse the date
  return null;
};

// Helper function to validate email structure using regular expression
const isValidEmail = (email) => {
  // Test email against standard email format pattern with local and domain parts
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Define AdminRegistryService class containing administrative management methods for registry and accounts
class AdminRegistryService {
  // =========================================================================
  // 1. Individual Student Management
  // =========================================================================

  /**
   * Adds an individual student: creates master StudentRegistry record and corresponding User account.
   */
  // Method to create a student in registry and create corresponding user account
  async createStudent({ studentId, name, dateOfBirth, email, password }, adminUser, ipAddress) {
    // Normalize student ID to uppercase trimmed format
    const normStudentId = normalizeId(studentId);
    // Normalize email to lowercase trimmed format
    const normEmail = normalizeEmail(email);
    // Normalize full name by trimming and standardizing spaces
    const normName = normalizeName(name);
    // Normalize date of birth into YYYY-MM-DD format
    const normDobStr = normalizeDob(dateOfBirth);

    // Verify all four mandatory student fields are present
    if (!normStudentId || !normEmail || !normName || !normDobStr) {
      // Create validation error if any mandatory field is missing
      const err = new Error('Student ID, full name, date of birth, and email are required');
      // Set HTTP bad request status code 400
      err.statusCode = 400;
      // Throw the validation error
      throw err;
    }

    // Validate email format syntax
    if (!isValidEmail(normEmail)) {
      // Create validation error for invalid email format
      const err = new Error('Please provide a valid institutional email address');
      // Set HTTP bad request status code 400
      err.statusCode = 400;
      // Throw the email validation error
      throw err;
    }

    // 1. Check duplicate in StudentRegistry
    // Check if studentId already exists in StudentRegistry collection
    const existingRegistryId = await StudentRegistry.findOne({ studentId: normStudentId });
    // If studentId already exists in registry, throw conflict error
    if (existingRegistryId) {
      // Construct duplicate ID error message
      const err = new Error(`Student ID "${normStudentId}" already exists in the Student Registry`);
      // Set HTTP conflict status code 409
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Check if email already exists in StudentRegistry collection
    const existingRegistryEmail = await StudentRegistry.findOne({ email: normEmail });
    // If email already exists in registry, throw conflict error
    if (existingRegistryEmail) {
      // Construct duplicate email error message
      const err = new Error(`Email "${normEmail}" already exists in the Student Registry`);
      // Set HTTP conflict status code 409
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // 2. Check duplicate in User collection
    // Check if email already exists in User collection
    const existingUserEmail = await User.findOne({ email: normEmail });
    // If email already exists in User collection, throw conflict error
    if (existingUserEmail) {
      // Construct duplicate user email error message
      const err = new Error(`User account with email "${normEmail}" already exists`);
      // Set HTTP conflict status code 409
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Check if studentId is already associated with an existing User account
    const existingUserStudentId = await User.findOne({ studentId: normStudentId });
    // If studentId already exists in User collection, throw conflict error
    if (existingUserStudentId) {
      // Construct duplicate student ID error message
      const err = new Error(`User account with studentId "${normStudentId}" already exists`);
      // Set HTTP conflict status code 409
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // 3. Create StudentRegistry master data
    // Persist new student record in StudentRegistry collection
    const registryRecord = await StudentRegistry.create({
      // Assign normalized student ID
      studentId: normStudentId,
      // Assign normalized full name
      name: normName,
      // Assign parsed Date object of normalized date of birth
      dateOfBirth: new Date(normDobStr),
      // Assign normalized email address
      email: normEmail,
      // Set initial registry status to active
      status: 'active',
    });

    // 4. Generate secure initial password and hash
    // Use provided password if at least 6 characters, otherwise generate secure 16-hex random password with special chars
    const initialPassword = password && password.length >= 6
      ? password
      : crypto.randomBytes(8).toString('hex') + '!Aa1';
    // Hash the initial plaintext password using bcrypt
    const hashedPassword = await hashPassword(initialPassword);

    // 5. Create active User account
    // Persist new User account for the student
    const userAccount = await User.create({
      // Assign student name
      name: normName,
      // Assign student email
      email: normEmail,
      // Assign hashed password
      password: hashedPassword,
      // Assign student role
      role: 'student',
      // Set account status to active
      status: 'active',
      // Set active boolean flag to true
      isActive: true,
      // Assign student identifier
      studentId: normStudentId,
      // Assign student date of birth
      dateOfBirth: new Date(normDobStr),
      // Record approval timestamp as current date
      approvedAt: new Date(),
      // Record ID of approving administrator
      approvedBy: adminUser?._id || null,
    });

    // 6. Audit logs
    // Record audit log for creating registry entry
    await AuditLog.create({
      // Record acting admin user ID or null
      userId: adminUser?._id || null,
      // Record action type for registry creation
      action: 'STUDENT_REGISTRY_CREATED',
      // Specify target entity model type
      entityType: 'StudentRegistry',
      // Specify ID of newly created registry record
      entityId: registryRecord._id.toString(),
      // Include student identifying details in metadata
      details: { studentId: normStudentId, email: normEmail, name: normName },
      // Record client IP address of requester
      ipAddress,
    });

    // Record audit log for creating user account
    await AuditLog.create({
      // Record acting admin user ID or null
      userId: adminUser?._id || null,
      // Record action type for user account creation
      action: 'STUDENT_ACCOUNT_CREATED',
      // Specify target entity model type
      entityType: 'User',
      // Specify ID of newly created user account
      entityId: userAccount._id.toString(),
      // Include student account details in metadata
      details: { studentId: normStudentId, email: normEmail, role: 'student' },
      // Record client IP address of requester
      ipAddress,
    });

    // 7. Dispatch welcome email (non-blocking failure safe)
    try {
      // Send welcome email containing login information to the student
      await emailService.sendStudentAccountCreatedEmail(userAccount);
    } catch (mailErr) {
      // Log warning message if email dispatch encounters an error without failing the request
      logger.warn(`[AdminRegistryService] Welcome email dispatch failed for ${normEmail}: ${mailErr.message}`);
    }

    // Return the created registry record and serialized user object
    return {
      // Master student registry document
      registry: registryRecord,
      // Formatted user account object
      user: userAccount.toJSON(),
    };
  }

  /**
   * Lists students with search and pagination, combining account and registry information.
   */
  // Method to list student user accounts with optional status, search filter, and pagination
  async listStudents({ page = 1, limit = 10, search = '', status = '' }) {
    // Initialize base database query filter for users with student role
    const query = { role: 'student' };
    // If status filter is specified, add it to query
    if (status) {
      // Assign status criteria to query filter
      query.status = status;
    }
    // If search term is specified, apply regex match across name, email, and studentId
    if (search) {
      // Construct logical OR condition for case-insensitive regex search
      query.$or = [
        // Match search term against student name
        { name: { $regex: search, $options: 'i' } },
        // Match search term against student email
        { email: { $regex: search, $options: 'i' } },
        // Match search term against student ID
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate document offset for pagination
    const skip = (page - 1) * limit;
    // Count total matching documents in User collection
    const total = await User.countDocuments(query);
    // Query User collection with projection, sorting, pagination skip and limit
    const users = await User.find(query)
      // Exclude password and sensitive MFA fields from query projection
      .select('-password -mfaSecret -mfaPendingSecret -mfaRecoveryCodes')
      // Sort users by creation date in descending order (newest first)
      .sort({ createdAt: -1 })
      // Skip preceding pages of records
      .skip(skip)
      // Limit number of returned records to page limit
      .limit(parseInt(limit, 10));

    // Return list of students alongside pagination metadata
    return {
      // Array of student user documents
      students: users,
      // Pagination information object
      pagination: {
        // Current page number
        page: parseInt(page, 10),
        // Number of items per page
        limit: parseInt(limit, 10),
        // Total count of matching students
        total,
        // Calculated total page count
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single student details with registry link.
   */
  // Method to fetch a single student user by ID and attach corresponding registry data
  async getStudentById(id) {
    // Find student user document by primary key and role
    const user = await User.findOne({ _id: id, role: 'student' })
      // Exclude password and sensitive MFA secrets from returned document
      .select('-password -mfaSecret -mfaPendingSecret -mfaRecoveryCodes');
    // If student user does not exist, throw 404 error
    if (!user) {
      // Create not found error instance
      const err = new Error('Student account not found');
      // Set HTTP status code to 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Initialize variable to hold matching registry record
    let registryRecord = null;
    // If the student user has an associated studentId, fetch registry record
    if (user.studentId) {
      // Look up student in master StudentRegistry by studentId
      registryRecord = await StudentRegistry.findOne({ studentId: user.studentId });
    }

    // Return the user account and linked registry record
    return { user, registry: registryRecord };
  }

  /**
   * Updates student details and synchronizes with registry.
   */
  // Method to update student details such as name, status, and active state
  async updateStudent(id, { name, status, isActive }, adminUser, ipAddress) {
    // Find the student user document by ID and role
    const user = await User.findOne({ _id: id, role: 'student' });
    // If student user not found, throw 404 error
    if (!user) {
      // Create not found error instance
      const err = new Error('Student account not found');
      // Set HTTP status code to 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Store previous status before applying updates for audit logging
    const oldStatus = user.status;
    // If new name provided, normalize and update user's name
    if (name) user.name = normalizeName(name);
    // If new status provided, update status and sync isActive boolean
    if (status) {
      // Set user status property
      user.status = status;
      // Set isActive flag based on whether status is active
      user.isActive = status === 'active';
    }
    // If isActive boolean is explicitly provided, update flag and status accordingly
    if (typeof isActive === 'boolean') {
      // Set isActive property directly
      user.isActive = isActive;
      // Set status to active if true or revoked if false
      user.status = isActive ? 'active' : 'revoked';
    }

    // Save updated user document to the database
    await user.save();

    // If registry record exists, sync name
    // Synchronize name change to StudentRegistry if studentId and name are present
    if (user.studentId && name) {
      // Update name in StudentRegistry collection
      await StudentRegistry.updateOne(
        // Filter by studentId
        { studentId: user.studentId },
        // Set new normalized name
        { $set: { name: user.name } }
      );
    }

    // Record audit log entry for student account update
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action identifier for student update
      action: 'STUDENT_ACCOUNT_UPDATED',
      // Target entity model type
      entityType: 'User',
      // ID of updated student user
      entityId: user._id.toString(),
      // Audit details including student ID and status transition
      details: {
        // Associated student ID
        studentId: user.studentId,
        // Status prior to update
        oldStatus,
        // Status following update
        newStatus: user.status,
      },
      // Client IP address
      ipAddress,
    });

    // Return updated user object serialized as JSON
    return user.toJSON();
  }

  /**
   * Creates a User account for an existing StudentRegistry record that doesn't yet have an account.
   */
  // Method to provision a User account for a pre-existing student registry record
  async createAccountForStudentRegistry(registryId, adminUser, ipAddress) {
    // Find master student registry record by primary key
    const registry = await StudentRegistry.findById(registryId);
    // If registry record does not exist, throw 404 error
    if (!registry) {
      // Create not found error instance
      const err = new Error('Student Registry record not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Check if a user account already exists with matching email or studentId
    const existingUser = await User.findOne({
      // Search by email or studentId match
      $or: [{ email: registry.email }, { studentId: registry.studentId }],
    });
    // If user account already exists, throw 409 conflict error
    if (existingUser) {
      // Create conflict error message
      const err = new Error(`User account already exists for student ID ${registry.studentId} (${registry.email})`);
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Generate random secure password with special characters and uppercase/digits
    const initialPassword = crypto.randomBytes(8).toString('hex') + '!Aa1';
    // Hash the initial plaintext password using bcrypt
    const hashedPassword = await hashPassword(initialPassword);

    // Create new active User account with data from registry
    const userAccount = await User.create({
      // Assign registry student name
      name: registry.name,
      // Assign registry email address
      email: registry.email,
      // Assign hashed password
      password: hashedPassword,
      // Assign student role
      role: 'student',
      // Set account status to active
      status: 'active',
      // Set active boolean flag to true
      isActive: true,
      // Assign student ID from registry
      studentId: registry.studentId,
      // Assign date of birth from registry
      dateOfBirth: registry.dateOfBirth,
      // Set approval timestamp to now
      approvedAt: new Date(),
      // Record approving admin user ID or null
      approvedBy: adminUser?._id || null,
    });

    // Record audit log for account creation from registry
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'STUDENT_ACCOUNT_CREATED',
      // Target entity model type
      entityType: 'User',
      // ID of created user account
      entityId: userAccount._id.toString(),
      // Metadata indicating account creation from registry
      details: { studentId: registry.studentId, email: registry.email, createdFromRegistry: true },
      // Client IP address
      ipAddress,
    });

    try {
      // Dispatch welcome email to student with account details
      await emailService.sendStudentAccountCreatedEmail(userAccount);
    } catch (mailErr) {
      // Log warning if email delivery fails without rejecting account creation
      logger.warn(`[AdminRegistryService] Welcome email dispatch failed: ${mailErr.message}`);
    }

    // Return registry document and serialized user account
    return { registry, user: userAccount.toJSON() };
  }

  // =========================================================================
  // 2. Individual Faculty Management
  // =========================================================================

  /**
   * Adds an individual faculty/instructor: creates FacultyRegistry record and User account.
   */
  // Method to create faculty registry entry and corresponding instructor user account
  async createFaculty({ facultyId, name, email, department, password }, adminUser, ipAddress) {
    // Normalize faculty ID to uppercase trimmed format
    const normFacultyId = normalizeId(facultyId);
    // Normalize email to lowercase trimmed format
    const normEmail = normalizeEmail(email);
    // Normalize full name by trimming and standardizing spaces
    const normName = normalizeName(name);

    // Verify all mandatory faculty fields are present
    if (!normFacultyId || !normEmail || !normName) {
      // Create validation error if any mandatory field is missing
      const err = new Error('Faculty ID, full name, and email are required');
      // Set HTTP bad request status code 400
      err.statusCode = 400;
      // Throw the validation error
      throw err;
    }

    // Verify email format syntax
    if (!isValidEmail(normEmail)) {
      // Create validation error for invalid email
      const err = new Error('Please provide a valid institutional email address');
      // Set HTTP bad request status code 400
      err.statusCode = 400;
      // Throw the email validation error
      throw err;
    }

    // 1. Check FacultyRegistry duplicates
    // Check if facultyId already exists in FacultyRegistry collection
    const existingFacultyId = await FacultyRegistry.findOne({ facultyId: normFacultyId });
    // If facultyId already exists in registry, throw conflict error
    if (existingFacultyId) {
      // Construct duplicate faculty ID error message
      const err = new Error(`Faculty ID "${normFacultyId}" already exists in the Faculty Registry`);
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Check if email already exists in FacultyRegistry collection
    const existingFacultyEmail = await FacultyRegistry.findOne({ email: normEmail });
    // If email already exists in registry, throw conflict error
    if (existingFacultyEmail) {
      // Construct duplicate faculty email error message
      const err = new Error(`Email "${normEmail}" already exists in the Faculty Registry`);
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // 2. Check User duplicates
    // Check if email already exists in User collection
    const existingUserEmail = await User.findOne({ email: normEmail });
    // If email already exists in User collection, throw conflict error
    if (existingUserEmail) {
      // Construct duplicate user email error message
      const err = new Error(`User account with email "${normEmail}" already exists`);
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Check if facultyId already exists in User collection
    const existingUserFacultyId = await User.findOne({ facultyId: normFacultyId });
    // If facultyId already exists in User collection, throw conflict error
    if (existingUserFacultyId) {
      // Construct duplicate user facultyId error message
      const err = new Error(`User account with facultyId "${normFacultyId}" already exists`);
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // 3. Create FacultyRegistry record
    // Persist new faculty record in FacultyRegistry collection
    const registryRecord = await FacultyRegistry.create({
      // Assign normalized faculty ID
      facultyId: normFacultyId,
      // Assign normalized full name
      name: normName,
      // Assign normalized email address
      email: normEmail,
      // Set initial status to active
      status: 'active',
    });

    // 4. Generate initial password and hash
    // Use provided password if at least 6 characters, otherwise generate secure 16-hex random password
    const initialPassword = password && password.length >= 6
      ? password
      : crypto.randomBytes(8).toString('hex') + '!Aa1';
    // Hash initial password using bcrypt
    const hashedPassword = await hashPassword(initialPassword);

    // 5. Create active instructor User account
    // Persist new User account with instructor role
    const userAccount = await User.create({
      // Assign instructor name
      name: normName,
      // Assign instructor email
      email: normEmail,
      // Assign hashed password
      password: hashedPassword,
      // Set role to instructor
      role: 'instructor',
      // Set status to active
      status: 'active',
      // Set active boolean flag to true
      isActive: true,
      // Assign normalized faculty ID
      facultyId: normFacultyId,
      // Assign trimmed department name or null
      department: department ? department.trim() : null,
      // Set approval timestamp to current date
      approvedAt: new Date(),
      // Set approving admin user ID or null
      approvedBy: adminUser?._id || null,
    });

    // 6. Audit logs
    // Record audit log for creating faculty registry entry
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_REGISTRY_CREATED',
      // Target entity model type
      entityType: 'FacultyRegistry',
      // ID of created registry record
      entityId: registryRecord._id.toString(),
      // Faculty identifying metadata
      details: { facultyId: normFacultyId, email: normEmail, name: normName },
      // Client IP address
      ipAddress,
    });

    // Record audit log for creating instructor user account
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_ACCOUNT_CREATED',
      // Target entity model type
      entityType: 'User',
      // ID of created user account
      entityId: userAccount._id.toString(),
      // User account metadata
      details: { facultyId: normFacultyId, email: normEmail, role: 'instructor' },
      // Client IP address
      ipAddress,
    });

    // 7. Dispatch welcome email
    try {
      // Send welcome email containing login credentials to faculty member
      await emailService.sendFacultyAccountCreatedEmail(userAccount);
    } catch (mailErr) {
      // Log warning if welcome email dispatch fails without interrupting account creation
      logger.warn(`[AdminRegistryService] Welcome email dispatch failed for faculty ${normEmail}: ${mailErr.message}`);
    }

    // Return created registry record and serialized user object
    return {
      // Master faculty registry record
      registry: registryRecord,
      // Formatted user account document
      user: userAccount.toJSON(),
    };
  }

  /**
   * Lists faculty members with search and pagination.
   */
  // Method to list faculty user accounts with optional search query, status filter, and pagination
  async listFaculty({ page = 1, limit = 10, search = '', status = '' }) {
    // Initialize base query filter for users with instructor role
    const query = { role: 'instructor' };
    // If status filter provided, append status to query
    if (status) {
      // Assign status criteria to query filter
      query.status = status;
    }
    // If search term provided, apply regex search across name, email, facultyId, and department
    if (search) {
      // Construct logical OR condition for case-insensitive regex search
      query.$or = [
        // Match search query against name
        { name: { $regex: search, $options: 'i' } },
        // Match search query against email
        { email: { $regex: search, $options: 'i' } },
        // Match search query against faculty ID
        { facultyId: { $regex: search, $options: 'i' } },
        // Match search query against department
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate document offset for pagination
    const skip = (page - 1) * limit;
    // Count total matching documents in User collection
    const total = await User.countDocuments(query);
    // Query User collection with projection, sorting, pagination skip and limit
    const faculty = await User.find(query)
      // Exclude password and sensitive MFA fields from query results
      .select('-password -mfaSecret -mfaPendingSecret -mfaRecoveryCodes')
      // Sort faculty by creation date descending (newest first)
      .sort({ createdAt: -1 })
      // Skip preceding pages of records
      .skip(skip)
      // Limit results to page limit
      .limit(parseInt(limit, 10));

    // Return list of faculty members alongside pagination metadata
    return {
      // Array of faculty user documents
      faculty,
      // Pagination information object
      pagination: {
        // Current page number
        page: parseInt(page, 10),
        // Items per page
        limit: parseInt(limit, 10),
        // Total matching count
        total,
        // Total number of pages
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single faculty details with registry record.
   */
  // Method to retrieve a single faculty user account by ID and link registry details
  async getFacultyById(id) {
    // Find instructor user document by primary key and role
    const user = await User.findOne({ _id: id, role: 'instructor' })
      // Exclude password and sensitive MFA secrets from returned document
      .select('-password -mfaSecret -mfaPendingSecret -mfaRecoveryCodes');
    // If faculty user not found, throw 404 error
    if (!user) {
      // Create not found error instance
      const err = new Error('Faculty account not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Initialize variable to store matching registry record
    let registryRecord = null;
    // If user has an associated facultyId, fetch registry record
    if (user.facultyId) {
      // Look up faculty in FacultyRegistry by facultyId
      registryRecord = await FacultyRegistry.findOne({ facultyId: user.facultyId });
    }

    // Return user account and corresponding registry record
    return { user, registry: registryRecord };
  }

  /**
   * Updates faculty details.
   */
  // Method to update faculty user properties like name, department, status, and active state
  async updateFaculty(id, { name, department, status, isActive }, adminUser, ipAddress) {
    // Find instructor user document by primary key and role
    const user = await User.findOne({ _id: id, role: 'instructor' });
    // If faculty user not found, throw 404 error
    if (!user) {
      // Create not found error instance
      const err = new Error('Faculty account not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Store previous status for audit logging
    const oldStatus = user.status;
    // If new name provided, normalize and update user's name
    if (name) user.name = normalizeName(name);
    // If department is provided, trim department or set to null
    if (department !== undefined) user.department = department ? department.trim() : null;
    // If status is provided, update status and sync isActive flag
    if (status) {
      // Update status property
      user.status = status;
      // Set isActive based on whether status is active
      user.isActive = status === 'active';
    }
    // If isActive boolean is explicitly provided, update flag and status accordingly
    if (typeof isActive === 'boolean') {
      // Update isActive flag directly
      user.isActive = isActive;
      // Update status to active or revoked
      user.status = isActive ? 'active' : 'revoked';
    }

    // Save updated user document to the database
    await user.save();

    // If user has a facultyId and name was changed, sync name to registry
    if (user.facultyId && name) {
      // Update name in FacultyRegistry collection
      await FacultyRegistry.updateOne(
        // Filter by facultyId
        { facultyId: user.facultyId },
        // Set new normalized name
        { $set: { name: user.name } }
      );
    }

    // Record audit log entry for faculty account update
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_ACCOUNT_UPDATED',
      // Target entity model type
      entityType: 'User',
      // ID of updated faculty user
      entityId: user._id.toString(),
      // Metadata recording faculty ID and status transition
      details: { facultyId: user.facultyId, oldStatus, newStatus: user.status },
      // Client IP address
      ipAddress,
    });

    // Return updated user object serialized as JSON
    return user.toJSON();
  }

  /**
   * Creates a User account for an existing FacultyRegistry record.
   */
  // Method to provision a User account for an existing faculty registry record
  async createAccountForFacultyRegistry(registryId, adminUser, ipAddress) {
    // Find master faculty registry record by primary key
    const registry = await FacultyRegistry.findById(registryId);
    // If registry record not found, throw 404 error
    if (!registry) {
      // Create not found error instance
      const err = new Error('Faculty Registry record not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Check if a user account already exists with matching email or facultyId
    const existingUser = await User.findOne({
      // Search by email or facultyId match
      $or: [{ email: registry.email }, { facultyId: registry.facultyId }],
    });
    // If user account already exists, throw 409 conflict error
    if (existingUser) {
      // Construct duplicate account error message
      const err = new Error(`User account already exists for faculty ID ${registry.facultyId} (${registry.email})`);
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Generate random secure password with special characters and uppercase/digits
    const initialPassword = crypto.randomBytes(8).toString('hex') + '!Aa1';
    // Hash initial password using bcrypt
    const hashedPassword = await hashPassword(initialPassword);

    // Create new active User account with data from faculty registry
    const userAccount = await User.create({
      // Assign registry faculty name
      name: registry.name,
      // Assign registry email address
      email: registry.email,
      // Assign hashed password
      password: hashedPassword,
      // Assign instructor role
      role: 'instructor',
      // Set account status to active
      status: 'active',
      // Set active boolean flag to true
      isActive: true,
      // Assign faculty ID from registry
      facultyId: registry.facultyId,
      // Set approval timestamp to current date
      approvedAt: new Date(),
      // Record approving admin user ID or null
      approvedBy: adminUser?._id || null,
    });

    // Record audit log for faculty account creation from registry
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_ACCOUNT_CREATED',
      // Target entity model type
      entityType: 'User',
      // ID of created user account
      entityId: userAccount._id.toString(),
      // Metadata recording creation details
      details: { facultyId: registry.facultyId, email: registry.email, createdFromRegistry: true },
      // Client IP address
      ipAddress,
    });

    try {
      // Dispatch welcome email to faculty member with login credentials
      await emailService.sendFacultyAccountCreatedEmail(userAccount);
    } catch (mailErr) {
      // Log warning if email dispatch fails without failing the operation
      logger.warn(`[AdminRegistryService] Welcome email dispatch failed for faculty: ${mailErr.message}`);
    }

    // Return registry document and serialized user account
    return { registry, user: userAccount.toJSON() };
  }

  // =========================================================================
  // 3. Faculty Registry CRUD
  // =========================================================================

  /**
   * Synchronizes an individual instructor User account into the FacultyRegistry collection.
   * Ensures facultyId exists, avoids duplicate entries, and reflects active/inactive standing.
   */
  async syncFacultyMemberToRegistry(user) {
    if (!user || user.role !== 'instructor') return null;

    let facultyId = user.facultyId;
    if (!facultyId) {
      const { generateFacultyId } = require('../utils/idGenerator');
      facultyId = await generateFacultyId();
      user.facultyId = facultyId;
      if (typeof user.save === 'function') {
        await user.save();
      }
    }

    const normFacultyId = normalizeId(facultyId);
    const normEmail = normalizeEmail(user.email);
    const normName = normalizeName(user.name);
    const desiredStatus = (user.status === 'inactive' || user.isActive === false) ? 'inactive' : 'active';

    let record = await FacultyRegistry.findOne({
      $or: [{ facultyId: normFacultyId }, { email: normEmail }],
    });

    if (record) {
      let changed = false;
      if (record.status !== desiredStatus) {
        record.status = desiredStatus;
        changed = true;
      }
      if (normFacultyId && record.facultyId !== normFacultyId) {
        record.facultyId = normFacultyId;
        changed = true;
      }
      if (normName && record.name !== normName) {
        record.name = normName;
        changed = true;
      }
      if (normEmail && record.email !== normEmail) {
        record.email = normEmail;
        changed = true;
      }
      if (changed) {
        await record.save();
      }
      return record;
    }

    if (normFacultyId && normEmail && normName) {
      record = await FacultyRegistry.create({
        facultyId: normFacultyId,
        name: normName,
        email: normEmail,
        status: desiredStatus,
      });
      return record;
    }

    return null;
  }

  /**
   * Idempotently synchronizes all active and inactive instructor accounts
   * from the User collection into the authoritative FacultyRegistry collection.
   */
  async syncExistingFacultyToRegistry() {
    try {
      const instructors = await User.find({
        role: 'instructor',
        status: { $in: ['active', 'inactive'] },
      });
      let syncedCount = 0;
      for (const inst of instructors) {
        const synced = await this.syncFacultyMemberToRegistry(inst);
        if (synced) syncedCount++;
      }
      return { syncedCount };
    } catch (err) {
      logger.warn(`[AdminRegistryService] Error syncing existing faculty to registry: ${err.message}`);
      return { syncedCount: 0 };
    }
  }

  // Method to list faculty registry records with optional search, status filtering, and pagination
  async getFacultyRegistry({ page = 1, limit = 10, search = '', status = '' }) {
    // If FacultyRegistry collection is completely empty, backfill from active/inactive instructors
    const totalExisting = await FacultyRegistry.countDocuments();
    if (totalExisting === 0) {
      await this.syncExistingFacultyToRegistry();
    }

    // Initialize empty query filter object
    const query = {};
    // If status filter provided, append status to query
    if (status) query.status = status;
    // If search term provided, construct case-insensitive regex search on facultyId, name, and email
    if (search) {
      // Set up logical OR search conditions across multiple fields
      query.$or = [
        // Match search query against faculty ID
        { facultyId: { $regex: search, $options: 'i' } },
        // Match search query against name
        { name: { $regex: search, $options: 'i' } },
        // Match search query against email
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate document offset for pagination
    const skip = (page - 1) * limit;
    // Count total matching documents in FacultyRegistry collection
    const total = await FacultyRegistry.countDocuments(query);
    // Find matching faculty registry records with sorting, pagination skip and limit
    const records = await FacultyRegistry.find(query)
      // Sort records ascending by facultyId
      .sort({ facultyId: 1 })
      // Skip preceding pages of records
      .skip(skip)
      // Limit results to page limit
      .limit(parseInt(limit, 10));

    // Return records list alongside pagination metadata
    return {
      // Array of faculty registry records
      records,
      // Pagination information object
      pagination: {
        // Current page number
        page: parseInt(page, 10),
        // Limit of records per page
        limit: parseInt(limit, 10),
        // Total matching record count
        total,
        // Total page count
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Method to create a new faculty registry record directly
  async createFacultyRegistryRecord({ facultyId, name, email, status = 'active' }, adminUser, ipAddress) {
    // Normalize faculty ID to uppercase trimmed format
    const normFacultyId = normalizeId(facultyId);
    // Normalize email to lowercase trimmed format
    const normEmail = normalizeEmail(email);
    // Normalize full name by trimming and standardizing spaces
    const normName = normalizeName(name);

    // Validate presence of required fields
    if (!normFacultyId || !normEmail || !normName) {
      // Create validation error if any mandatory field is missing
      const err = new Error('facultyId, name, and email are required');
      // Set HTTP bad request status code 400
      err.statusCode = 400;
      // Throw the validation error
      throw err;
    }

    // Check if faculty ID already exists in the registry
    const existingId = await FacultyRegistry.findOne({ facultyId: normFacultyId });
    // If duplicate faculty ID found, throw 409 conflict error
    if (existingId) {
      // Construct duplicate faculty ID error message
      const err = new Error('Faculty ID already exists in registry');
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Check if email already exists in the registry
    const existingEmail = await FacultyRegistry.findOne({ email: normEmail });
    // If duplicate email found, throw 409 conflict error
    if (existingEmail) {
      // Construct duplicate email error message
      const err = new Error('Email already exists in registry');
      // Set HTTP status code 409 Conflict
      err.statusCode = 409;
      // Throw the conflict error
      throw err;
    }

    // Persist new faculty registry document
    const record = await FacultyRegistry.create({
      // Assign normalized faculty ID
      facultyId: normFacultyId,
      // Assign normalized name
      name: normName,
      // Assign normalized email
      email: normEmail,
      // Assign registry status
      status,
    });

    // Record audit log for registry record creation
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_REGISTRY_CREATED',
      // Target entity model type
      entityType: 'FacultyRegistry',
      // ID of created registry document
      entityId: record._id.toString(),
      // Details metadata
      details: { facultyId: normFacultyId, email: normEmail, status: record.status },
      // Client IP address
      ipAddress,
    });

    // Return the created registry document
    return record;
  }

  // Method to fetch a single faculty registry record by primary key ID
  async getFacultyRegistryRecordById(id) {
    // Find faculty registry record by primary key
    const record = await FacultyRegistry.findById(id);
    // If record not found, throw 404 error
    if (!record) {
      // Create not found error instance
      const err = new Error('Faculty registry record not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }
    // Return found registry document
    return record;
  }

  // Method to update an existing faculty registry record by ID
  async updateFacultyRegistryRecord(id, { facultyId, name, email, status }, adminUser, ipAddress) {
    // Find faculty registry record by primary key
    const record = await FacultyRegistry.findById(id);
    // If record not found, throw 404 error
    if (!record) {
      // Create not found error instance
      const err = new Error('Faculty registry record not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // If new facultyId is provided, check for conflicts and update
    if (facultyId) {
      // Normalize provided faculty ID
      const normId = normalizeId(facultyId);
      // Only check if changed from current value
      if (normId !== record.facultyId) {
        // Query for another registry record with the same faculty ID
        const dup = await FacultyRegistry.findOne({ facultyId: normId, _id: { $ne: id } });
        // If conflict detected, throw 409 conflict error
        if (dup) {
          // Construct duplicate ID error message
          const err = new Error('Faculty ID already exists in registry');
          // Set HTTP status code 409 Conflict
          err.statusCode = 409;
          // Throw the conflict error
          throw err;
        }
        // Update faculty ID on record
        record.facultyId = normId;
      }
    }

    // If new email is provided, check for conflicts and update
    if (email) {
      // Normalize provided email address
      const normEmail = normalizeEmail(email);
      // Only check if changed from current value
      if (normEmail !== record.email) {
        // Query for another registry record with the same email
        const dup = await FacultyRegistry.findOne({ email: normEmail, _id: { $ne: id } });
        // If conflict detected, throw 409 conflict error
        if (dup) {
          // Construct duplicate email error message
          const err = new Error('Email already exists in registry');
          // Set HTTP status code 409 Conflict
          err.statusCode = 409;
          // Throw the conflict error
          throw err;
        }
        // Update email on record
        record.email = normEmail;
      }
    }

    // If new name provided, normalize and update record name
    if (name) record.name = normalizeName(name);
    // If new status provided, update record status
    if (status) record.status = status;

    // Save modifications to the database
    await record.save();

    // Synchronize status back to linked User account if present
    if (status && (status === 'active' || status === 'inactive')) {
      const targetUser = await User.findOne({
        $or: [{ email: record.email }, { facultyId: record.facultyId }],
        role: 'instructor',
      });
      if (targetUser) {
        targetUser.status = status;
        targetUser.isActive = status === 'active';
        if (status === 'inactive') {
          targetUser.revokedAt = new Date();
          targetUser.revokedBy = adminUser?._id || null;
        } else {
          targetUser.revokedAt = null;
          targetUser.revokedBy = null;
        }
        await targetUser.save();
      }
    }

    // Record audit log for registry record update
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_REGISTRY_UPDATED',
      // Target entity model type
      entityType: 'FacultyRegistry',
      // ID of updated registry record
      entityId: record._id.toString(),
      // Metadata recording updated values
      details: { facultyId: record.facultyId, email: record.email, status: record.status },
      // Client IP address
      ipAddress,
    });

    // Return updated registry record
    return record;
  }

  // Method to delete a faculty registry record by ID
  async deleteFacultyRegistryRecord(id, adminUser, ipAddress) {
    // Find faculty registry record by primary key
    const record = await FacultyRegistry.findById(id);
    // If record not found, throw 404 error
    if (!record) {
      // Create not found error instance
      const err = new Error('Faculty registry record not found');
      // Set HTTP status code 404 Not Found
      err.statusCode = 404;
      // Throw the not found error
      throw err;
    }

    // Delete faculty registry document from collection
    await FacultyRegistry.findByIdAndDelete(id);

    // Record audit log for registry record deletion
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'FACULTY_REGISTRY_DELETED',
      // Target entity model type
      entityType: 'FacultyRegistry',
      // Deleted record primary key ID
      entityId: id,
      // Metadata recording deleted faculty identifying details
      details: { facultyId: record.facultyId, email: record.email },
      // Client IP address
      ipAddress,
    });

    // Return deleted record ID object
    return { id };
  }

  // =========================================================================
  // 4. Student Bulk Import (CSV + XLSX)
  // =========================================================================

  /**
   * Parses uploaded CSV or Excel file, validates every row, detects duplicates,
   * and returns preview summary WITHOUT persisting data to database.
   */
  // Method to parse and validate student spreadsheet data for preview before persisting
  async previewStudentBulkImport(fileBuffer, originalFilename) {
    // Verify file buffer exists and is not empty
    if (!fileBuffer || fileBuffer.length === 0) {
      // Create error for empty uploaded file
      const err = new Error('Uploaded file is empty');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the validation error
      throw err;
    }

    // Declare workbook variable
    let workbook;
    try {
      // Read binary buffer into XLSX workbook object with cellDates option enabled
      workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    } catch (parseErr) {
      // Construct parse failure error message
      const err = new Error(`Failed to parse spreadsheet file: ${parseErr.message}`);
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw spreadsheet parse error
      throw err;
    }

    // Retrieve name of first worksheet in the workbook
    const firstSheetName = workbook.SheetNames[0];
    // If workbook has no sheets, throw validation error
    if (!firstSheetName) {
      // Create empty workbook error
      const err = new Error('Spreadsheet contains no sheets');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the empty sheets error
      throw err;
    }

    // Extract first worksheet object from workbook
    const worksheet = workbook.Sheets[firstSheetName];
    // Convert worksheet rows to array of JSON objects with default string values
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    // Verify worksheet has at least one data row
    if (rawRows.length === 0) {
      // Create empty rows error
      const err = new Error('Spreadsheet contains no data rows');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw empty data rows error
      throw err;
    }

    // Check if row count exceeds maximum allowed batch threshold of 2,000 rows
    if (rawRows.length > 2000) {
      // Create row limit exceeded error
      const err = new Error('Spreadsheet exceeds maximum limit of 2,000 rows per batch');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw batch limit error
      throw err;
    }

    // Helper to find column key regardless of casing or formatting
    // Helper function to locate and extract column value based on flexible aliases
    const findColValue = (row, ...aliases) => {
      // Extract array of all keys/headers present in row object
      const keys = Object.keys(row);
      // Iterate through list of acceptable column aliases
      for (const alias of aliases) {
        // Normalize alias by converting to lowercase and stripping non-alphanumeric characters
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Find matching key in row with identical sanitized format
        const matchedKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlias);
        // If matching key exists and value is not undefined
        if (matchedKey && row[matchedKey] !== undefined) {
          // Return trimmed string representation of the cell value
          return String(row[matchedKey]).trim();
        }
      }
      // Return empty string if no matching column alias is found
      return '';
    };

    // Pre-load all existing studentIds and emails from Registry and User collections for fast in-memory conflict lookup
    // Concurrently fetch existing student IDs and emails from both collections
    const [existingRegistry, existingUsers] = await Promise.all([
      // Fetch studentId and email projections from StudentRegistry
      StudentRegistry.find({}).select('studentId email'),
      // Fetch studentId and email projections from User collection
      User.find({}).select('studentId email'),
    ]);

    // Create lookup Set of existing student IDs in StudentRegistry
    const registryStudentIdSet = new Set(existingRegistry.map((r) => r.studentId));
    // Create lookup Set of existing emails in StudentRegistry
    const registryEmailSet = new Set(existingRegistry.map((r) => r.email));
    // Create lookup Set of existing emails in User collection
    const userEmailSet = new Set(existingUsers.map((u) => u.email));
    // Create lookup Set of existing student IDs in User collection
    const userStudentIdSet = new Set(existingUsers.map((u) => u.studentId).filter(Boolean));

    // Initialize Set to track duplicate student IDs within the current upload batch
    const inBatchStudentIds = new Set();
    // Initialize Set to track duplicate emails within the current upload batch
    const inBatchEmails = new Set();

    // Initialize array to hold preview row objects
    const previewRows = [];
    // Initialize counter for valid rows
    let validCount = 0;
    // Initialize counter for duplicate rows
    let duplicateCount = 0;
    // Initialize counter for invalid rows
    let invalidCount = 0;

    // Iterate through all raw rows parsed from the spreadsheet
    for (let i = 0; i < rawRows.length; i++) {
      // Get current row data object
      const row = rawRows[i];
      // Calculate 1-indexed row number in the spreadsheet (accounting for header row)
      const rowNumber = i + 2; // Row 1 is header in Excel/CSV

      // Extract raw student ID column value using common header variations
      const rawStudentId = findColValue(row, 'studentId', 'Student ID', 'student_id', 'StudentID', 'Roll No', 'RollNumber', 'ID');
      // Extract raw student name column value using common header variations
      const rawName = findColValue(row, 'name', 'Name', 'Full Name', 'Student Name', 'StudentName');
      // Extract raw date of birth column value using common header variations
      const rawDob = findColValue(row, 'dateOfBirth', 'Date of Birth', 'DOB', 'dob', 'BirthDate', 'Birth Date');
      // Extract raw email column value using common header variations
      const rawEmail = findColValue(row, 'email', 'Email', 'Email Address', 'Institutional Email', 'Mail');

      // Normalize student ID to uppercase trimmed format
      const normStudentId = normalizeId(rawStudentId);
      // Normalize email to lowercase trimmed format
      const normEmail = normalizeEmail(rawEmail);
      // Normalize full name by trimming and standardizing spaces
      const normName = normalizeName(rawName);
      // Normalize date of birth to YYYY-MM-DD ISO string
      const normDobStr = normalizeDob(rawDob);

      // Initialize row status to VALID
      let status = 'VALID';
      // Initialize array to collect validation error messages for the row
      const reasons = [];

      // Validation 1: Required Fields
      // Check if student ID is missing
      if (!normStudentId) reasons.push('Missing Student ID');
      // Check if student name is missing
      if (!normName) reasons.push('Missing Name');
      // Check if date of birth is missing or invalid
      if (!normDobStr) reasons.push(rawDob ? 'Invalid Date of Birth format (expected YYYY-MM-DD)' : 'Missing Date of Birth');
      // Check if email is missing or has invalid format
      if (!normEmail) {
        // Add reason for missing email
        reasons.push('Missing Email');
      // If email present, validate its format syntax
      } else if (!isValidEmail(normEmail)) {
        // Add reason for invalid email format
        reasons.push('Invalid Email address format');
      }

      // If any required field validation failed
      if (reasons.length > 0) {
        // Mark row status as INVALID
        status = 'INVALID';
        // Increment invalid row counter
        invalidCount++;
      } else {
        // Validation 2: In-file duplicates
        // Initialize flag tracking whether row is a duplicate
        let isDuplicate = false;
        // Check if student ID already appeared in an earlier row of this file
        if (inBatchStudentIds.has(normStudentId)) {
          // Record in-file duplicate student ID reason
          reasons.push(`Duplicate Student ID "${normStudentId}" within uploaded file`);
          // Set duplicate flag to true
          isDuplicate = true;
        }
        // Check if email already appeared in an earlier row of this file
        if (inBatchEmails.has(normEmail)) {
          // Record in-file duplicate email reason
          reasons.push(`Duplicate Email "${normEmail}" within uploaded file`);
          // Set duplicate flag to true
          isDuplicate = true;
        }

        // Validation 3: Database conflicts
        // Check if student ID already exists in StudentRegistry collection
        if (registryStudentIdSet.has(normStudentId)) {
          // Record database conflict reason for student registry ID
          reasons.push(`Student ID "${normStudentId}" already exists in Student Registry`);
          // Set duplicate flag to true
          isDuplicate = true;
        }
        // Check if email already exists in StudentRegistry collection
        if (registryEmailSet.has(normEmail)) {
          // Record database conflict reason for student registry email
          reasons.push(`Email "${normEmail}" already exists in Student Registry`);
          // Set duplicate flag to true
          isDuplicate = true;
        }
        // Check if email already exists in User collection
        if (userEmailSet.has(normEmail)) {
          // Record database conflict reason for user email
          reasons.push(`Email "${normEmail}" already registered to an existing User account`);
          // Set duplicate flag to true
          isDuplicate = true;
        }
        // Check if student ID is already linked to an existing User account
        if (userStudentIdSet.has(normStudentId)) {
          // Record database conflict reason for user student ID
          reasons.push(`Student ID "${normStudentId}" already linked to an existing User account`);
          // Set duplicate flag to true
          isDuplicate = true;
        }

        // If any duplicate conflict was detected
        if (isDuplicate) {
          // Mark row status as DUPLICATE
          status = 'DUPLICATE';
          // Increment duplicate counter
          duplicateCount++;
        } else {
          // Increment valid row counter
          validCount++;
          // Add normalized student ID to in-batch tracking set
          inBatchStudentIds.add(normStudentId);
          // Add normalized email to in-batch tracking set
          inBatchEmails.add(normEmail);
        }
      }

      // Append row evaluation details to preview list
      previewRows.push({
        // 1-indexed row number in spreadsheet
        rowNumber,
        // Normalized or raw student ID fallback
        studentId: normStudentId || rawStudentId || '-',
        // Normalized or raw name fallback
        name: normName || rawName || '-',
        // Normalized or raw date of birth fallback
        dateOfBirth: normDobStr || rawDob || '-',
        // Normalized or raw email fallback
        email: normEmail || rawEmail || '-',
        // Evaluation status: VALID, INVALID, or DUPLICATE
        status,
        // Combined reason string or null if valid
        reason: reasons.join('; ') || null,
      });
    }

    // Return summary statistics alongside all preview rows
    return {
      // Summary counts object
      summary: {
        // Total rows processed
        totalRows: rawRows.length,
        // Count of valid rows ready for import
        validCount,
        // Count of duplicate rows
        duplicateCount,
        // Count of invalid rows with errors
        invalidCount,
      },
      // Array of processed row preview objects
      rows: previewRows,
    };
  }

  /**
   * Confirms and persists valid student rows from preview stage.
   * Creates StudentRegistry records, creates User accounts, sends welcome emails, and records audit logs.
   */
  // Method to persist approved student records into registry and create active user accounts
  async confirmStudentBulkImport(records, adminUser, ipAddress) {
    // Validate that records is a non-empty array
    if (!Array.isArray(records) || records.length === 0) {
      // Create validation error for missing records
      const err = new Error('No records submitted for confirmation');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the validation error
      throw err;
    }

    // Only process records marked as VALID or eligible
    // Filter records to candidates marked VALID or containing required keys
    const candidates = records.filter((r) => r.status === 'VALID' || (!r.status && r.studentId && r.email));

    // Check if at least one candidate record is eligible for import
    if (candidates.length === 0) {
      // Create error for no valid import candidates
      const err = new Error('No valid records found to import');
      // Set HTTP status code 400 Bad Request
      err.statusCode = 400;
      // Throw the validation error
      throw err;
    }

    // Initialize counter for successfully created student accounts
    let createdCount = 0;
    // Initialize counter for skipped duplicate records
    let skippedCount = 0;
    // Initialize array to collect error details for failed rows
    const errors = [];

    // Loop through each candidate record for insertion
    for (const item of candidates) {
      // Normalize student ID to uppercase trimmed format
      const normStudentId = normalizeId(item.studentId);
      // Normalize email to lowercase trimmed format
      const normEmail = normalizeEmail(item.email);
      // Normalize name by trimming and standardizing spaces
      const normName = normalizeName(item.name);
      // Normalize date of birth to YYYY-MM-DD ISO string
      const normDobStr = normalizeDob(item.dateOfBirth);

      try {
        // Re-check conflict to protect against concurrent imports
        // Query database to prevent race conditions during bulk execution
        const conflict = await StudentRegistry.findOne({
          // Check if either studentId or email already exists
          $or: [{ studentId: normStudentId }, { email: normEmail }],
        });
        // If conflict detected, skip this record and log error
        if (conflict) {
          // Increment skipped record counter
          skippedCount++;
          // Record skip error details
          errors.push({
            // Conflicted student ID
            studentId: normStudentId,
            // Conflicted email address
            email: normEmail,
            // Error description
            error: 'Duplicate record detected during confirmation',
          });
          // Proceed to next candidate record
          continue;
        }

        // 1. Create StudentRegistry
        // Persist student master data in StudentRegistry collection
        const registryRecord = await StudentRegistry.create({
          // Normalized student ID
          studentId: normStudentId,
          // Normalized full name
          name: normName,
          // Parsed date of birth Date object
          dateOfBirth: new Date(normDobStr),
          // Normalized email address
          email: normEmail,
          // Initial status active
          status: 'active',
        });

        // 2. Create User account
        // Generate random secure password with special characters and uppercase/digits
        const initialPassword = crypto.randomBytes(8).toString('hex') + '!Aa1';
        // Hash initial password using bcrypt
        const hashedPassword = await hashPassword(initialPassword);

        // Persist new active User account for student
        const userAccount = await User.create({
          // Student full name
          name: normName,
          // Student email address
          email: normEmail,
          // Hashed initial password
          password: hashedPassword,
          // User role set to student
          role: 'student',
          // Account status set to active
          status: 'active',
          // Active boolean flag set to true
          isActive: true,
          // Student identifier
          studentId: normStudentId,
          // Student date of birth
          dateOfBirth: new Date(normDobStr),
          // Approved timestamp set to now
          approvedAt: new Date(),
          // Approving admin user ID or null
          approvedBy: adminUser?._id || null,
        });

        // 3. Welcome email dispatch (safe, non-blocking)
        try {
          // Send welcome email containing login credentials to the newly created student
          await emailService.sendStudentAccountCreatedEmail(userAccount);
        } catch (mailErr) {
          // Log warning if email fails without aborting bulk import
          logger.warn(`[BulkImport] Email dispatch failed for ${normEmail}: ${mailErr.message}`);
        }

        // Increment successfully created counter
        createdCount++;
      } catch (err) {
        // Log error message and stack trace if row import fails
        logger.error(`[BulkImport] Error importing row for ${normStudentId}:`, err);
        // Append error details to errors array
        errors.push({
          // Failed student ID
          studentId: normStudentId,
          // Failed email address
          email: normEmail,
          // Error message
          error: err.message,
        });
      }
    }

    // Write audit log for the completed bulk import
    // Record comprehensive audit log entry for bulk import batch
    await AuditLog.create({
      // Acting administrator user ID or null
      userId: adminUser?._id || null,
      // Action type identifier
      action: 'STUDENT_BULK_IMPORT_COMPLETED',
      // Target entity model type
      entityType: 'StudentRegistry',
      // Unique batch identifier based on current timestamp
      entityId: `batch_${Date.now()}`,
      // Metadata recording batch outcome metrics
      details: {
        // Total valid records submitted
        totalSubmitted: candidates.length,
        // Count of successfully created accounts
        createdCount,
        // Count of skipped records
        skippedCount,
        // Count of failed records
        failedCount: errors.length,
      },
      // Client IP address
      ipAddress,
    });

    // Return bulk import execution results summary
    return {
      // Total candidates submitted
      totalSubmitted: candidates.length,
      // Total created count
      createdCount,
      // Total skipped count
      skippedCount,
      // Total failed count
      failedCount: errors.length,
      // Array of individual row errors
      errors,
    };
  }
}

// Export singleton instance of AdminRegistryService
module.exports = new AdminRegistryService();
