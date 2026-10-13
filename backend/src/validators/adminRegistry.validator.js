// Import the body validation middleware factory from the express-validator package
const { body } = require('express-validator');

// Define validation middleware chain for single student creation requests by an administrator
const createStudentValidator = [
  // Validate the studentId field in the request body
  body('studentId')
    // Remove leading and trailing whitespace from studentId
    .trim()
    // Require studentId to not be empty
    .notEmpty()
    // Provide error message if studentId is missing or blank
    .withMessage('Student ID is required')
    // Require studentId to have a minimum length of 2 characters
    .isLength({ min: 2 })
    // Provide error message if studentId has fewer than 2 characters
    .withMessage('Student ID must be at least 2 characters'),
  // Validate the name field in the request body
  body('name')
    // Remove leading and trailing whitespace from name
    .trim()
    // Require name to not be empty
    .notEmpty()
    // Provide error message if name is missing or blank
    .withMessage('Student full name is required')
    // Require name to have a minimum length of 2 characters
    .isLength({ min: 2 })
    // Provide error message if name has fewer than 2 characters
    .withMessage('Name must be at least 2 characters'),
  // Validate the dateOfBirth field in the request body
  body('dateOfBirth')
    // Remove leading and trailing whitespace from dateOfBirth
    .trim()
    // Require dateOfBirth to not be empty
    .notEmpty()
    // Provide error message if dateOfBirth is missing or blank
    .withMessage('Date of birth is required'),
  // Validate the email field in the request body
  body('email')
    // Remove leading and trailing whitespace from email
    .trim()
    // Require email to match a valid email address format
    .isEmail()
    // Provide error message if email format is invalid
    .withMessage('Please provide a valid email address'),
  // Validate the password field in the request body
  body('password')
    // Allow password to be omitted or empty falsy string
    .optional({ values: 'falsy' })
    // Require password to have a minimum length of 6 characters if provided
    .isLength({ min: 6 })
    // Provide error message if password has fewer than 6 characters
    .withMessage('Password must be at least 6 characters if provided'),
// End of createStudentValidator middleware array
];

// Define validation middleware chain for single faculty creation requests by an administrator
const createFacultyValidator = [
  // Validate the facultyId field in the request body
  body('facultyId')
    // Remove leading and trailing whitespace from facultyId
    .trim()
    // Require facultyId to not be empty
    .notEmpty()
    // Provide error message if facultyId is missing or blank
    .withMessage('Faculty ID is required')
    // Require facultyId to have a minimum length of 2 characters
    .isLength({ min: 2 })
    // Provide error message if facultyId has fewer than 2 characters
    .withMessage('Faculty ID must be at least 2 characters'),
  // Validate the name field in the request body
  body('name')
    // Remove leading and trailing whitespace from name
    .trim()
    // Require name to not be empty
    .notEmpty()
    // Provide error message if name is missing or blank
    .withMessage('Faculty full name is required')
    // Require name to have a minimum length of 2 characters
    .isLength({ min: 2 })
    // Provide error message if name has fewer than 2 characters
    .withMessage('Name must be at least 2 characters'),
  // Validate the email field in the request body
  body('email')
    // Remove leading and trailing whitespace from email
    .trim()
    // Require email to match a valid email address format
    .isEmail()
    // Provide error message if email format is invalid
    .withMessage('Please provide a valid email address'),
  // Validate the department field in the request body
  body('department')
    // Allow department field to be optional
    .optional()
    // Remove leading and trailing whitespace from department
    .trim(),
  // Validate the password field in the request body
  body('password')
    // Allow password to be omitted or empty falsy string
    .optional({ values: 'falsy' })
    // Require password to have a minimum length of 6 characters if provided
    .isLength({ min: 6 })
    // Provide error message if password has fewer than 6 characters
    .withMessage('Password must be at least 6 characters if provided'),
// End of createFacultyValidator middleware array
];

// Define validation middleware chain for student registry record creation or updates
const studentRegistryValidator = [
  // Validate the studentId field in the request body
  body('studentId')
    // Remove leading and trailing whitespace from studentId
    .trim()
    // Require studentId to not be empty
    .notEmpty()
    // Provide error message if studentId is missing or blank
    .withMessage('Student ID is required'),
  // Validate the name field in the request body
  body('name')
    // Remove leading and trailing whitespace from name
    .trim()
    // Require name to not be empty
    .notEmpty()
    // Provide error message if name is missing or blank
    .withMessage('Student full name is required'),
  // Validate the dateOfBirth field in the request body
  body('dateOfBirth')
    // Remove leading and trailing whitespace from dateOfBirth
    .trim()
    // Require dateOfBirth to not be empty
    .notEmpty()
    // Provide error message if dateOfBirth is missing or blank
    .withMessage('Date of birth is required'),
  // Validate the email field in the request body
  body('email')
    // Remove leading and trailing whitespace from email
    .trim()
    // Require email to match a valid email address format
    .isEmail()
    // Provide error message if email format is invalid
    .withMessage('Please provide a valid email address'),
  // Validate the status field in the request body
  body('status')
    // Allow status field to be optional
    .optional()
    // Require status to be one of the permitted whitelist values
    .isIn(['active', 'inactive', 'suspended', 'graduated'])
    // Provide error message if status is not in the whitelist
    .withMessage('Status must be active, inactive, suspended, or graduated'),
// End of studentRegistryValidator middleware array
];

// Define validation middleware chain for faculty registry record creation or updates
const facultyRegistryValidator = [
  // Validate the facultyId field in the request body
  body('facultyId')
    // Remove leading and trailing whitespace from facultyId
    .trim()
    // Require facultyId to not be empty
    .notEmpty()
    // Provide error message if facultyId is missing or blank
    .withMessage('Faculty ID is required'),
  // Validate the name field in the request body
  body('name')
    // Remove leading and trailing whitespace from name
    .trim()
    // Require name to not be empty
    .notEmpty()
    // Provide error message if name is missing or blank
    .withMessage('Faculty full name is required'),
  // Validate the email field in the request body
  body('email')
    // Remove leading and trailing whitespace from email
    .trim()
    // Require email to match a valid email address format
    .isEmail()
    // Provide error message if email format is invalid
    .withMessage('Please provide a valid email address'),
  // Validate the status field in the request body
  body('status')
    // Allow status field to be optional
    .optional()
    // Require status to be one of the permitted whitelist values
    .isIn(['active', 'inactive', 'suspended'])
    // Provide error message if status is not in the whitelist
    .withMessage('Status must be active, inactive, or suspended'),
// End of facultyRegistryValidator middleware array
];

// Define validation middleware chain for confirming bulk registry imports
const confirmBulkImportValidator = [
  // Validate the records array field in the request body
  body('records')
    // Require records to be an array with at least 1 row element
    .isArray({ min: 1 })
    // Provide error message if records is not an array or is empty
    .withMessage('Records array is required and must contain at least one row'),
// End of confirmBulkImportValidator middleware array
];

// Export all administrator registry validators as an object
module.exports = {
  // Export student creation validator
  createStudentValidator,
  // Export faculty creation validator
  createFacultyValidator,
  // Export student registry validator
  studentRegistryValidator,
  // Export faculty registry validator
  facultyRegistryValidator,
  // Export bulk import confirmation validator
  confirmBulkImportValidator,
// End of module.exports object
};
