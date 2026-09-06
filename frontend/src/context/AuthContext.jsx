import React, { createContext, useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { authService } from '../services/auth.service';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => storage.getUser());
  const [token, setToken] = useState(() => storage.getToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = storage.getToken();
      if (storedToken) {
        try {
          const profile = await authService.getProfile();
          setUser(profile);
          storage.setUser(profile);
        } catch (err) {
          console.warn('Session expired or invalid, logging out', err);
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const data = await authService.login(credentials);
      storage.setToken(data.accessToken);
      storage.setUser(data.user);
      setToken(data.accessToken);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const data = await authService.register(userData);
      if (data.accessToken && data.user) {
        storage.setToken(data.accessToken);
        storage.setUser(data.user);
        setToken(data.accessToken);
        setUser(data.user);
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    storage.removeToken();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
