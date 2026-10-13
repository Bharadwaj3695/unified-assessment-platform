// Import multer library for handling multipart/form-data file uploads
const multer = require('multer');
// Import Node.js built-in path module for file and directory path manipulations
const path = require('path');
// Import Node.js built-in file system module for synchronous directory checks and creation
const fs = require('fs');

// Resolve the absolute path to the uploads directory relative to the current file
const uploadDir = path.resolve(__dirname, '../../uploads');
// Check if the destination uploads directory does not exist on disk
if (!fs.existsSync(uploadDir)) {
  // Recursively create the uploads directory and any missing parent directories
  fs.mkdirSync(uploadDir, { recursive: true });
// Close directory existence check
}

// Configure multer disk storage engine with custom destination and file naming strategies
const storage = multer.diskStorage({
  // Define callback function to specify destination directory for incoming uploaded files
  destination: (req, file, cb) => {
    // Provide null for error and pass uploadDir path to callback
    cb(null, uploadDir);
  // Close destination function definition
  },
  // Define callback function to generate unique filenames for uploaded files
  filename: (req, file, cb) => {
    // Create high-entropy unique suffix using current timestamp and random integer
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Extract file extension from original uploaded filename
    const ext = path.extname(file.originalname);
    // Call callback with sanitized filename containing field name, suffix, and extension
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  // Close filename function definition
  },
// Close diskStorage configuration object
});

// Define general file filter function to validate file extensions and MIME types
const fileFilter = (req, file, cb) => {
  // Extract and convert original file extension to lowercase
  const ext = path.extname(file.originalname).toLowerCase();
  // Define regular expression matching hazardous or executable file extensions
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|py|pl|cgi|jar|war|dll|so)$/i;
  // Test if uploaded file extension matches any dangerous executable extensions
  if (dangerousExtensions.test(ext)) {
    // Construct new Error informing that executable files are prohibited
    const err = new Error('Executable files are strictly forbidden');
    // Set HTTP 400 Bad Request status code on error object
    err.statusCode = 400;
    // Return early passing error to multer callback to reject upload
    return cb(err);
  // Close dangerous extension check
  }

  // Define regular expression matching permitted general extensions
  const allowedExtensions = /^\.(jpe?g|png|webp|pdf|docx?|zip)$/i;
  // Define regular expression matching permitted MIME content types
  const allowedMimetypes = /^(image\/(jpeg|png|webp)|application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/i;

  // Check if either file extension or MIME type passes allowed criteria
  if (allowedExtensions.test(ext) || allowedMimetypes.test(file.mimetype)) {
    // Accept file upload by passing null error and true boolean
    return cb(null, true);
  // Close allowed type check
  }
  // Construct error for rejected file types outside allowed list
  const err = new Error('Only image and document files (JPEG, PNG, WEBP, PDF, DOC, DOCX, ZIP) are allowed');
  // Set HTTP 400 Bad Request status code on error object
  err.statusCode = 400;
  // Pass error to multer callback to reject upload
  cb(err);
// Close fileFilter function definition
};

// Initialize general multer upload instance with storage, file size limits, and filter
const upload = multer({
  // Use configured disk storage engine
  storage,
  // Enforce a maximum file size limit of 10 megabytes (10 * 1024 * 1024 bytes)
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  // Apply general file extension and MIME type validation filter
  fileFilter,
// Close multer initialization options object
});

// Define strict file filter function for user profile avatar uploads
const avatarFileFilter = (req, file, cb) => {
  // Extract and convert original avatar filename extension to lowercase
  const ext = path.extname(file.originalname).toLowerCase();
  // Define regular expression for allowed image extensions
  const allowedExtensions = /^\.(jpe?g|png|webp)$/i;
  // Define regular expression for allowed image MIME types
  const allowedMimetypes = /^image\/(jpeg|png|webp)$/i;

  // Explicitly define regular expression for dangerous executable file extensions
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|py|pl|cgi|jar|war)$/i;
  // Test if uploaded avatar matches dangerous executable extension list
  if (dangerousExtensions.test(ext)) {
    // Construct new Error prohibiting executable uploads
    const err = new Error('Executable files are strictly forbidden');
    // Set HTTP 400 Bad Request status code on error object
    err.statusCode = 400;
    // Return early passing error to multer callback to reject upload
    return cb(err);
  // Close dangerous extension check
  }

  // Verify that both the extension and MIME type match accepted image formats
  if (allowedExtensions.test(ext) && allowedMimetypes.test(file.mimetype)) {
    // Accept the avatar file upload
    return cb(null, true);
  // Close accepted image format check
  }
  // Construct error when uploaded avatar is not an accepted image format
  const err = new Error('Only image files (JPEG, PNG, WEBP) are permitted for profile pictures');
  // Set HTTP 400 Bad Request status code on error object
  err.statusCode = 400;
  // Return early passing error to multer callback
  return cb(err);
// Close avatarFileFilter function definition
};

