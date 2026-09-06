const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password, role, instituteCode } = req.body;
      const result = await authService.register({
        name,
        email,
        password,
        role,
        instituteCode,
        ipAddress: req.ip,
      });
      return successResponse(res, 'User registered successfully', result, 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({
        email,
        password,
        ipAddress: req.ip,
      });
      return successResponse(res, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatar: req.user.avatar,
        bio: req.user.bio,
        createdAt: req.user.createdAt,
      };
      return successResponse(res, 'Profile retrieved successfully', user);
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
      return successResponse(res, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
