// Sends a standardized JSON success response envelope to the client
const successResponse = (res, message = 'Success', data = {}, statusCode = 200) => {
  // Set HTTP status code and output standard JSON payload schema
  return res.status(statusCode).json({
    // Boolean indicator confirming successful request handling
    success: true,
    // Descriptive success message
    message,
    // Response payload data payload (object, array, or scalar)
    data,
  });
};

// Sends a standardized JSON error response envelope to the client
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  // Construct baseline error payload object
  const payload = {
    // Boolean indicator confirming request failure
    success: false,
    // User-facing error message describing failure reason
    message,
  };
  // Append detailed validation or field-level error messages if present
  if (errors) {
    // Field errors array or diagnostic details
    payload.errors = errors;
  }
  // Set appropriate HTTP error status code and send JSON payload
  return res.status(statusCode).json(payload);
};

// Sends a standardized JSON paginated response envelope for tabular or list endpoints
const paginatedResponse = (res, message = 'Success', data = [], page = 1, limit = 10, total = 0, extra = {}) => {
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / parsedLimit) || 1);
  const parsedPage = parseInt(page, 10) || 1;
  const currentPage = safeTotal > 0 ? Math.min(Math.max(1, parsedPage), totalPages) : 1;

  // Return HTTP 200 status with structured data array and pagination metadata
  return res.status(200).json({
    // Boolean indicator confirming successful query execution
    success: true,
    // Descriptive success message
    message,
    // Page items array
    data,
    // Pagination calculation metadata
    pagination: {
      // Current 1-based page index parsed to integer
      currentPage,
      // Number of items requested per page parsed to integer
      perPage: parsedLimit,
      // Total number of pages calculated from total count and limit
      totalPages,
      // Total count of matching records across all pages
      totalCount: safeTotal,
    },
    ...extra,
  });
};

// Export response formatting utility functions
module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
