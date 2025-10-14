/**
 * Password Management System
 * Handles user authentication with Argon2
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as argon2 from 'argon2';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/secureLogger';

const AUTH_CONFIG_PATH = join(process.cwd(), 'config', '.auth');

interface AuthConfig {
  passwordHash: string;
  createdAt: string;
  lastChanged: string;
}

export class PasswordManager {
  /**
   * Check if password is set up
   */
  isPasswordSet(): boolean {
    return existsSync(AUTH_CONFIG_PATH);
  }

  /**
   * Set initial password (first-time setup)
   */
  async setPassword(password: string): Promise<void> {
    if (this.isPasswordSet()) {
      throw new Error('Password already set. Use changePassword instead.');
    }

    // Validate password strength
    this.validatePassword(password);

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 4,
    });

    const config: AuthConfig = {
      passwordHash,
      createdAt: new Date().toISOString(),
      lastChanged: new Date().toISOString(),
    };

    // Store auth config
    writeFileSync(AUTH_CONFIG_PATH, JSON.stringify(config, null, 2));

    logger.info('Password set successfully');
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string): Promise<boolean> {
    if (!this.isPasswordSet()) {
      throw new Error('Password not set. Run setup first.');
    }

    try {
      const configStr = readFileSync(AUTH_CONFIG_PATH, 'utf-8');
      const config: AuthConfig = JSON.parse(configStr);

      const isValid = await argon2.verify(config.passwordHash, password);

      if (isValid) {
        logger.info('Password verified successfully');
      } else {
        logger.warn('Failed password verification attempt');
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying password', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  /**
   * Change password (requires old password)
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (!this.isPasswordSet()) {
      throw new Error('Password not set. Run setup first.');
    }

    // Verify old password
    const isOldPasswordValid = await this.verifyPassword(oldPassword);
    if (!isOldPasswordValid) {
      logger.warn('Failed password change attempt - incorrect old password');
      return false;
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const configStr = readFileSync(AUTH_CONFIG_PATH, 'utf-8');
    const config: AuthConfig = JSON.parse(configStr);

    config.passwordHash = passwordHash;
    config.lastChanged = new Date().toISOString();

    writeFileSync(AUTH_CONFIG_PATH, JSON.stringify(config, null, 2));

    logger.info('Password changed successfully');
    return true;
  }

  /**
   * Get password metadata (without exposing hash)
   */
  getPasswordInfo(): { createdAt: string; lastChanged: string } | null {
    if (!this.isPasswordSet()) {
      return null;
    }

    try {
      const configStr = readFileSync(AUTH_CONFIG_PATH, 'utf-8');
      const config: AuthConfig = JSON.parse(configStr);

      return {
        createdAt: config.createdAt,
        lastChanged: config.lastChanged,
      };
    } catch (error) {
      logger.error('Error reading password info', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Validate password strength (HIPAA requirements)
   */
  private validatePassword(password: string): void {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

    const errors: string[] = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password',
      '123456',
      'qwerty',
      'admin',
      'letmein',
      'welcome',
      'monkey',
    ];

    if (weakPasswords.some((weak) => password.toLowerCase().includes(weak))) {
      errors.push('Password contains common weak patterns');
    }

    if (errors.length > 0) {
      throw new Error(
        'Password does not meet security requirements:\n' + errors.join('\n')
      );
    }
  }

  /**
   * Reset password (DANGEROUS - requires manual file deletion)
   */
  resetPassword(): void {
    if (!this.isPasswordSet()) {
      logger.warn('Attempted to reset non-existent password');
      return;
    }

    logger.warn('Password reset requested - manual intervention required');
    throw new Error(
      'Password reset requires manual deletion of config/.auth file. This is intentional for security.'
    );
  }
}

// Singleton instance
let passwordManagerInstance: PasswordManager | null = null;

export function getPasswordManager(): PasswordManager {
  if (!passwordManagerInstance) {
    passwordManagerInstance = new PasswordManager();
  }
  return passwordManagerInstance;
}
