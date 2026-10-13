// Import React core library and React hooks for context creation, local state, and side effects
import { createContext, useState, useEffect } from 'react';
// Import browser storage helper for saving and retrieving access tokens, refresh tokens, and user objects
import { storage } from '../utils/storage';
// Import authentication service communicating with backend authentication endpoints
import { authService } from '../services/auth.service';

// React Context providing global user authentication state and session methods across the component tree
export const AuthContext = createContext(null);

// Context Provider component encapsulating authentication lifecycle, token persistence, and login flows
export const AuthProvider = ({ children }) => {
  // Initialize user profile state lazily from browser local storage
  const [user, setUser] = useState(() => storage.getUser());
  // Initialize JWT access token state lazily from browser local storage
  const [token, setToken] = useState(() => storage.getToken());
  // Loading flag tracking whether initial session re-hydration is actively in progress
  const [isLoading, setIsLoading] = useState(true);

  // Mount effect re-hydrating authentication session via silent cookie refresh on initial app load
  useEffect(() => {
    // Asynchronous bootstrap function validating session cookie against backend refresh endpoint
    const initializeAuth = async () => {
      try {
        // Check for legacy migration token in localStorage if cookie is not yet established
        const legacyRefreshToken = storage.getRefreshToken();
        const refreshPayload = legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {};
        // Attempt silent refresh via /auth/refresh with credentials
        const res = await authService.refreshToken(refreshPayload);
        const data = res?.data || res;
        if (data?.accessToken) {
          // Store access token in memory
          storage.setToken(data.accessToken);
          setToken(data.accessToken);
          // Set user profile if returned or fetch from profile endpoint
          if (data.user) {
            setUser(data.user);
            storage.setUser(data.user);
          } else {
            const profile = await authService.getProfile();
            setUser(profile);
            storage.setUser(profile);
          }
        } else {
          storage.removeToken();
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        // Unauthenticated or expired session on initial boot
        storage.removeToken();
        setUser(null);
        setToken(null);
      } finally {
        // Mark session re-hydration as complete to unblock protected routes
        setIsLoading(false);
      }
    };

    // Trigger auth initialization
    initializeAuth();
  }, []);

  // Executes standard password credential login against backend endpoint
  const login = async (credentials) => {
    // Set loading indicator
    setIsLoading(true);
    // Begin login request try block
    try {
      // Dispatch credentials payload to authService
      const data = await authService.login(credentials);
      // If the account has two-factor authentication enabled, return challenge payload without setting session
      if (data.mfaRequired) {
        // Return MFA challenge payload containing mfaToken and user metadata to navigate to MFA screen
        return data;
      }
      // Store short-lived access token strictly in frontend memory
      storage.setToken(data.accessToken);
      // Store user profile object in local storage
      storage.setUser(data.user);
      // Update access token state
      setToken(data.accessToken);
      // Update user profile state
      setUser(data.user);
      // Return authenticated user profile object
      return data.user;
    // Clear loading state regardless of success or failure
    } finally {
      // Reset loading flag
      setIsLoading(false);
    }
  };

  // Registers a new user account (student, instructor, or admin)
  const register = async (userData) => {
    // Set loading indicator
    setIsLoading(true);
    // Begin registration try block
    try {
      // Dispatch registration payload to backend
      const data = await authService.register(userData);
      // If account was automatically activated (e.g. verified student), establish session immediately
      if (data.accessToken && data.user) {
        // Store access token in memory
        storage.setToken(data.accessToken);
        // Persist user profile
        storage.setUser(data.user);
        // Set React token state
        setToken(data.accessToken);
        // Set React user state
        setUser(data.user);
      }
      // Return registration result (may indicate 'pending' admin review for instructors)
      return data;
    // Clear loading state
    } finally {
      // Reset loading flag
      setIsLoading(false);
    }
  };

  // Completes Google Single Sign-On authorization code exchange
  const loginWithGoogle = async (payload) => {
    // Set loading indicator
    setIsLoading(true);
    // Begin Google login try block
    try {
      // Exchange Google auth code and state parameter with backend
      const data = await authService.loginWithGoogle(payload);
      // If MFA is required on the linked Google account, return challenge payload
      if (data.mfaRequired) {
        // Return MFA challenge payload
        return data;
      }
      // If full credentials returned, persist session tokens
      if (data.accessToken && data.user) {
        // Store access token in memory
        storage.setToken(data.accessToken);
        // Persist user profile
        storage.setUser(data.user);
        // Set React token state
        setToken(data.accessToken);
        // Set React user state
        setUser(data.user);
      }
      // Return response payload
      return data;
    // Clear loading state
    } finally {
      // Reset loading flag
      setIsLoading(false);
    }
  };

  // Finalizes authentication session after successful TOTP or recovery code verification
  const completeMfaLogin = (authData) => {
    // Verify that full authentication credentials are present in payload
    if (authData.accessToken && authData.user) {
      // Persist verified access token in memory
      storage.setToken(authData.accessToken);
      // Persist user profile
      storage.setUser(authData.user);
      // Update React token state
      setToken(authData.accessToken);
      // Update React user state
      setUser(authData.user);
    }
    // Return verified user profile
    return authData.user;
  };

  // Refreshes cached user profile from backend (used after profile updates or enabling MFA)
  const refreshProfile = async () => {
    // Begin profile refresh try block
    try {
      // Fetch latest profile from backend API
      const profile = await authService.getProfile();
      // Update React user state
      setUser(profile);
      // Sync fresh profile to local storage
      storage.setUser(profile);
      // Return refreshed profile object
      return profile;
    // Catch any profile refresh network failures
    } catch (err) {
      // Log failure warning
      console.warn('Failed to refresh profile', err);
    }
  };

  // Logs out user by revoking server session, clearing persistent tokens, and resetting state
  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      // Remove access and refresh tokens from local storage
      storage.removeToken();
      // Clear access token state
      setToken(null);
      // Clear user profile state
      setUser(null);
    }
  };

  // Logs out user from all active sessions and devices globally
  const logoutAll = async () => {
    try {
      await authService.logoutAll();
    } catch {
      // Ignore network errors on logout
    } finally {
      // Remove access and refresh tokens from local storage
      storage.removeToken();
      // Clear access token state
      setToken(null);
      // Clear user profile state
      setUser(null);
    }
  };

  // Context value object exposing user attributes, authentication state, and session methods
  const value = {
    // Current user profile object
    user,
    // Current JWT access token string
    token,
    // Convenience property for user role ('student', 'instructor', 'admin')
    role: user?.role || null,
    // Boolean confirming active authenticated session
    isAuthenticated: !!token && !!user,
    // Loading flag for initial auth resolution
    isLoading,
    // Password login method
    login,
    // Registration method
    register,
    // Google SSO login method
    loginWithGoogle,
    // Second factor completion method
    completeMfaLogin,
    // Profile sync method
    refreshProfile,
    // Logout method
    logout,
    // Global logout from all devices
    logoutAll,
  };

  // Provide authentication context value to wrapped child components
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
