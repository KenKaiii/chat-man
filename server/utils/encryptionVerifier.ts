/**
 * Filesystem Encryption Verifier
 * Checks if disk encryption is enabled for HIPAA compliance
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './secureLogger';

const execAsync = promisify(exec);

export interface EncryptionStatus {
  enabled: boolean;
  type: 'FileVault' | 'LUKS' | 'BitLocker' | 'Unknown';
  details: string;
  warning?: string;
}

/**
 * Check macOS FileVault status
 */
async function checkFileVault(): Promise<EncryptionStatus> {
  try {
    const { stdout } = await execAsync('fdesetup status');
    const enabled = stdout.includes('FileVault is On');

    return {
      enabled,
      type: 'FileVault',
      details: stdout.trim(),
    };
  } catch (_error) {
    logger.error('Failed to check FileVault status', {
      error: _error instanceof Error ? _error.message : 'Unknown',
    });
    return {
      enabled: false,
      type: 'FileVault',
      details: 'Failed to check FileVault status',
      warning: 'Could not verify encryption status',
    };
  }
}

/**
 * Check Linux LUKS status
 */
async function checkLUKS(): Promise<EncryptionStatus> {
  try {
    // Check if cryptsetup is available
    await execAsync('which cryptsetup');

    // Get list of encrypted devices
    const { stdout } = await execAsync('lsblk -o NAME,FSTYPE | grep crypto_LUKS || true');

    const hasEncrypted = stdout.trim().length > 0;

    return {
      enabled: hasEncrypted,
      type: 'LUKS',
      details: hasEncrypted
        ? `LUKS encrypted volumes found:\n${stdout.trim()}`
        : 'No LUKS encrypted volumes found',
    };
  } catch (_error) {
    // cryptsetup not found or permission denied
    return {
      enabled: false,
      type: 'LUKS',
      details: 'LUKS not available or permission denied',
      warning: 'Could not verify encryption status (requires root)',
    };
  }
}

/**
 * Check Windows BitLocker status
 */
async function checkBitLocker(): Promise<EncryptionStatus> {
  try {
    const { stdout } = await execAsync('manage-bde -status C:');
    const enabled =
      stdout.includes('Protection On') || stdout.includes('Fully Encrypted');

    return {
      enabled,
      type: 'BitLocker',
      details: stdout.trim(),
    };
  } catch (_error) {
    logger.error('Failed to check BitLocker status', {
      error: _error instanceof Error ? _error.message : 'Unknown',
    });
    return {
      enabled: false,
      type: 'BitLocker',
      details: 'Failed to check BitLocker status',
      warning: 'Could not verify encryption status',
    };
  }
}

/**
 * Verify filesystem encryption is enabled
 * Returns status based on the current platform
 */
export async function verifyFilesystemEncryption(): Promise<EncryptionStatus> {
  const platform = process.platform;

  logger.info('Checking filesystem encryption', { platform });

  let status: EncryptionStatus;

  switch (platform) {
    case 'darwin':
      status = await checkFileVault();
      break;
    case 'linux':
      status = await checkLUKS();
      break;
    case 'win32':
      status = await checkBitLocker();
      break;
    default:
      status = {
        enabled: false,
        type: 'Unknown',
        details: `Unknown platform: ${platform}`,
        warning: 'Cannot verify encryption on this platform',
      };
  }

  if (status.enabled) {
    logger.info('Filesystem encryption is enabled', {
      type: status.type,
      details: status.details,
    });
  } else {
    logger.warn('Filesystem encryption is NOT enabled', {
      type: status.type,
      details: status.details,
      warning: status.warning,
    });
  }

  return status;
}

/**
 * Check encryption and exit if not enabled (strict mode for production)
 */
export async function requireFilesystemEncryption(): Promise<void> {
  const status = await verifyFilesystemEncryption();

  if (!status.enabled) {
    logger.error('FATAL: Filesystem encryption is required for HIPAA compliance');
    logger.error('Encryption check failed', {
      type: status.type,
      details: status.details,
    });

    console.error('\n❌ ENCRYPTION CHECK FAILED\n');
    console.error(`Platform: ${process.platform}`);
    console.error(`Type: ${status.type}`);
    console.error(`Status: ${status.details}\n`);

    if (status.warning) {
      console.error(`⚠️  Warning: ${status.warning}\n`);
    }

    console.error('HIPAA COMPLIANCE REQUIREMENT:');
    console.error('Database encryption is required (§164.312(a)(2)(iv)).\n');

    switch (process.platform) {
      case 'darwin':
        console.error('Enable FileVault:');
        console.error('  System Preferences > Security & Privacy > FileVault > Turn On FileVault\n');
        break;
      case 'linux':
        console.error('Enable LUKS encryption:');
        console.error('  Install cryptsetup and encrypt your system disk');
        console.error('  See: https://wiki.archlinux.org/title/Dm-crypt/Encrypting_an_entire_system\n');
        break;
      case 'win32':
        console.error('Enable BitLocker:');
        console.error('  Control Panel > BitLocker Drive Encryption > Turn On BitLocker\n');
        break;
    }

    // Only suggest bypass in development
    if (process.env.NODE_ENV === 'development') {
      console.error('To disable this check in development (NOT RECOMMENDED):');
      console.error('  Set environment variable: SKIP_ENCRYPTION_CHECK=true\n');
    } else {
      console.error('PRODUCTION MODE: Encryption bypass is DISABLED for compliance.\n');
      console.error('This application cannot run without filesystem encryption in production.\n');
    }

    process.exit(1);
  }
}

/**
 * Check encryption with environment variable override
 * SECURITY: In production, bypass is DISABLED for HIPAA compliance
 */
export async function verifyEncryptionOrWarn(): Promise<void> {
  // PRODUCTION MODE: NO BYPASS ALLOWED
  if (process.env.NODE_ENV === 'production') {
    logger.info('Production mode: Filesystem encryption is REQUIRED for HIPAA compliance');

    // Check if someone tried to bypass in production
    if (process.env.SKIP_ENCRYPTION_CHECK === 'true') {
      logger.error('SECURITY VIOLATION: Attempted to bypass encryption check in production');
      console.error('\n❌ SECURITY ERROR: Encryption bypass is DISABLED in production\n');
      console.error('HIPAA §164.312(a)(2)(iv) requires encryption at rest.');
      console.error('This application cannot run without filesystem encryption in production.\n');
      process.exit(1);
    }

    // Require encryption (will exit if not enabled)
    await requireFilesystemEncryption();
    return;
  }

  // DEVELOPMENT MODE: Allow bypass with warning
  if (process.env.SKIP_ENCRYPTION_CHECK === 'true') {
    logger.warn('Filesystem encryption check SKIPPED (SKIP_ENCRYPTION_CHECK=true)');
    logger.warn('This is ONLY allowed in development mode');
    console.warn('\n⚠️  WARNING: Filesystem encryption check is DISABLED');
    console.warn('⚠️  This is NOT HIPAA compliant for production use');
    console.warn('⚠️  Development mode only - bypass will NOT work in production\n');
    return;
  }

  // In development, just warn instead of exiting
  const status = await verifyFilesystemEncryption();
  if (!status.enabled) {
    console.warn('\n⚠️  WARNING: Filesystem encryption is not enabled');
    console.warn(`⚠️  Type: ${status.type}`);
    console.warn(`⚠️  Status: ${status.details}`);
    console.warn('⚠️  This is required for HIPAA compliance in production');
    console.warn('⚠️  To skip this check in development: SKIP_ENCRYPTION_CHECK=true\n');
  }
}
