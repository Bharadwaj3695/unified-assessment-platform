const { errorResponse } = require('../utils/response');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
};

module.exports = {
  authorize,
};
