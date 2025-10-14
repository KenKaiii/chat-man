/**
 * Authentication Context Provider
 * Manages authentication state and JWT tokens
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isPasswordSet: boolean;
  isLoading: boolean;
  token: string | null;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  setupPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);

      // Check if password is set
      const statusResponse = await fetch('http://localhost:3001/api/auth/status');
      const statusData = await statusResponse.json();
      setIsPasswordSet(statusData.isSetup);

      // Check if we have a valid token in localStorage
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken && statusData.isSetup) {
        // Validate the token with the backend
        try {
          const validateResponse = await fetch('http://localhost:3001/api/auth/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: storedToken }),
          });

          const validateData = await validateResponse.json();

          if (validateData.valid) {
            // Token is valid, use it
            setToken(storedToken);
            setIsAuthenticated(true);
          } else {
            // Token is invalid, clear it and require login
            console.warn('Stored token is invalid:', validateData.error);
            localStorage.removeItem('auth_token');
            setToken(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          // Validation failed, clear token
          console.error('Token validation failed:', error);
          localStorage.removeItem('auth_token');
          setToken(null);
          setIsAuthenticated(false);
        }
      } else if (!statusData.isSetup) {
        // Password not set, no auth required yet
        setIsAuthenticated(false);
      } else {
        // No stored token
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const setupPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
        setIsPasswordSet(true);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Setup failed' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed'
      };
    }
  };

  const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isPasswordSet,
        isLoading,
        token,
        login,
        setupPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
