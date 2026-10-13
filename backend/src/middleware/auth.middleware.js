// Import access token verification helper enforcing cryptographic signature and token type checks
const { verifyAccessToken } = require('../utils/jwt');
// Import standardized JSON error response utility for returning consistent HTTP error payloads
const { errorResponse } = require('../utils/response');
// Import User model to retrieve database record for account status and session version validation
const { User } = require('../models');

// Authentication middleware verifying bearer tokens, enforcing active account status and session validity
const authenticate = async (req, res, next) => {
  // Begin try block to catch JWT parsing, verification, or database retrieval exceptions
  try {
    // Extract Authorization header string from incoming HTTP request
    const authHeader = req.headers.authorization;
    // Check if Authorization header is absent or does not adhere to standard Bearer token schema
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Return HTTP 401 Unauthorized indicating missing or malformed authentication header
      return errorResponse(res, 'Authentication token missing or invalid', 401);
    }

    // Split header string on space to isolate the raw JWT token string
    const token = authHeader.split(' ')[1];
    // Cryptographically verify access token signature, expiration, and type
    const decoded = verifyAccessToken(token);

    // Block usage of temporary intermediate MFA challenge tokens on protected API endpoints
    if (decoded.type === 'mfa_challenge') {
      // Return HTTP 401 Unauthorized specifically rejecting challenge tokens
      return errorResponse(res, 'MFA challenge token cannot be used to access protected APIs', 401);
    }

    // Block direct usage of long-lived refresh tokens as bearer access tokens
    if (decoded.type === 'refresh') {
      // Return HTTP 401 Unauthorized specifically rejecting refresh tokens
      return errorResponse(res, 'Refresh token cannot be used to access protected APIs', 401);
    }

    // Resolve user ID from decoded payload supporting both 'id' and standard JWT 'sub' claims
    const userId = decoded.id || decoded.sub;
    // Query MongoDB for the user record identified by the decoded token subject
    const user = await User.findById(userId);
    // Verify user exists and maintains both 'active' account status and boolean isActive flag
    if (!user || user.status !== 'active' || !user.isActive) {
      // Construct dynamic message informing client of their current account standing (e.g. pending, revoked)
      const message = user ? `Account status is ${user.status}. Access denied.` : 'User not found';
      // Return HTTP 401 Unauthorized blocking access for inactive or missing accounts
      return errorResponse(res, message, 401);
    }

    // Enforce server-side session invalidation: compare tokenVersion claim against stored database value
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      // Return HTTP 401 Unauthorized when password change, logout, or admin revocation bumped tokenVersion
      return errorResponse(res, 'Session has expired or been invalidated. Please sign in again.', 401);
    }

    // Attach authenticated User Mongoose document to request object for downstream controllers
    req.user = user;
    // Pass control to the next middleware or route handler in the execution chain
    next();
  // Catch block handling token verification errors or unexpected database exceptions
  } catch (err) {
    // Specifically check if error was triggered by token lifetime expiration
    if (err.name === 'TokenExpiredError') {
      // Return HTTP 401 Unauthorized prompting the frontend client to trigger token refresh
      return errorResponse(res, 'Token has expired', 401);
    }
    // Determine appropriate error message, preserving explicit 401 messages thrown by verifyAccessToken
    const message = (err.statusCode === 401 && err.message) ? err.message : 'Invalid authentication token';
    // Return HTTP 401 Unauthorized with error message
    return errorResponse(res, message, 401);
  }
};

// Export authentication middleware function
module.exports = {
  authenticate,
};
