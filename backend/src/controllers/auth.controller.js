// Import the authentication service module containing business logic for registration, authentication, tokens, and MFA
const authService = require('../services/auth.service');
// Destructure standardized response helper utilities for generating consistent JSON API responses
const { successResponse, errorResponse } = require('../utils/response');
// Import secure HttpOnly cookie and CSRF utility helpers
const { setRefreshCookie, setCsrfCookie, clearAuthCookies, generateCsrfToken } = require('../utils/cookie');
// Import centralized environment configuration
const env = require('../config/env');

// Define the AuthController class handling HTTP request lifecycle for all authentication and authorization endpoints
class AuthController {
  // Controller action to handle new user registration requests
  async register(req, res, next) {
    // Begin try block to intercept synchronous errors and asynchronous rejections during user registration
    try {
      // Destructure user input registration fields from the incoming HTTP request body
      const {
        // Name of the user registering for an account
        name,
        // Email address of the registering user
        email,
        // Plaintext password chosen by the user
        password,
        // Password confirmation string to verify matching input
        confirmPassword,
        // System role requested by the user: student, instructor, or admin
        role,
        // Unique student identification number if registering as a student
        studentId,
        // Date of birth for identity verification against registry
        dateOfBirth,
        // Unique institutional code identifying the affiliated organization or school
        instituteCode,
      // Source object containing submitted registration form fields
      } = req.body;
      // Delegate registration processing to authService with extracted payload and client IP address
      const result = await authService.register({
        // Pass submitted name
        name,
        // Pass submitted email address
        email,
        // Pass submitted password
        password,
        // Pass submitted confirmation password
        confirmPassword,
        // Pass submitted account role
        role,
        // Pass submitted student identifier
        studentId,
        // Pass submitted date of birth
        dateOfBirth,
        // Pass submitted institutional code
        instituteCode,
        // Pass remote client IP address for security logging and rate limiting
        ipAddress: req.ip,
      // Terminate registration options payload argument object
      });
      // Send HTTP 201 Created response with registration outcome and user data
      return successResponse(res, result.message || 'User registered successfully', result, 201);
    // Catch block to capture any thrown exception or service error
    } catch (err) {
      // Pass the caught error to Express next error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate register method definition
  }

  // Controller action to authenticate users using email and password credentials
  async login(req, res, next) {
    // Begin try block to handle exceptions during credential validation and login processing
    try {
      // Extract user login credentials from incoming HTTP request body
      const { email, password } = req.body;
      // Invoke authService login method with extracted credentials and client IP address
      const result = await authService.login({
        // User account email address
        email,
        // User plaintext secret password
        password,
        // Client IP address for authentication audit log
        ipAddress: req.ip,
      // Terminate credentials argument object
      });
      // Evaluate if multi-factor authentication (MFA) challenge is required before granting session tokens
      if (result.mfaRequired) {
        // Return HTTP 200 indicating MFA verification code is required to proceed (no refresh/CSRF cookie issued)
        return successResponse(res, 'MFA challenge verification required', result, 200);
      // Terminate MFA check conditional branch
      }
      // Set HttpOnly refresh cookie and companion CSRF cookie if token was issued
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Return HTTP 200 indicating successful authentication with issued tokens and profile data
      return successResponse(res, 'Login successful', result);
    // Catch block to intercept authentication or database failure
    } catch (err) {
      // Forward error to the global Express error handler
      next(err);
    // Terminate try-catch block
    }
  // Terminate login method definition
  }

  // Controller action to retrieve the authenticated user's profile details
  async getProfile(req, res, next) {
    // Begin try block to catch errors while querying user profile data
    try {
      // Lazily require user service module to avoid circular dependency issues
      const userService = require('../services/user.service');
      // Fetch user profile data by ID extracted from authenticated JWT payload in req.user
      const profile = await userService.getProfile(req.user.id);
      // Return HTTP 200 response with user profile details
      return successResponse(res, 'Profile retrieved successfully', profile);
    // Catch block to intercept user lookup errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getProfile method definition
  }

  // Controller action to update an authenticated user's password
  async changePassword(req, res, next) {
    // Begin try block for processing password update
    try {
      // Extract existing password and replacement password from request body
      const { currentPassword, newPassword } = req.body;
      // Invoke changePassword on authService passing user ID, current password, and new password
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
      // Return HTTP 200 response with success message confirming password update
      return successResponse(res, result.message);
    // Catch block to intercept verification or validation errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate changePassword method definition
  }

  // Controller action to initiate a password recovery request for a forgotten password
  async forgotPassword(req, res, next) {
    // Begin try block for processing forgot password request
    try {
      // Extract target account email address from the request body
      const { email } = req.body;
      // Call authService forgotPassword to generate password reset token and dispatch email notification
      const result = await authService.forgotPassword(email);
      // Return HTTP 200 response confirming reset link dispatch
      return successResponse(res, result.message, result);
    // Catch block to intercept any runtime or dispatch errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate forgotPassword method definition
  }

  // Controller action to reset account password using verification token
  async resetPassword(req, res, next) {
    // Begin try block to handle password reset execution
    try {
      // Destructure reset verification token, new password, and confirmation password from request body
      const { token, password, confirmPassword } = req.body;
      // Call authService resetPassword with token and new password credentials
      const result = await authService.resetPassword({ token, password, confirmPassword });
      // Return HTTP 200 response indicating password was successfully reset
      return successResponse(res, result.message, result);
    // Catch block to intercept invalid token or mismatched password errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate resetPassword method definition
  }

  // Controller action to generate Google OAuth2 authorization URL
  async getGoogleAuthUrl(req, res, next) {
    // Begin try block for OAuth URL generation
    try {
      // Lazily require Google authentication service module
      const googleAuthService = require('../services/googleAuth.service');
      // Generate OAuth redirect URL and CSRF state token
      const data = googleAuthService.getAuthUrl();
      // Return HTTP 200 response with generated Google authorization URL
      return successResponse(res, 'Google authorization URL generated', data);
    // Catch block for any generation errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate getGoogleAuthUrl method definition
  }

  // Controller action to authenticate users via Google OAuth payload from client application
  async googleLogin(req, res, next) {
    // Begin try block for Google login processing
    try {
      // Destructure OAuth code, state, idToken, and credential token from request body
      const { code, state, idToken, credential } = req.body;
      // Delegate Google login authentication to authService with extracted tokens and client IP
      const result = await authService.googleLogin({
        // OAuth authorization code
        code,
        // CSRF state token
        state,
        // OpenID Connect identity token
        idToken,
        // Google One Tap credential
        credential,
        // Client IP address for logging
        ipAddress: req.ip,
      // Terminate Google login payload object
      });
      // Check if MFA verification is required for the authenticated user
      if (result.mfaRequired) {
        // Return HTTP 200 prompting MFA challenge verification
        return successResponse(res, 'MFA challenge verification required', result, 200);
      // Terminate MFA check conditional branch
      }
      // If fully authenticated session was granted, issue refresh and CSRF cookies
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Determine HTTP status: 202 Accepted if account is pending approval, otherwise 200 OK
      const statusCode = result.status === 'pending' ? 202 : 200;
      // Return HTTP response with authentication details and corresponding status code
      return successResponse(res, result.message || 'Google authentication successful', result, statusCode);
    // Catch block to handle OAuth verification failures
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate googleLogin method definition
  }

  // Controller action to handle Google OAuth server redirect callback with query parameters
  async googleAuthCallback(req, res, next) {
    // Begin try block for handling Google OAuth callback
    try {
      // Destructure authorization code and state token from URL query string parameters
      const { code, state } = req.query;
      // Delegate authentication to authService with extracted query parameters and client IP
      const result = await authService.googleLogin({
        // OAuth authorization code from query
        code,
        // CSRF state token from query
        state,
        // Client IP address
        ipAddress: req.ip,
      // Terminate callback arguments object
      });
      // Check if user account requires MFA challenge verification
      if (result.mfaRequired) {
        // Return HTTP 200 requesting MFA challenge response
        return successResponse(res, 'MFA challenge verification required', result, 200);
      // Terminate MFA check conditional branch
      }
      // If fully authenticated session was granted, issue refresh and CSRF cookies
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Return HTTP 200 response with authentication tokens and user information
      return successResponse(res, result.message || 'Google authentication successful', result);
    // Catch block to handle callback processing errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate googleAuthCallback method definition
  }

  // Controller action to initiate MFA setup and generate TOTP secret and QR code for user
  async mfaSetup(req, res, next) {
    // Begin try block for MFA setup initiation
    try {
      // Invoke initiateMfaSetup on authService for the authenticated user ID
      const result = await authService.initiateMfaSetup(req.user._id);
      // Return HTTP 200 response with MFA secret and setup QR code
      return successResponse(res, 'MFA setup initiated', result);
    // Catch block to intercept setup initiation failures
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaSetup method definition
  }

  // Controller action to confirm MFA setup using a valid 6-digit TOTP code
  async mfaSetupConfirm(req, res, next) {
    // Begin try block for MFA setup confirmation
    try {
      // Extract 6-digit TOTP verification code from request body
      const { code } = req.body;
      // Invoke confirmMfaSetup on authService with user ID and submitted code
      const result = await authService.confirmMfaSetup(req.user._id, code);
      // If refreshed session tokens were issued, update HttpOnly refresh cookie and CSRF cookie
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Return HTTP 200 response confirming MFA activation and providing recovery codes
      return successResponse(res, result.message || 'MFA enabled successfully', result);
    // Catch block for invalid verification code or setup errors
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaSetupConfirm method definition
  }

  // Controller action to verify MFA challenge during login flow
  async mfaVerify(req, res, next) {
    // Begin try block for MFA challenge verification
    try {
      // Extract temporary MFA challenge token and TOTP verification code from request body
      const { mfaToken, code } = req.body;
      // Invoke verifyMfaChallenge on authService with challenge token, code, and client IP
      const result = await authService.verifyMfaChallenge({
        // Temporary signed MFA JWT token
        mfaToken,
        // Submitted 6-digit TOTP code
        code,
        // Client IP address for logging
        ipAddress: req.ip,
      // Terminate MFA challenge verification payload object
      });
      // Set HttpOnly refresh cookie and companion CSRF cookie
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Return HTTP 200 response with full authentication tokens upon successful challenge resolution
      return successResponse(res, 'MFA verification successful', result);
    // Catch block to intercept invalid code or expired challenge token
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaVerify method definition
  }

  // Controller action to authenticate user via single-use backup recovery code
  async mfaRecovery(req, res, next) {
    // Begin try block for MFA recovery code authentication
    try {
      // Extract temporary MFA challenge token and recovery code from request body
      const { mfaToken, recoveryCode } = req.body;
      // Invoke redeemMfaRecoveryCode on authService with challenge token, code, and client IP
      const result = await authService.redeemMfaRecoveryCode({
        // Temporary signed MFA JWT token
        mfaToken,
        // Single-use emergency recovery code string
        recoveryCode,
        // Client IP address for logging
        ipAddress: req.ip,
      // Terminate recovery options payload object
      });
      // Set HttpOnly refresh cookie and companion CSRF cookie
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Return HTTP 200 response indicating successful recovery code redemption and login
      return successResponse(res, 'Recovery code accepted. Login successful.', result);
    // Catch block for invalid or already-used recovery code
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaRecovery method definition
  }

  // Controller action to request and dispatch single-use 6-digit email OTP during MFA login
  async mfaSendEmailOtp(req, res, next) {
    // Begin try block for email OTP dispatch
    try {
      // Extract temporary signed MFA challenge token from request body
      const { mfaToken } = req.body;
      // Invoke sendMfaEmailOtp on authService with challenge token and client IP
      const result = await authService.sendMfaEmailOtp({
        mfaToken,
        ipAddress: req.ip,
      });
      // Return HTTP 200 response confirming email dispatch with masked email and cooldown
      return successResponse(res, result.message, {
        maskedEmail: result.maskedEmail,
        expiresIn: result.expiresIn,
        resendCooldown: result.resendCooldown,
      });
    // Catch block for invalid token, rate limits, or delivery error
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaSendEmailOtp method definition
  }

  // Controller action to verify single-use 6-digit email OTP during MFA login
  async mfaVerifyEmailOtp(req, res, next) {
    // Begin try block for email OTP verification
    try {
      // Extract temporary MFA challenge token and submitted 6-digit email OTP code
      const { mfaToken, code } = req.body;
      // Invoke verifyMfaEmailOtp on authService with challenge token, code, and client IP
      const result = await authService.verifyMfaEmailOtp({
        mfaToken,
        code,
        ipAddress: req.ip,
      });
      // Set HttpOnly refresh cookie and companion CSRF cookie
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }
      // Return HTTP 200 response with full authentication tokens upon successful email OTP verification
      return successResponse(res, 'Email verification successful', result);
    // Catch block to intercept invalid code or expired challenge token
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaVerifyEmailOtp method definition
  }

  // Controller action to disable MFA protection on user account
  async mfaDisable(req, res, next) {
    // Begin try block for MFA deactivation
    try {
      // Reject disable request immediately if authenticated user is a student
      if (req.user && req.user.role === 'student') {
        return errorResponse(res, 'MFA is mandatory for student accounts and cannot be disabled.', 403);
      }

      // Extract user's password and current TOTP code from request body for identity re-verification
      const { password, code } = req.body;
      // Invoke disableMfa on authService with user ID, credentials, and client IP
      const result = await authService.disableMfa({
        // Authenticated user ID
        userId: req.user._id,
        // User's account password
        password,
        // Current TOTP verification code
        code,
        // Client IP address for logging
        ipAddress: req.ip,
      // Terminate disable MFA payload object
      });
      // Return HTTP 200 response confirming MFA has been disabled
      return successResponse(res, result.message, result);
    // Catch block to intercept invalid password or verification code
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaDisable method definition
  }

  // Controller action to regenerate MFA emergency backup recovery codes
  async mfaRegenerateRecoveryCodes(req, res, next) {
    // Begin try block for recovery codes regeneration
    try {
      // Extract account password and current TOTP code from request body for identity re-verification
      const { password, code } = req.body;
      // Invoke regenerateRecoveryCodes on authService with user ID, credentials, and client IP
      const result = await authService.regenerateRecoveryCodes({
        // Authenticated user ID
        userId: req.user._id,
        // User's account password
        password,
        // Current TOTP verification code
        code,
        // Client IP address for logging
        ipAddress: req.ip,
      // Terminate regenerate recovery codes payload object
      });
      // Return HTTP 200 response containing newly generated backup recovery codes
      return successResponse(res, result.message, result);
    // Catch block to intercept invalid credentials or code
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate mfaRegenerateRecoveryCodes method definition
  }

  // Controller action to initiate Email OTP enrollment for authenticated user
  async mfaEmailOtpSetup(req, res, next) {
    try {
      const { password, code } = req.body;
      const result = await authService.initiateEmailOtpSetup(req.user._id, { password, code });
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  // Controller action to confirm Email OTP enrollment using valid 6-digit code
  async mfaEmailOtpSetupConfirm(req, res, next) {
    try {
      const { code } = req.body;
      const result = await authService.confirmEmailOtpSetup(req.user._id, code);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  // Controller action to disable Email OTP independently
  async mfaEmailOtpDisable(req, res, next) {
    try {
      const { password, code } = req.body;
      const result = await authService.disableEmailOtp({
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

  // Controller action to send a test verification email code
  async mfaEmailOtpSendTest(req, res, next) {
    try {
      const result = await authService.sendEmailOtpTest({
        userId: req.user._id,
        ipAddress: req.ip,
      });
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  // Controller action to issue new access token using a valid refresh token
  async refresh(req, res, next) {
    // Begin try block for token refresh processing
    try {
      // Extract refresh token from cookie, request body, or Bearer authorization header
      const refreshToken =
        // Extract from HttpOnly cookie first
        req.cookies?.uap_refresh ||
        // Fallback to request body for backward-compatible migration
        req.body?.refreshToken ||
        // Check if authorization header begins with Bearer scheme prefix
        (req.headers.authorization?.startsWith('Bearer ')
          // Extract the raw token string following the Bearer prefix
          ? req.headers.authorization.split(' ')[1]
          // Default to null if no Bearer token is provided
          : null);
      // Enforce migration cutoff policy: reject body-based tokens when ALLOW_LEGACY_REFRESH_BODY is disabled
      const hasCookieToken = Boolean(req.cookies?.uap_refresh);
      const isBodyToken = !hasCookieToken && (req.body?.refreshToken || req.headers.authorization?.startsWith('Bearer '));
      if (isBodyToken && (env.ALLOW_LEGACY_REFRESH_BODY === false || env.ALLOW_LEGACY_REFRESH_BODY === 'false')) {
        return errorResponse(res, 'Body-based refresh tokens are deprecated. Please sign in again.', 400);
      }

      // Invoke refreshAccessToken on authService with extracted refresh token and client IP
      const result = await authService.refreshAccessToken({
        // Extracted refresh token
        refreshToken,
        // Client IP address for security logging
        ipAddress: req.ip,
      // Terminate refresh token options payload object
      });

      // Set rotated HttpOnly refresh cookie and companion CSRF cookie on response
      if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken);
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        result.csrfToken = csrfToken;
        if (!env.EMIT_REFRESH_TOKEN_BODY) {
          delete result.refreshToken;
        }
      }

      // Return HTTP 200 response with newly issued access token
      return successResponse(res, 'Token refreshed successfully', result);
    // Catch block for invalid or expired refresh token
    } catch (err) {
      // Forward error to Express error-handling middleware
      next(err);
    // Terminate try-catch block
    }
  // Terminate refresh method definition
  }

  // Controller action to log out user and invalidate refresh session
  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.uap_refresh || req.body?.refreshToken;
      await authService.logout({
        refreshToken,
        userId: req.user?._id,
      });
      clearAuthCookies(res);
      return successResponse(res, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  // Controller action to log out user from all active devices
  async logoutAll(req, res, next) {
    try {
      await authService.logoutAll(req.user._id);
      clearAuthCookies(res);
      return successResponse(res, 'Logged out from all devices successfully');
    } catch (err) {
      next(err);
    }
  }
// Terminate AuthController class definition
}

// Export a singleton instance of AuthController for use across application routing
module.exports = new AuthController();
