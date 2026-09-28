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
      if (result.mfaRequired) {
        return successResponse(res, 'MFA challenge verification required', result, 200);
      }
      return successResponse(res, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req, res, next) {
    try {
      const userService = require('../services/user.service');
      const profile = await userService.getProfile(req.user.id);
      return successResponse(res, 'Profile retrieved successfully', profile);
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

  async getGoogleAuthUrl(req, res, next) {
    try {
      const googleAuthService = require('../services/googleAuth.service');
      const data = googleAuthService.getAuthUrl();
      return successResponse(res, 'Google authorization URL generated', data);
    } catch (err) {
      next(err);
    }
  }

  async googleLogin(req, res, next) {
    try {
      const { code, state, idToken, credential } = req.body;
      const result = await authService.googleLogin({
        code,
        state,
        idToken,
        credential,
        ipAddress: req.ip,
      });
      if (result.mfaRequired) {
        return successResponse(res, 'MFA challenge verification required', result, 200);
      }
      const statusCode = result.status === 'pending' ? 202 : 200;
      return successResponse(res, result.message || 'Google authentication successful', result, statusCode);
    } catch (err) {
      next(err);
    }
  }

  async googleAuthCallback(req, res, next) {
    try {
      const { code, state } = req.query;
      const result = await authService.googleLogin({
        code,
        state,
        ipAddress: req.ip,
      });
      if (result.mfaRequired) {
        return successResponse(res, 'MFA challenge verification required', result, 200);
      }
      return successResponse(res, result.message || 'Google authentication successful', result);
    } catch (err) {
      next(err);
    }
  }

  async mfaSetup(req, res, next) {
    try {
      const result = await authService.initiateMfaSetup(req.user._id);
      return successResponse(res, 'MFA setup initiated', result);
    } catch (err) {
      next(err);
    }
  }

  async mfaSetupConfirm(req, res, next) {
    try {
      const { code } = req.body;
      const result = await authService.confirmMfaSetup(req.user._id, code);
      return successResponse(res, result.message || 'MFA enabled successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async mfaVerify(req, res, next) {
    try {
      const { mfaToken, code } = req.body;
      const result = await authService.verifyMfaChallenge({
        mfaToken,
        code,
        ipAddress: req.ip,
      });
      return successResponse(res, 'MFA verification successful', result);
    } catch (err) {
      next(err);
    }
  }

  async mfaRecovery(req, res, next) {
    try {
      const { mfaToken, recoveryCode } = req.body;
      const result = await authService.redeemMfaRecoveryCode({
        mfaToken,
        recoveryCode,
        ipAddress: req.ip,
      });
      return successResponse(res, 'Recovery code accepted. Login successful.', result);
    } catch (err) {
      next(err);
    }
  }

  async mfaDisable(req, res, next) {
    try {
      const { password, code } = req.body;
      const result = await authService.disableMfa({
        userId: req.user._id,
        password,
        code,
        ipAddress: req.ip,
      });
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  async mfaRegenerateRecoveryCodes(req, res, next) {
    try {
      const { password, code } = req.body;
      const result = await authService.regenerateRecoveryCodes({
        userId: req.user._id,
        password,
        code,
        ipAddress: req.ip,
      });
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const refreshToken =
        req.body?.refreshToken ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : null);
      const result = await authService.refreshAccessToken({
        refreshToken,
        ipAddress: req.ip,
      });
      return successResponse(res, 'Token refreshed successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
