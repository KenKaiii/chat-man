/**
 * Login Screen Component
 * Secure login with JWT authentication
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    const result = await login(password);

    if (!result.success) {
      setError(result.error || 'Login failed');
      setAttempts(prev => prev + 1);
      setIsSubmitting(false);
      setPassword(''); // Clear password on failed attempt
    }
    // On success, AuthContext will update and app will re-render
  };

  const isRateLimited = attempts >= 5;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgb(var(--bg-primary))',
      padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 className="text-gradient" style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            fontWeight: 'bold'
          }}>
            Chat Man
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Password Input */}
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem 3rem 0.875rem 1rem',
                backgroundColor: 'rgb(var(--bg-input))',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.75rem',
                color: 'rgb(var(--text-primary))',
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
              placeholder="Password"
              disabled={isSubmitting || isRateLimited}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.875rem',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: isSubmitting || isRateLimited ? 'not-allowed' : 'pointer',
                color: 'rgb(var(--text-secondary))',
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem',
                opacity: 0.6,
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
              disabled={isSubmitting || isRateLimited}
            >
              {showPassword ? <EyeOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Eye style={{ width: '1.125rem', height: '1.125rem' }} />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: '#f87171'
            }}>
              {error}
              {attempts > 0 && attempts < 5 && (
                <div style={{ marginTop: '0.25rem', opacity: 0.7, fontSize: '0.75rem' }}>
                  Attempt {attempts} of 5
                </div>
              )}
            </div>
          )}

          {/* Rate Limit Warning */}
          {isRateLimited && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: '#FCD34D'
            }}>
              Too many attempts. Please wait 15 minutes.
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={isSubmitting || !password.trim() || isRateLimited ? 'send-button' : 'send-button-active'}
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: isSubmitting || !password.trim() || isRateLimited ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            disabled={isSubmitting || !password.trim() || isRateLimited}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'rgb(var(--text-secondary))',
          opacity: 0.5
        }}>
          Secured with Argon2id & JWT
        </p>
      </div>
    </div>
  );
};
