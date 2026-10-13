// Import axios HTTP client library for executing network requests
import axios from 'axios';
// Import base URL constant configured for the platform backend API
import { API_BASE_URL } from '../utils/constants';
// Import browser storage helper for retrieving and updating access and refresh tokens
import { storage } from '../utils/storage';

// Instantiate pre-configured Axios client instance with standard base URL, JSON headers, and credentials enabled
const api = axios.create({
  // Backend API base path prefix (e.g. /api)
  baseURL: API_BASE_URL,
  // Enable cookies across credentialed requests
  withCredentials: true,
  // Default request headers
  headers: {
    // Specify JSON data format for HTTP request payloads
    'Content-Type': 'application/json',
  },
});

// BroadcastChannel for cross-tab in-memory access token synchronization
const authChannel = typeof window !== 'undefined' && window.BroadcastChannel
  ? new BroadcastChannel('uap_auth_sync')
  : null;

if (authChannel) {
  authChannel.onmessage = (event) => {
    if (event.data?.type === 'REFRESH_SUCCESS' && event.data.accessToken) {
      storage.setToken(event.data.accessToken);
      processQueue(null, event.data.accessToken);
    } else if (event.data?.type === 'LOGOUT') {
      storage.removeToken();
      processQueue(new Error('Session terminated in another tab'), null);
    }
  };
}

// Helper to read companion CSRF cookie
const getCsrfToken = () => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)uap_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

// Attach JWT token and CSRF token to outgoing requests
// Axios request interceptor injecting authorization Bearer header and CSRF token
api.interceptors.request.use(
  // Request fulfillment handler
  (config) => {
    // Retrieve active in-memory access token string
    const token = storage.getToken();
    // If token exists, attach to Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config._usedToken = token;
    }
    // Attach CSRF protection header for state-changing requests
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) {
        config.headers['X-CSRF-Token'] = csrf;
      }
    }
    // Return modified configuration to proceed with request
    return config;
  },
  // Request error handler
  (error) => Promise.reject(error)
);

// Concurrency lock flag tracking whether an access token refresh operation is actively underway
let isRefreshing = false;
// Queue storing unresolved request promises awaiting completion of the active token refresh
let failedQueue = [];

// Resolves or rejects all queued promises once a refresh attempt terminates
const processQueue = (error, token = null) => {
  // Iterate over each queued request promise handler
  failedQueue.forEach((prom) => {
    // If refresh failed, reject queued request with the refresh error
    if (error) {
      // Reject promise
      prom.reject(error);
    // Otherwise resolve with newly issued access token
    } else {
      // Resolve promise
      prom.resolve(token);
    }
  });
  // Clear the queue
  failedQueue = [];
};

