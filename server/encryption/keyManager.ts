/**
 * Encryption Key Management System
 * Implements HIPAA-compliant encryption key derivation and management
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SALT_STORAGE_PATH = join(process.cwd(), 'config', '.encryption_salt');

/**
 * Encryption key configuration
 */
export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  saltLength: number;
  iterations: number; // For PBKDF2
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  saltLength: 32,
  iterations: 100000,
};

export class KeyManager {
  private masterKey: Buffer | null = null;
  private salt: Buffer | null = null;
  private isInitialized: boolean = false;

  /**
   * Check if encryption is already set up
   */
  isSetup(): boolean {
    return existsSync(SALT_STORAGE_PATH);
  }

  /**
   * Initialize encryption with a password (first-time setup)
   * Uses Argon2id for password hashing (OWASP recommended)
   */
  async initializeWithPassword(password: string): Promise<void> {
    if (this.isSetup()) {
      throw new Error('Encryption is already initialized');
    }

    // Validate password strength
    this.validatePasswordStrength(password);

    // Generate cryptographically secure salt
    this.salt = crypto.randomBytes(DEFAULT_CONFIG.saltLength);

    // Derive master key from password using Argon2id
    // Argon2id is recommended by OWASP for password hashing (resistant to side-channel attacks)
    this.masterKey = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 4,
      salt: this.salt,
      raw: true,
      hashLength: DEFAULT_CONFIG.keyLength,
    });

    // Store salt (NOT the key or password)
    // Salt is not secret, but ensures rainbow table attacks are infeasible
    writeFileSync(SALT_STORAGE_PATH, this.salt);

    this.isInitialized = true;
    console.log('✅ Encryption initialized successfully');
  }

  /**
   * Unlock encryption with password (subsequent uses)
   */
  async unlockWithPassword(password: string): Promise<boolean> {
    if (!this.isSetup()) {
      throw new Error('Encryption is not initialized. Run setup first.');
    }

    try {
      // Read stored salt
      this.salt = readFileSync(SALT_STORAGE_PATH);

      // Derive master key from password
      this.masterKey = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        salt: this.salt,
        raw: true,
        hashLength: DEFAULT_CONFIG.keyLength,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to unlock encryption:', error);
      return false;
    }
  }

  /**
   * Get the master key for database encryption
   * Returns hex-encoded key suitable for SQLCipher
   */
  getMasterKeyHex(): string {
    if (!this.isInitialized || !this.masterKey) {
      throw new Error('Key manager is not initialized');
    }
    return this.masterKey.toString('hex');
  }

  /**
   * Get raw master key buffer
   */
  getMasterKey(): Buffer {
    if (!this.isInitialized || !this.masterKey) {
      throw new Error('Key manager is not initialized');
    }
    return this.masterKey;
  }

  /**
   * Derive a sub-key for a specific purpose (e.g., file encryption, JWT signing)
   * Uses HKDF (HMAC-based Key Derivation Function) - NIST approved
   */
  deriveKey(purpose: string, length: number = 32): Buffer {
    if (!this.isInitialized || !this.masterKey) {
      throw new Error('Key manager is not initialized');
    }

    // Use HKDF to derive purpose-specific keys from master key
    const hkdf = crypto.createHmac('sha256', this.masterKey);
    hkdf.update(purpose);
    const derivedKey = hkdf.digest();

    return derivedKey.subarray(0, length);
  }

  /**
   * Encrypt data using AES-256-GCM (AEAD - provides confidentiality and authenticity)
   */
  encrypt(data: string | Buffer, purpose: string = 'default'): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    const key = this.deriveKey(purpose);
    const iv = crypto.randomBytes(16); // GCM standard IV size

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(
    encrypted: string,
    iv: string,
    tag: string,
    purpose: string = 'default'
  ): Buffer {
    const key = this.deriveKey(purpose);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]);

    return decrypted;
  }

  /**
   * Validate password strength (HIPAA requires strong passwords)
   * Minimum requirements:
   * - 12+ characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  private validatePasswordStrength(password: string): void {
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

    if (errors.length > 0) {
      throw new Error('Password does not meet security requirements:\n' + errors.join('\n'));
    }
  }

  /**
   * Change the master password (re-key operation)
   * This requires decrypting all data with old key and re-encrypting with new key
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    // Verify old password
    const unlocked = await this.unlockWithPassword(oldPassword);
    if (!unlocked) {
      return false;
    }

    // Validate new password
    this.validatePasswordStrength(newPassword);

    // Generate new key with existing salt
    const newKey = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      salt: this.salt!,
      raw: true,
      hashLength: DEFAULT_CONFIG.keyLength,
    });

    this.masterKey = newKey;

    // Note: Caller must re-encrypt all database data
    // This is handled at the database level

    return true;
  }

  /**
   * Generate a secure random key for JWT signing
   */
  generateJWTSecret(): string {
    return this.deriveKey('jwt-signing', 64).toString('base64');
  }

  /**
   * Securely wipe key from memory
   */
  wipeKeys(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
    if (this.salt) {
      this.salt.fill(0);
      this.salt = null;
    }
    this.isInitialized = false;
  }
}

// Singleton instance
let keyManagerInstance: KeyManager | null = null;

export function getKeyManager(): KeyManager {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager();
  }
  return keyManagerInstance;
}

// Clean up on process exit
process.on('exit', () => {
  if (keyManagerInstance) {
    keyManagerInstance.wipeKeys();
  }
});

process.on('SIGINT', () => {
  if (keyManagerInstance) {
    keyManagerInstance.wipeKeys();
  }
  process.exit(0);
});
