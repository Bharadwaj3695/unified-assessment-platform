// Import standardized JSON error response utility for returning consistent HTTP error payloads
const { errorResponse } = require('../utils/response');

// Role-Based Access Control (RBAC) middleware factory restricting endpoint access to specific user roles
const authorize = (...allowedRoles) => {
  // Returns Express middleware function evaluating the authenticated user's role against permitted roles
  return (req, res, next) => {
    // Verify that the request has passed through authentication middleware and attached req.user
    if (!req.user) {
      // Return HTTP 401 Unauthorized if authentication has not occurred
      return errorResponse(res, 'Authentication required', 401);
    }

    // Check if the authenticated user's assigned role is included in the allowed roles list
    if (!allowedRoles.includes(req.user.role)) {
      // Return HTTP 403 Forbidden indicating user identity is authenticated but lacks required authorization
      return errorResponse(
        res,
        `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
        403
      );
    }

    // Role authorized; pass control to next handler in the execution chain
    next();
  };
};

// Export authorization middleware factory function
module.exports = {
  authorize,
};
