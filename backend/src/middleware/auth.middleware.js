const { verifyAccessToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.type === 'mfa_challenge') {
      return errorResponse(res, 'MFA challenge token cannot be used to access protected APIs', 401);
    }

    if (decoded.type === 'refresh') {
      return errorResponse(res, 'Refresh token cannot be used to access protected APIs', 401);
    }

    const userId = decoded.id || decoded.sub;
    const user = await User.findById(userId);
    if (!user || user.status !== 'active' || !user.isActive) {
      const message = user ? `Account status is ${user.status}. Access denied.` : 'User not found';
      return errorResponse(res, message, 401);
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      return errorResponse(res, 'Session has expired or been invalidated. Please sign in again.', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired', 401);
    }
    const message = (err.statusCode === 401 && err.message) ? err.message : 'Invalid authentication token';
    return errorResponse(res, message, 401);
  }
};

module.exports = {
  authenticate,
};
