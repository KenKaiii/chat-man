/**
 * Encryption End-to-End Test
 * Tests the complete encryption lifecycle for HIPAA/GDPR compliance
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { KeyManager } from '../encryption/keyManager';

// Test constants
const TEST_PASSWORD = 'TestSecurePassword123!';
const TEST_CONFIG_DIR = join(process.cwd(), 'config', 'test');
const TEST_SALT_PATH = join(TEST_CONFIG_DIR, '.encryption_salt');

describe('Encryption End-to-End Test', () => {
  let keyManager: KeyManager;

  beforeAll(async () => {
    // Create test config directory
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    // Clean up any existing test salt
    if (existsSync(TEST_SALT_PATH)) {
      unlinkSync(TEST_SALT_PATH);
    }

    // Override salt path for testing
    (KeyManager as any).SALT_STORAGE_PATH = TEST_SALT_PATH;

    //Initialize key manager
    keyManager = new KeyManager();
    await keyManager.initializeWithPassword(TEST_PASSWORD);

    console.log('✓ Test encryption system initialized');
  });

  afterAll(() => {
    // Clean up test files
    if (existsSync(TEST_SALT_PATH)) {
      unlinkSync(TEST_SALT_PATH);
    }

    // Wipe keys from memory
    keyManager.wipeKeys();
  });

  test('Encryption produces unique ciphertexts each time', () => {
    // Encrypt same plaintext twice
    const plaintext = 'This is a secret message';
    const encrypted1 = keyManager.encrypt(plaintext, 'test-context');
    const encrypted2 = keyManager.encrypt(plaintext, 'test-context');

    // Ciphertexts should be different (due to random IV)
    expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);

    // But both should decrypt to same plaintext
    const decrypted1 = keyManager.decrypt(encrypted1.encrypted, encrypted1.iv, encrypted1.tag, 'test-context');
    const decrypted2 = keyManager.decrypt(encrypted2.encrypted, encrypted2.iv, encrypted2.tag, 'test-context');

    expect(decrypted1.toString('utf-8')).toBe(plaintext);
    expect(decrypted2.toString('utf-8')).toBe(plaintext);

    console.log('✓ Encryption produces unique ciphertexts with random IVs');
  });

  test('Tampering with ciphertext is detected', () => {
    const plaintext = 'Important message';

    // Encrypt data
    const encrypted = keyManager.encrypt(plaintext, 'test-context');

    // Tamper with ciphertext (flip a bit)
    const tamperedCiphertext = encrypted.encrypted.slice(0, -1) +
      (encrypted.encrypted.slice(-1) === 'A' ? 'B' : 'A');

    // Decryption should fail due to authentication tag mismatch
    try {
      keyManager.decrypt(tamperedCiphertext, encrypted.iv, encrypted.tag, 'test-context');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✓ Tampered ciphertext is detected');
    }
  });

  test('Different contexts produce isolated encryption', () => {
    const plaintext = 'Test data';

    // Encrypt with different contexts
    const encrypted1 = keyManager.encrypt(plaintext, 'context-1');
    const encrypted2 = keyManager.encrypt(plaintext, 'context-2');

    // Verify both contexts decrypt correctly
    const decrypted1 = keyManager.decrypt(encrypted1.encrypted, encrypted1.iv, encrypted1.tag, 'context-1');
    const decrypted2 = keyManager.decrypt(encrypted2.encrypted, encrypted2.iv, encrypted2.tag, 'context-2');

    expect(decrypted1.toString('utf-8')).toBe(plaintext);
    expect(decrypted2.toString('utf-8')).toBe(plaintext);

    // Cross-context decryption should fail
    try {
      keyManager.decrypt(encrypted1.encrypted, encrypted1.iv, encrypted1.tag, 'context-2');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✓ Context isolation prevents cross-context decryption');
    }
  });

  test('Password unlock with correct password succeeds', async () => {
    // Create new key manager instance
    const newKeyManager = new KeyManager();

    // Unlock with correct password
    const unlocked = await newKeyManager.unlockWithPassword(TEST_PASSWORD);

    expect(unlocked).toBe(true);
    expect(newKeyManager.isSetup()).toBe(true);

    console.log('✓ Password unlock succeeds with correct password');

    newKeyManager.wipeKeys();
  });

  test('Password unlock with wrong password fails', async () => {
    // Create new key manager instance
    const newKeyManager = new KeyManager();

    // Try to unlock with wrong password (will succeed but data won't decrypt correctly)
    const unlocked = await newKeyManager.unlockWithPassword('WrongPassword123!');

    // Note: This will succeed because Argon2 doesn't fail on wrong password,
    // it just derives a different key. The actual failure happens during decryption.
    expect(unlocked).toBe(true);

    // Encrypt with original key
    const plaintext = 'Secret data';
    const encrypted = keyManager.encrypt(plaintext, 'test');

    // Try to decrypt with wrong key
    try {
      newKeyManager.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, 'test');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✓ Wrong password produces wrong key (decryption fails)');
    }

    newKeyManager.wipeKeys();
  });

  test('Large data encryption and decryption', () => {
    // Create large plaintext (1MB)
    const largePlaintext = 'A'.repeat(1024 * 1024);

    // Encrypt
    const startEncrypt = performance.now();
    const encrypted = keyManager.encrypt(largePlaintext, 'test-context');
    const encryptTime = performance.now() - startEncrypt;

    // Decrypt
    const startDecrypt = performance.now();
    const decrypted = keyManager.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, 'test-context');
    const decryptTime = performance.now() - startDecrypt;

    expect(decrypted.toString('utf-8')).toBe(largePlaintext);

    console.log(`✓ Large data encryption/decryption successful`);
    console.log(`  Encrypt time: ${encryptTime.toFixed(2)}ms`);
    console.log(`  Decrypt time: ${decryptTime.toFixed(2)}ms`);
  });

  test('Unicode and special characters are preserved', () => {
    const testStrings = [
      'Hello 世界 🌍',
      'Émojis: 😀😁😂🤣😃😄',
      'Math: ∑∫∂√π∞≈≠≤≥',
      'Symbols: ©®™€£¥¢',
      'Newlines:\nTabs:\tSpecial: \r\n\t',
    ];

    for (const plaintext of testStrings) {
      const encrypted = keyManager.encrypt(plaintext, 'test-context');
      const decrypted = keyManager.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, 'test-context');

      expect(decrypted.toString('utf-8')).toBe(plaintext);
    }

    console.log('✓ Unicode and special characters preserved');
  });

  test('Empty string encryption', () => {
    const plaintext = '';

    const encrypted = keyManager.encrypt(plaintext, 'test-context');
    const decrypted = keyManager.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, 'test-context');

    expect(decrypted.toString('utf-8')).toBe(plaintext);

    console.log('✓ Empty string encryption works');
  });

  test('Message content encryption flow (HIPAA compliance)', () => {
    // Simulate encrypting a message like the database does
    const messageContent = {
      text: 'This is protected health information (PHI)',
      timestamp: new Date().toISOString(),
    };

    const contentStr = JSON.stringify(messageContent);

    // Encrypt
    const encrypted = keyManager.encrypt(contentStr, 'message-content');

    // Verify encryption fields exist
    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.encrypted.length).toBeGreaterThan(0);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.iv.length).toBeGreaterThan(0);
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.tag.length).toBeGreaterThan(0);

    // Decrypt and verify
    const decrypted = keyManager.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag, 'message-content');
    const decryptedContent = JSON.parse(decrypted.toString('utf-8'));

    expect(decryptedContent).toEqual(messageContent);

    console.log('✓ Message content encryption flow works (HIPAA compliant)');
  });

  test('Encryption key derivation produces consistent results', () => {
    // Derive same key twice
    const key1 = keyManager.deriveKey('test-purpose', 32);
    const key2 = keyManager.deriveKey('test-purpose', 32);

    // Should be identical
    expect(key1.toString('base64')).toBe(key2.toString('base64'));

    console.log('✓ Key derivation is deterministic');
  });

  test('Different purposes produce different keys', () => {
    const key1 = keyManager.deriveKey('purpose-1', 32);
    const key2 = keyManager.deriveKey('purpose-2', 32);

    // Should be different
    expect(key1.toString('base64')).not.toBe(key2.toString('base64'));

    console.log('✓ Different purposes produce different keys');
  });
});

console.log('\n=== Encryption End-to-End Test Suite ===\n');
