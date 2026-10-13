// Import validationResult extraction helper from express-validator
const { validationResult } = require('express-validator');
// Import standardized JSON error response utility for returning structured validation error envelopes
const { errorResponse } = require('../utils/response');

// Validation middleware executing express-validator rule results and formatting field errors
const validate = (req, res, next) => {
  // Extract validation errors collected from prior validator chains on the request
  const errors = validationResult(req);
  // Check if any validation errors were registered
  if (!errors.isEmpty()) {
    // Transform raw express-validator errors into a clean, normalized field-and-message array
    const formattedErrors = errors.array().map((err) => ({
      // Field path failing validation (supports both modern err.path and legacy err.param)
      field: err.path || err.param,
      // Validation failure description message
      message: err.msg,
    }));
    // Return HTTP 422 Unprocessable Entity with formatted field validation errors
    return errorResponse(res, 'Validation failed', 422, formattedErrors);
  }
  // All fields valid; pass control to the next middleware or controller handler
  next();
};

// Export validation middleware function
module.exports = {
  validate,
};
