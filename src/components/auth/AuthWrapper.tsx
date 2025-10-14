/**
 * Auth Wrapper Component
 * Routes between setup, login, and main app based on auth state
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from 'react';
import { useAuth } from './AuthContext';
import { PasswordSetup } from './PasswordSetup';
import { LoginScreen } from './LoginScreen';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, isPasswordSet, isLoading } = useAuth();

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Initializing secure connection...</p>
        </div>
      </div>
    );
  }

  // Show password setup if password not set (first time)
  if (!isPasswordSet) {
    return <PasswordSetup />;
  }

  // Show login screen if password set but not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // User is authenticated, show main app
  return <>{children}</>;
};