// Response interceptor for centralized error handling, retry behavior, and token refresh
api.interceptors.response.use(
  // Unwrap Axios response envelope directly returning inner response.data payload to callers
  (response) => response.data,
  // Asynchronous response error interceptor managing retries, token renewals, and error normalization
  async (error) => {
    // Immediately reject canceled or aborted requests without retrying or refreshing
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    // Reference original request configuration object
    const originalRequest = error.config;

    // Retry once for idempotent GET requests on network failures or 502/503/504 gateway/service errors
    // Ensure cancelled/aborted requests, non-GET methods, and non-transient errors are NEVER retried
    if (
      // Request configuration is present
      originalRequest &&
      // Method is idempotent GET request
      originalRequest.method?.toLowerCase() === 'get' &&
      // Retry has not already been attempted for this request
      !originalRequest._retry &&
      // Abort signal has not been triggered
      !originalRequest.signal?.aborted &&
      // Network drop (no response) or server gateway error status code
      (!error.response ? (error.code !== 'ECONNABORTED' && !axios.isCancel(error)) : (error.response.status >= 502 && error.response.status <= 504))
    ) {
      // Mark request as retried
      originalRequest._retry = true;
      // Begin retry attempt
      try {
        // Re-execute original GET request
        const retryResult = await api(originalRequest);
        // Return successful retry response
        return retryResult;
      // Catch failure during retry attempt
      } catch (retryError) {
        // Reject with retry error
        return Promise.reject(retryError);
      }
    }

    // Handle HTTP 401 Unauthorized responses indicating token expiration or authentication rejection
    if (error.response?.status === 401) {
      // Check if the 401 error originated from an authentication-related endpoint
      const isAuthEndpoint =
        // Login credential endpoint
        originalRequest?.url?.includes('/auth/login') ||
        // Token refresh endpoint itself
        originalRequest?.url?.includes('/auth/refresh') ||
        // MFA TOTP verification endpoint
        originalRequest?.url?.includes('/auth/mfa/verify') ||
        // MFA backup recovery code verification endpoint
        originalRequest?.url?.includes('/auth/mfa/recovery') ||
        // User registration endpoint
        originalRequest?.url?.includes('/auth/register');

      // Attempt automatic token refresh only for protected resource routes that have not yet retried
      if (!isAuthEndpoint && originalRequest && !originalRequest._authRetry) {
        // Flag this request to prevent infinite retry loops
        originalRequest._authRetry = true;

        // If a refresh operation is already in flight, queue this request until refresh finishes
        if (isRefreshing) {
          // Return new Promise deferred until processQueue is triggered
          return new Promise((resolve, reject) => {
            // Push promise resolver and rejecter to queue
            failedQueue.push({ resolve, reject });
          })
            // When resolved with new token, update Authorization header and retry
            .then((newToken) => {
              // Update Authorization header
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              // Re-execute request
              return api(originalRequest);
            })
            // Forward rejection if refresh fails
            .catch((err) => Promise.reject(err));
        }

        // Lock refresh mutex
        isRefreshing = true;

        // Perform synchronized token refresh across browser tabs using Web Locks when available
        const performRefresh = async () => {
          // Check if another concurrent request or tab already refreshed the access token
          const existingToken = storage.getToken();
          if (existingToken && originalRequest._usedToken && existingToken !== originalRequest._usedToken) {
            return existingToken;
          }

          const legacyRefreshToken = storage.getRefreshToken();
          const csrf = getCsrfToken();
          const reqHeaders = { 'Content-Type': 'application/json' };
          if (csrf) {
            reqHeaders['X-CSRF-Token'] = csrf;
          }

          let refreshResponse;
          try {
            // Primary attempt: empty body with HttpOnly cookie
            refreshResponse = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              {},
              {
                headers: reqHeaders,
                withCredentials: true,
              }
            );
          } catch (firstErr) {
            // Dual-read drain fallback: if 401 and legacy refresh token exists in localStorage
            if (firstErr.response?.status === 401 && legacyRefreshToken) {
              refreshResponse = await axios.post(
                `${API_BASE_URL}/auth/refresh`,
                { refreshToken: legacyRefreshToken },
                {
                  headers: reqHeaders,
                  withCredentials: true,
                }
              );
            } else {
              throw firstErr;
            }
          }

          // Extract inner data payload from refresh response
          const refreshedData = refreshResponse.data?.data || refreshResponse.data;
          const newAccessToken = refreshedData.accessToken;

          if (!newAccessToken) {
            throw new Error('Refresh failed to return access token');
          }

          // Persist fresh access token strictly in frontend memory
          storage.setToken(newAccessToken);

          // Drain legacy refresh token from localStorage now that cookie is established
          if (legacyRefreshToken) {
            storage.removeRefreshToken();
          }

          // Broadcast fresh token to other tabs via BroadcastChannel
          if (authChannel) {
            authChannel.postMessage({ type: 'REFRESH_SUCCESS', accessToken: newAccessToken });
          }

          return newAccessToken;
        };

        const runSynchronized = async () => {
          if (typeof navigator !== 'undefined' && navigator.locks) {
            return await navigator.locks.request('uap_auth_refresh_lock', async () => {
              return await performRefresh();
            });
          }

          // Fallback lease coordination when Web Locks API is unavailable
          const leaseKey = 'uap_refresh_lease';
          const tabId = Math.random().toString(36).substring(2);
          const maxWait = 5000;
          const startTime = Date.now();

          while (Date.now() - startTime < maxWait) {
            let currentLease = null;
            try {
              const raw = localStorage.getItem(leaseKey);
              currentLease = raw ? JSON.parse(raw) : null;
            } catch {}

            const now = Date.now();
            if (!currentLease || currentLease.expiresAt < now) {
              try {
                localStorage.setItem(leaseKey, JSON.stringify({ tabId, expiresAt: now + 4000 }));
              } catch {}
              await new Promise((r) => setTimeout(r, 30));
              let verifyLease = null;
              try {
                const raw = localStorage.getItem(leaseKey);
                verifyLease = raw ? JSON.parse(raw) : null;
              } catch {}
              if (verifyLease && verifyLease.tabId === tabId) {
                try {
                  const token = await performRefresh();
                  return token;
                } finally {
                  try { localStorage.removeItem(leaseKey); } catch {}
                }
              }
            }

            const updatedToken = storage.getToken();
            if (updatedToken && originalRequest._usedToken && updatedToken !== originalRequest._usedToken) {
              return updatedToken;
            }
            await new Promise((r) => setTimeout(r, 100));
          }

          return await performRefresh();
        };

        try {
          const newAccessToken = await runSynchronized();

          // Unblock queued requests with the new access token
          processQueue(null, newAccessToken);
          // Update header on original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          // Re-execute original request and return its result
          return api(originalRequest);
        } catch (refreshErr) {
          // Reject all queued requests with the refresh error
          processQueue(refreshErr, null);
          // Purge invalid tokens from browser storage
          storage.removeToken();
          // Broadcast logout to peer tabs
          if (authChannel) {
            authChannel.postMessage({ type: 'LOGOUT' });
          }
          // Extract friendly error message
          const message =
            refreshErr.response?.data?.message ||
            refreshErr.message ||
            'Session expired. Please sign in again.';
          const customError = new Error(message);
          customError.status = 401;
          customError.response = refreshErr.response;
          return Promise.reject(customError);
        } finally {
          isRefreshing = false;
        }
      }

      // If auth endpoint or retry already attempted, clear storage
      const isChallengeUrl =
        originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/mfa/verify') ||
        originalRequest?.url?.includes('/auth/mfa/recovery');
      // If not a pending challenge URL, purge stored token
      if (!isChallengeUrl) {
        // Remove token from storage
        storage.removeToken();
      }
    }

    // Extract user-friendly error message from backend error envelope or standard error object
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    // Construct normalized Error instance
    const customError = new Error(message);
    // Attach HTTP status code
    customError.status = error.response?.status;
    // Attach field-level validation errors array if present
    customError.errors = error.response?.data?.errors;
    // Attach raw Axios response object
    customError.response = error.response;
    // Reject promise with normalized error
    return Promise.reject(customError);
  }
);

// Export pre-configured and interceptor-wrapped Axios API client
export default api;
