// Import the preconfigured Axios HTTP client instance with base URLs and interceptors
import api from './api';

// Export an object containing authentication, profile, and MFA service methods
export const authService = {
  // Method to authenticate an existing user using their email/password credentials
  login: async (credentials) => {
    // Send an asynchronous HTTP POST request to the login endpoint with the user's credentials
    const res = await api.post('/auth/login', credentials);
    // Return the response payload containing authentication tokens and user information
    return res.data;
  // Conclude the login method definition
  },
  // Method to register a new user account with provided registration information
  register: async (userData) => {
    // Send an asynchronous HTTP POST request to the user registration endpoint with account details
    const res = await api.post('/auth/register', userData);
    // Return the response data containing creation status, tokens, or pending review state
    return res.data;
  // Conclude the register method definition
  },
  // Method to retrieve the currently authenticated user's account profile
  getProfile: async () => {
    // Send an asynchronous HTTP GET request to the profile endpoint using authorization header
    const res = await api.get('/auth/profile');
    // Return the profile payload including user attributes and assigned role
    return res.data;
  // Conclude the getProfile method definition
  },
  // Method to update existing profile attributes such as display name or bio
  updateProfile: async (profileData) => {
    // Send an asynchronous HTTP PUT request with the updated profile fields to the backend
    const res = await api.put('/users/profile', profileData);
    // Return the updated user profile object returned by the server
    return res.data;
  // Conclude the updateProfile method definition
  },
  // Method to upload a new profile picture or avatar image
  uploadAvatar: async (formData) => {
    // Send an asynchronous HTTP POST request sending multipart form-data to the avatar endpoint
    const res = await api.post('/users/avatar', formData, {
      // Configure request headers to notify the server of multipart/form-data encoding
      headers: { 'Content-Type': 'multipart/form-data' },
    // Conclude headers configuration and request options
    });
    // Return the updated avatar URL and user profile metadata
    return res.data;
  // Conclude the uploadAvatar method definition
  },
  // Method to remove the authenticated user's profile picture or avatar image
  deleteAvatar: async () => {
    // Send an asynchronous HTTP DELETE request to the avatar endpoint
    const res = await api.delete('/users/avatar');
    // Return the response data confirming avatar removal
    return res.data;
  // Conclude the deleteAvatar method definition
  },
  // Method to refresh session tokens via cookie or legacy fallback
  refreshToken: async (payload = {}) => {
    const res = await api.post('/auth/refresh', payload);
    return res;
  },
  // Method to log out current session and invalidate server refresh cookie
  logout: async () => {
    try {
      const res = await api.post('/auth/logout');
      return res.data;
    } catch {
      return null;
    }
  },
  // Method to log out from all devices globally
  logoutAll: async () => {
    const res = await api.post('/auth/logout-all');
    return res.data;
  },
  // Method to verify backend server availability and health status
  checkHealth: async () => {
    // Send an asynchronous HTTP GET request to the public service health check endpoint
    const res = await api.get('/health');
    // Return the full HTTP response object indicating connectivity status
    return res;
  // Conclude the checkHealth method definition
  },
  // Method to retrieve the Google OAuth authorization URL for third-party sign-in
  getGoogleAuthUrl: async () => {
    // Send an asynchronous HTTP GET request to fetch the prepared Google OAuth initiation endpoint
    const res = await api.get('/auth/google/url');
    // Return the response data containing the OAuth consent screen URL
    return res.data;
  // Conclude the getGoogleAuthUrl method definition
  },
  // Method to complete Google OAuth sign-in by forwarding authorization code or tokens
  loginWithGoogle: async (payload) => {
    // Send an asynchronous HTTP POST request with the OAuth authorization payload
    const res = await api.post('/auth/google', payload);
    // Return the authentication tokens and profile session data
    return res.data;
  // Conclude the loginWithGoogle method definition
  },
  // Method to initialize two-factor authentication setup and retrieve QR secret
  setupMfa: async () => {
    // Send an asynchronous HTTP POST request to generate an TOTP MFA registration secret
    const res = await api.post('/auth/mfa/setup');
    // Return the secret key and QR code data URL for authenticator app enrollment
    return res.data;
  // Conclude the setupMfa method definition
  },
  // Method to confirm and activate MFA by validating the initial TOTP code
  setupConfirmMfa: async (code) => {
    // Send an asynchronous HTTP POST request with the user's verification code
    const res = await api.post('/auth/mfa/setup-confirm', { code });
    // Return the server response confirming MFA activation and providing recovery codes
    return res.data;
  // Conclude the setupConfirmMfa method definition
  },
  // Method to verify TOTP code during a multi-factor authentication login challenge
  verifyMfa: async ({ mfaToken, code }) => {
    // Send an asynchronous HTTP POST request with temporary MFA token and user-entered TOTP code
    const res = await api.post('/auth/mfa/verify', { mfaToken, code });
    // Return the complete authenticated session tokens and profile
    return res.data;
  // Conclude the verifyMfa method definition
  },
  // Method to verify an account using an emergency MFA recovery code
  recoveryMfa: async ({ mfaToken, recoveryCode }) => {
    // Send an asynchronous HTTP POST request with the session token and backup recovery code
    const res = await api.post('/auth/mfa/recovery', { mfaToken, recoveryCode });
    // Return authenticated session tokens upon valid recovery code verification
    return res.data;
  // Conclude the recoveryMfa method definition
  },
  // Method to request a 6-digit email OTP during MFA verification
  sendMfaEmailOtp: async ({ mfaToken }) => {
    // Send an asynchronous HTTP POST request to dispatch email OTP
    const res = await api.post('/auth/mfa/email-otp/send', { mfaToken });
    // Return response containing masked email and expiration metadata
    return res.data;
  // Conclude the sendMfaEmailOtp method definition
  },
  // Method to verify a 6-digit email OTP during MFA verification
  verifyMfaEmailOtp: async ({ mfaToken, code }) => {
    // Send an asynchronous HTTP POST request with temporary challenge token and email OTP code
    const res = await api.post('/auth/mfa/email-otp/verify', { mfaToken, code });
    // Return authenticated session tokens upon valid email code verification
    return res.data;
  // Conclude the verifyMfaEmailOtp method definition
  },
  // Method to initiate Email OTP setup and dispatch code to registered email
  setupEmailOtp: async ({ password, code } = {}) => {
    const res = await api.post('/auth/mfa/email-otp/setup', { password, code });
    return res.data?.data || res.data;
  },
  // Method to confirm Email OTP setup using valid 6-digit code
  setupConfirmEmailOtp: async (code) => {
    const res = await api.post('/auth/mfa/email-otp/setup-confirm', { code });
    return res.data?.data || res.data;
  },
  // Method to disable Email OTP independently
  disableEmailOtp: async ({ password, code } = {}) => {
    const res = await api.post('/auth/mfa/email-otp/disable', { password, code });
    return res.data?.data || res.data;
  },
  // Method to dispatch a test verification code to the registered email
  sendEmailOtpTest: async () => {
    const res = await api.post('/auth/mfa/email-otp/send-test');
    return res.data?.data || res.data;
  },
  // Method to disable two-factor authentication with password and TOTP confirmation
  disableMfa: async ({ password, code }) => {
    // Send an asynchronous HTTP POST request with current password and MFA code to disable TOTP
    const res = await api.post('/auth/mfa/disable', { password, code });
    // Return the response data or fallback response object confirming deactivation
    return res.data || res;
  // Conclude the disableMfa method definition
  },
  // Method to generate new backup emergency recovery codes for MFA
  regenerateRecoveryCodes: async ({ password, code }) => {
    // Send an asynchronous HTTP POST request confirming credentials to issue new recovery codes
    const res = await api.post('/auth/mfa/regenerate-recovery-codes', { password, code });
    // Return the fresh set of one-time backup recovery codes
    return res.data;
  // Conclude the regenerateRecoveryCodes method definition
  },
  // Method to renew an expired access token using a valid refresh token
  refresh: async (refreshToken) => {
    // Send an asynchronous HTTP POST request with the refresh token payload
    const res = await api.post('/auth/refresh', { refreshToken });
    // Return the newly issued access and refresh authentication tokens
    return res.data;
  // Conclude the refresh method definition
  },
  // Method to request a password reset email link for a given account email address
  forgotPassword: async (email) => {
    // Send an asynchronous HTTP POST request to initiate the password recovery workflow
    const res = await api.post('/auth/forgot-password', { email });
    // Return the response payload or raw response acknowledging the email dispatch
    return res.data || res;
  // Conclude the forgotPassword method definition
  },
  // Method to set a new password using a verified recovery token
  resetPassword: async ({ token, password, confirmPassword }) => {
    // Send an asynchronous HTTP POST request with token and new password confirmation
    const res = await api.post('/auth/reset-password', { token, password, confirmPassword });
    // Return the response payload or raw response confirming password change
    return res.data || res;
  // Conclude the resetPassword method definition
  },
// Conclude the authService object definition
};
