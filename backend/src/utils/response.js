const successResponse = (res, message = 'Success', data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const payload = {
    success: false,
    message,
  };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(statusCode).json(payload);
};

const paginatedResponse = (res, message = 'Success', data = [], page = 1, limit = 10, total = 0) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      currentPage: parseInt(page, 10),
      perPage: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit) || 1,
      totalCount: total,
    },
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
