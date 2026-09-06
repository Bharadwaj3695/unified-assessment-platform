const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('API Error: %s', err.message || err);

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    return errorResponse(res, `Resource not found with id of ${err.value}`, 404);
  }

  // Mongoose Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return errorResponse(res, `${field} is already registered.`, 409);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    return errorResponse(res, 'Validation failed', 422, errors);
  }

  // Standard or custom errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === 'development' ? err.stack : null
  );
};

module.exports = {
  errorHandler,
};
