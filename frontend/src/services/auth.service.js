import api from './api';

export const authService = {
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getProfile: async () => {
    const res = await api.get('/auth/profile');
    return res.data;
  },
  updateProfile: async (profileData) => {
    const res = await api.put('/users/profile', profileData);
    return res.data;
  },
  uploadAvatar: async (formData) => {
    const res = await api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  checkHealth: async () => {
    const res = await api.get('/health');
    return res;
  },
  getGoogleAuthUrl: async () => {
    const res = await api.get('/auth/google/url');
    return res.data;
  },
  loginWithGoogle: async (payload) => {
    const res = await api.post('/auth/google', payload);
    return res.data;
  },
  setupMfa: async () => {
    const res = await api.post('/auth/mfa/setup');
    return res.data;
  },
  setupConfirmMfa: async (code) => {
    const res = await api.post('/auth/mfa/setup-confirm', { code });
    return res.data;
  },
  verifyMfa: async ({ mfaToken, code }) => {
    const res = await api.post('/auth/mfa/verify', { mfaToken, code });
    return res.data;
  },
  recoveryMfa: async ({ mfaToken, recoveryCode }) => {
    const res = await api.post('/auth/mfa/recovery', { mfaToken, recoveryCode });
    return res.data;
  },
  disableMfa: async ({ password, code }) => {
    const res = await api.post('/auth/mfa/disable', { password, code });
    return res.data || res;
  },
  regenerateRecoveryCodes: async ({ password, code }) => {
    const res = await api.post('/auth/mfa/regenerate-recovery-codes', { password, code });
    return res.data;
  },
  refresh: async (refreshToken) => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data;
  },
};
