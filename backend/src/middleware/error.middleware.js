// Import standardized JSON error response utility for formatting API error payloads
const { errorResponse } = require('../utils/response');
// Import Winston application logger to record full error details and stack traces
const logger = require('../utils/logger');

// Centralized Express error-handling middleware that catches, categorizes, and formats all application errors
const errorHandler = (err, req, res, next) => {
  // Log error message or error representation to Winston logger with stack information
  logger.error('API Error: %s', err.message || err);

  // Multer Error (file upload limits and invalid multipart)
  if (err.name === 'MulterError') {
    // Map Multer file size threshold violation to HTTP 413 Payload Too Large; map other upload errors to HTTP 400
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    // Set user-friendly error message depending on whether upload size was exceeded
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size exceeds the allowed limit'
        : err.message || 'File upload error';
    // Return structured error response with mapped status code
    return errorResponse(res, message, statusCode);
  }

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    // Return HTTP 404 Not Found when a malformed MongoDB ObjectId is queried
    return errorResponse(res, `Resource not found with id of ${err.value}`, 404);
  }

  // Mongoose Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    // Extract the specific field name that caused the uniqueness violation
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    // Return HTTP 409 Conflict informing client of duplicated unique key
    return errorResponse(res, `${field} is already registered.`, 409);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    // Map individual schema field validation failures into structured array of error objects
    const errors = Object.values(err.errors).map((val) => ({
      // Field path failing validation
      field: val.path,
      // Field-specific validation failure message
      message: val.message,
    }));
    // Return HTTP 422 Unprocessable Entity with detailed field validation errors
    return errorResponse(res, 'Validation failed', 422, errors);
  }

  // Standard or custom errors
  // Extract custom HTTP status code if attached to error object; default to 403 for CORS errors or 500 Internal Server Error
  const statusCode = err.statusCode || (err.message && err.message.startsWith('CORS blocked') ? 403 : 500);
  // Extract error message; default to generic internal server error for unhandled exceptions
  const message = err.message || 'Internal Server Error';

  // Return standardized error response, including error stack trace only in local development mode
  return errorResponse(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === 'development' ? err.stack : null
  );
};

// Export centralized error-handling middleware
module.exports = {
  errorHandler,
};