// Initialize multer upload instance specifically tailored for user avatars
const avatarUpload = multer({
  // Use configured disk storage engine
  storage,
  // Enforce a 5 megabyte maximum file size limit for avatars
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for avatars
  // Apply avatar-specific image format validation filter
  fileFilter: avatarFileFilter,
// Close avatarUpload options object
});

// Define strict file filter function for document file uploads
const documentFileFilter = (req, file, cb) => {
  // Extract and convert original document filename extension to lowercase
  const ext = path.extname(file.originalname).toLowerCase();
  // Define comprehensive regular expression for prohibited executable and script extensions
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|mjs|py|pl|cgi|jar|war|dll|so|html|htm|svg|xml|vbs|ps1)$/i;
  // Test if uploaded document matches dangerous script or executable extensions
  if (dangerousExtensions.test(ext)) {
    // Construct error prohibiting script and executable file uploads
    const err = new Error('Executable and script files are strictly forbidden');
    // Set HTTP 400 Bad Request status code on error object
    err.statusCode = 400;
    // Return early passing error to multer callback
    return cb(err);
  // Close dangerous extension check
  }

  // Define regular expression matching allowed document file extensions
  const allowedExtensions = /^\.(pdf|docx?)$/i;
  // Define regular expression matching allowed document MIME types
  const allowedMimetypes = /^(application\/(pdf|msword|x-msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|zip|octet-stream))$/i;

  // Check if both file extension and MIME type match permitted document criteria
  if (allowedExtensions.test(ext) && allowedMimetypes.test(file.mimetype)) {
    // Accept the document file upload
    return cb(null, true);
  // Close permitted document criteria check
  }

  // Construct error indicating only PDF, DOC, and DOCX documents are accepted
  const err = new Error('Only document files (PDF, DOC, DOCX) are allowed');
  // Set HTTP 400 Bad Request status code on error object
  err.statusCode = 400;
  // Return early passing error to multer callback
  return cb(err);
// Close documentFileFilter function definition
};

// Initialize multer upload instance for documents stored in memory buffers
const documentUpload = multer({
  // Use in-memory buffer storage rather than writing directly to disk
  storage: multer.memoryStorage(),
  // Set maximum document file size limit of 10 megabytes
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB default limit
  // Apply document-specific extension and MIME type filter
  fileFilter: documentFileFilter,
// Close documentUpload options object
});

// Define file filter function for bulk import spreadsheet files
const spreadsheetFileFilter = (req, file, cb) => {
  // Extract and convert original spreadsheet filename extension to lowercase
  const ext = path.extname(file.originalname).toLowerCase();
  // Define regex matching dangerous executable and script file extensions
  const dangerousExtensions = /^\.(exe|sh|bat|cmd|php|js|mjs|py|pl|cgi|jar|war|dll|so|html|htm|svg|xml|vbs|ps1)$/i;
  // Test if uploaded spreadsheet matches dangerous script or executable extensions
  if (dangerousExtensions.test(ext)) {
    // Construct error prohibiting script and executable file uploads
    const err = new Error('Executable and script files are strictly forbidden');
    // Set HTTP 400 Bad Request status code on error object
    err.statusCode = 400;
    // Return early passing error to multer callback
    return cb(err);
  // Close dangerous extension check
  }

  // Define regular expression matching valid spreadsheet extensions (.csv, .xlsx, .xls)
  const allowedExtensions = /^\.(csv|xlsx|xls)$/i;
  // Define regular expression matching valid spreadsheet MIME types
  const allowedMimetypes = /^(text\/csv|text\/plain|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream)$/i;

  // Verify that either file extension or MIME type matches allowed spreadsheet types
  if (allowedExtensions.test(ext) || allowedMimetypes.test(file.mimetype)) {
    // Accept the spreadsheet file upload
    return cb(null, true);
  // Close allowed spreadsheet check
  }

  // Construct error indicating only CSV, XLSX, and XLS formats are allowed
  const err = new Error('Only spreadsheet files (.csv, .xlsx, .xls) are allowed for bulk import');
  // Set HTTP 400 Bad Request status code on error object
  err.statusCode = 400;
  // Return early passing error to multer callback
  return cb(err);
// Close spreadsheetFileFilter function definition
};

// Initialize multer upload instance for spreadsheet parsing from memory buffers
const spreadsheetUpload = multer({
  // Store spreadsheet buffer in RAM for parsing with xlsx/csv parsers
  storage: multer.memoryStorage(),
  // Set maximum spreadsheet file size limit of 10 megabytes
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  // Apply spreadsheet-specific extension and MIME type filter
  fileFilter: spreadsheetFileFilter,
// Close spreadsheetUpload options object
});

// Export default multer upload middleware instance
module.exports = upload;
// Export named upload middleware instance
module.exports.upload = upload;
// Export avatar-specific upload middleware instance
module.exports.avatarUpload = avatarUpload;
// Export document-specific memory upload middleware instance
module.exports.documentUpload = documentUpload;
// Export spreadsheet-specific memory upload middleware instance
module.exports.spreadsheetUpload = spreadsheetUpload;
