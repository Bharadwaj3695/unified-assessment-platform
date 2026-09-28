import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor for centralized error handling, retry behavior, and token refresh
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Retry once for idempotent GET requests on network failures or 502/503/504 gateway/service errors
    if (
      originalRequest &&
      originalRequest.method?.toLowerCase() === 'get' &&
      !originalRequest._retry &&
      (!error.response || (error.response.status >= 502 && error.response.status <= 504))
    ) {
      originalRequest._retry = true;
      try {
        const retryResult = await api(originalRequest);
        return retryResult;
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }

    if (error.response?.status === 401) {
      const isAuthEndpoint =
        originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/refresh') ||
        originalRequest?.url?.includes('/auth/mfa/verify') ||
        originalRequest?.url?.includes('/auth/mfa/recovery') ||
        originalRequest?.url?.includes('/auth/register');

      if (!isAuthEndpoint && originalRequest && !originalRequest._authRetry) {
        const refreshToken = storage.getRefreshToken();
        if (!refreshToken) {
          storage.removeToken();
          const message = error.response?.data?.message || error.message || 'Session expired. Please sign in again.';
          const customError = new Error(message);
          customError.status = 401;
          customError.response = error.response;
          return Promise.reject(customError);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._authRetry = true;
        isRefreshing = true;

        try {
          const refreshResponse = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const refreshedData = refreshResponse.data?.data || refreshResponse.data;
          const newAccessToken = refreshedData.accessToken;
          const newRefreshToken = refreshedData.refreshToken;

          if (!newAccessToken) {
            throw new Error('Refresh failed to return access token');
          }

          storage.setToken(newAccessToken);
          if (newRefreshToken) {
            storage.setRefreshToken(newRefreshToken);
          }

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          storage.removeToken();
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
      if (!isChallengeUrl) {
        storage.removeToken();
      }
    }

    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const customError = new Error(message);
    customError.status = error.response?.status;
    customError.errors = error.response?.data?.errors;
    customError.response = error.response;
    return Promise.reject(customError);
  }
);

export default api;
