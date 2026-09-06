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

// Response interceptor for centralized error handling and retry behavior
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
      // Don't loop if login endpoint fails
      if (!error.config?.url?.includes('/auth/login')) {
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
