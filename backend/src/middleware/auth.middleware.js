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

    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active' || !user.isActive) {
      const message = user ? `Account status is ${user.status}. Access denied.` : 'User not found';
      return errorResponse(res, message, 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired', 401);
    }
    return errorResponse(res, 'Invalid authentication token', 401);
  }
};

module.exports = {
  authenticate,
};
