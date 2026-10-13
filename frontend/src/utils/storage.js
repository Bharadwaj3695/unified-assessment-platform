import { STORAGE_KEYS } from './constants';

// In-memory access token storage (short-lived access tokens are strictly kept in memory)
let inMemoryAccessToken = null;

export const storage = {
  // Returns in-memory access token
  getToken: () => {
    return inMemoryAccessToken;
  },

  // Updates short-lived access token strictly in frontend memory
  setToken: (token) => {
    inMemoryAccessToken = token || null;
    if (typeof window !== 'undefined') {
      window.__getUapAccessToken = () => inMemoryAccessToken;
    }
    // Clean up any legacy token that may still linger in localStorage from older versions
    try {
      if (localStorage.getItem(STORAGE_KEYS.TOKEN)) {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    } catch {}
  },

  // Reads legacy refresh token from localStorage during migration drain window
  getRefreshToken: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  },

  // Deprecated: No-op for new tokens to prevent storing refresh tokens in localStorage
  setRefreshToken: (token) => {
    if (token) {
      if (import.meta.env?.DEV) {
        console.warn('[Security] storage.setRefreshToken() is deprecated. Refresh tokens are secured in HttpOnly cookies.');
      }
    } else {
      // If null/falsy is passed, purge any legacy token
      try {
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      } catch {}
    }
  },

  // Explicit helper to purge legacy refresh token after migration
  removeRefreshToken: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {}
  },

  // Clears in-memory access token and persistent cached user data
  removeToken: () => {
    inMemoryAccessToken = null;
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (e) {
      console.error('Failed to clear tokens from storage', e);
    }
  },

  getUser: () => {
    try {
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user to localStorage', e);
    }
  },
  getTheme: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    } catch {
      return 'light';
    }
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.error('Failed to save theme to localStorage', e);
    }
  },
  getSidebarCollapsed: (role = 'admin') => {
    try {
      const key =
        role === 'admin'
          ? STORAGE_KEYS.ADMIN_SIDEBAR_COLLAPSED
          : role === 'student'
            ? STORAGE_KEYS.STUDENT_SIDEBAR_COLLAPSED
            : role === 'instructor'
              ? STORAGE_KEYS.INSTRUCTOR_SIDEBAR_COLLAPSED
              : `uap_${role}_sidebar_collapsed`;
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  },
  setSidebarCollapsed: (role = 'admin', collapsed) => {
    try {
      const key =
        role === 'admin'
          ? STORAGE_KEYS.ADMIN_SIDEBAR_COLLAPSED
          : role === 'student'
            ? STORAGE_KEYS.STUDENT_SIDEBAR_COLLAPSED
            : role === 'instructor'
              ? STORAGE_KEYS.INSTRUCTOR_SIDEBAR_COLLAPSED
              : `uap_${role}_sidebar_collapsed`;
      localStorage.setItem(key, String(collapsed));
    } catch (e) {
      console.error('Failed to save sidebar collapse state to localStorage', e);
    }
  },
  getAdminSidebarCollapsed: () => {
    return storage.getSidebarCollapsed('admin');
  },
  setAdminSidebarCollapsed: (collapsed) => {
    storage.setSidebarCollapsed('admin', collapsed);
  },
};
