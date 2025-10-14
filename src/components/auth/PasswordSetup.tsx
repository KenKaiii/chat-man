/**
 * Password Setup Component
 * First-time password setup for HIPAA/GDPR compliance
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

export const PasswordSetup: React.FC = () => {
  const { setupPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);

  // Password strength validation
  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 12) errors.push('At least 12 characters');
    if (!/[A-Z]/.test(pwd)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(pwd)) errors.push('One lowercase letter');
    if (!/\d/.test(pwd)) errors.push('One number');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) errors.push('One special character');
    return errors;
  };

  const passwordErrors = password ? validatePassword(password) : [];
  const isPasswordValid = passwordErrors.length === 0 && password.length >= 12;
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Password does not meet security requirements');
      return;
    }

    if (!doPasswordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!understood) {
      setError('Please confirm you understand the security notice');
      return;
    }

    setIsSubmitting(true);
    const result = await setupPassword(password);

    if (!result.success) {
      setError(result.error || 'Setup failed');
      setIsSubmitting(false);
    }
    // On success, AuthContext will update and app will re-render
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgb(var(--bg-primary))',
      padding: '1rem',
      overflow: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 className="text-gradient" style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.75rem',
            fontWeight: 'bold'
          }}>
            Chat Man
          </h1>
          <p style={{ color: 'rgb(var(--text-secondary))', fontSize: '0.8125rem', marginTop: '0.375rem' }}>
            Set up your secure password
          </p>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
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
                border: `1px solid ${password && !isPasswordValid ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '0.75rem',
                color: 'rgb(var(--text-primary))',
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
              placeholder="Master Password"
              disabled={isSubmitting}
              autoFocus
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
                cursor: 'pointer',
                color: 'rgb(var(--text-secondary))',
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem',
                opacity: 0.6,
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              {showPassword ? <EyeOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Eye style={{ width: '1.125rem', height: '1.125rem' }} />}
            </button>
          </div>

          {/* Password Requirements - Collapsible */}
          {password && (
            <div style={{
              fontSize: '0.6875rem',
              color: 'rgb(var(--text-secondary))',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingLeft: '0.25rem'
            }}>
              {[
                { label: '12+ chars', valid: password.length >= 12 },
                { label: 'A-Z', valid: /[A-Z]/.test(password) },
                { label: 'a-z', valid: /[a-z]/.test(password) },
                { label: '0-9', valid: /\d/.test(password) },
                { label: '!@#$', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
              ].map((req, i) => (
                <span key={i} style={{
                  color: req.valid ? '#4ade80' : 'rgb(var(--text-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <span>{req.valid ? '✓' : '○'}</span>
                  {req.label}
                </span>
              ))}
            </div>
          )}

          {/* Confirm Password Input */}
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem 3rem 0.875rem 1rem',
                backgroundColor: 'rgb(var(--bg-input))',
                border: `1px solid ${confirmPassword && !doPasswordsMatch ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '0.75rem',
                color: 'rgb(var(--text-primary))',
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
              placeholder="Confirm Password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position: 'absolute',
                right: '0.875rem',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgb(var(--text-secondary))',
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem',
                opacity: 0.6,
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              {showConfirm ? <EyeOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Eye style={{ width: '1.125rem', height: '1.125rem' }} />}
            </button>
          </div>

          {/* Confirmation Checkbox - Compact */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: 'rgb(var(--text-secondary))',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            paddingLeft: '0.25rem'
          }}>
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              style={{
                width: '0.875rem',
                height: '0.875rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                flexShrink: 0
              }}
              disabled={isSubmitting}
            />
            <span>I understand data cannot be recovered if password is lost</span>
          </label>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '0.625rem 0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: '#f87171'
            }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={isSubmitting || !isPasswordValid || !doPasswordsMatch || !understood ? 'send-button' : 'send-button-active'}
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: isSubmitting || !isPasswordValid || !doPasswordsMatch || !understood ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            disabled={isSubmitting || !isPasswordValid || !doPasswordsMatch || !understood}
          >
            {isSubmitting ? 'Setting up...' : 'Set Password'}
          </button>
        </form>

        {/* Security Notice - Compact & Collapsible */}
        <button
          type="button"
          onClick={() => setShowRequirements(!showRequirements)}
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '0.5rem',
            padding: '0.625rem 0.75rem',
            fontSize: '0.75rem',
            color: '#FCD34D',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s'
          }}
        >
          <AlertTriangle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {showRequirements ? 'Hide security notice' : 'Password encrypts all data • Cannot be recovered if lost'}
          </span>
        </button>

        {showRequirements && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            fontSize: '0.75rem',
            color: '#FCD34D',
            marginTop: '-0.75rem'
          }}>
            <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Use a password manager (1Password, Bitwarden)</li>
              <li>This app is HIPAA/GDPR compliant</li>
              <li>Data is encrypted end-to-end</li>
            </ul>
          </div>
        )}

        {/* Footer - Compact */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.6875rem',
          color: 'rgb(var(--text-secondary))',
          opacity: 0.4
        }}>
          HIPAA & GDPR Compliant
        </p>
      </div>
    </div>
  );
};
