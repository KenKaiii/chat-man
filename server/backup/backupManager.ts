/**
 * Encrypted Backup System
 * HIPAA Security Rule - Backup Controls (§164.308(a)(7)(ii)(A))
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { getKeyManager } from '../encryption/keyManager';
import { logger } from '../utils/secureLogger';

const BACKUP_DIR = join(process.cwd(), 'backups');
const DB_PATH = join(process.cwd(), 'data', 'sessions.db');

export interface BackupMetadata {
  id: string;
  filename: string;
  timestamp: string;
  size: number;
  compressed: boolean;
  encrypted: boolean;
}

export interface EncryptedBackup {
  metadata: BackupMetadata;
  encrypted: string;
  iv: string;
  tag: string;
}

export class BackupManager {
  constructor() {
    // Ensure backup directory exists
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
      logger.info('Created backup directory', { path: BACKUP_DIR });
    }
  }

  /**
   * Create an encrypted backup of the database
   * HIPAA: Implements backup controls for data recovery
   */
  createBackup(): BackupMetadata {
    try {
      // Read database file
      if (!existsSync(DB_PATH)) {
        throw new Error('Database file not found');
      }

      const dbData = readFileSync(DB_PATH);
      logger.info('Read database for backup', { sizeBytes: dbData.length });

      // Compress with gzip
      const compressed = gzipSync(dbData, { level: 9 });
      logger.info('Compressed database', {
        originalSize: dbData.length,
        compressedSize: compressed.length,
        compressionRatio: ((1 - compressed.length / dbData.length) * 100).toFixed(1) + '%',
      });

      // Encrypt with AES-256-GCM using KeyManager
      const keyManager = getKeyManager();
      const { encrypted, iv, tag } = keyManager.encrypt(compressed, 'backup');

      // Create metadata
      const timestamp = new Date().toISOString();
      const id = `backup-${Date.now()}`;
      const filename = `${id}.json`;

      const metadata: BackupMetadata = {
        id,
        filename,
        timestamp,
        size: Buffer.from(encrypted, 'base64').length,
        compressed: true,
        encrypted: true,
      };

      // Create backup file
      const backup: EncryptedBackup = {
        metadata,
        encrypted,
        iv,
        tag,
      };

      const backupPath = join(BACKUP_DIR, filename);
      writeFileSync(backupPath, JSON.stringify(backup, null, 2));

      logger.info('Created encrypted backup', {
        id,
        size: metadata.size,
        path: backupPath,
      });

      return metadata;
    } catch (error) {
      logger.error('Failed to create backup', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  /**
   * Restore database from encrypted backup
   * HIPAA: Implements disaster recovery capability
   */
  restoreBackup(backupId: string): boolean {
    try {
      // Find backup file
      const backups = this.listBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const backupPath = join(BACKUP_DIR, backup.filename);
      const backupData = JSON.parse(readFileSync(backupPath, 'utf-8')) as EncryptedBackup;

      logger.info('Restoring backup', { id: backupId });

      // Decrypt with KeyManager
      const keyManager = getKeyManager();
      const decrypted = keyManager.decrypt(
        backupData.encrypted,
        backupData.iv,
        backupData.tag,
        'backup'
      );

      // Decompress
      const decompressed = gunzipSync(decrypted);

      logger.info('Decrypted and decompressed backup', {
        size: decompressed.length,
      });

      // Create backup of current database before overwriting
      const currentBackupPath = join(BACKUP_DIR, `pre-restore-${Date.now()}.db`);
      if (existsSync(DB_PATH)) {
        writeFileSync(currentBackupPath, readFileSync(DB_PATH));
        logger.info('Created pre-restore backup', { path: currentBackupPath });
      }

      // Restore database
      writeFileSync(DB_PATH, decompressed);

      logger.info('Database restored successfully', {
        id: backupId,
        sizeBytes: decompressed.length,
      });

      return true;
    } catch (error) {
      logger.error('Failed to restore backup', {
        backupId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  /**
   * List all available backups
   */
  listBackups(): BackupMetadata[] {
    try {
      if (!existsSync(BACKUP_DIR)) {
        return [];
      }

      const files = readdirSync(BACKUP_DIR);
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        try {
          const filePath = join(BACKUP_DIR, file);
          const backup = JSON.parse(readFileSync(filePath, 'utf-8')) as EncryptedBackup;
          backups.push(backup.metadata);
        } catch (_error) {
          logger.warn('Failed to read backup file', { file });
        }
      }

      // Sort by timestamp descending (newest first)
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return backups;
    } catch (error) {
      logger.error('Failed to list backups', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Delete a specific backup
   */
  deleteBackup(backupId: string): boolean {
    try {
      const backups = this.listBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        logger.warn('Backup not found for deletion', { backupId });
        return false;
      }

      const backupPath = join(BACKUP_DIR, backup.filename);
      unlinkSync(backupPath);

      logger.info('Deleted backup', { id: backupId });
      return true;
    } catch (error) {
      logger.error('Failed to delete backup', {
        backupId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  /**
   * Delete old backups, keeping only the last N backups
   * HIPAA: Implements retention policy for backup files
   */
  deleteOldBackups(keepLastN: number): number {
    try {
      const backups = this.listBackups();

      if (backups.length <= keepLastN) {
        logger.info('No old backups to delete', {
          totalBackups: backups.length,
          keepLastN,
        });
        return 0;
      }

      // Sort by timestamp descending, then delete everything after keepLastN
      const backupsToDelete = backups.slice(keepLastN);
      let deletedCount = 0;

      for (const backup of backupsToDelete) {
        if (this.deleteBackup(backup.id)) {
          deletedCount++;
        }
      }

      logger.info('Cleaned up old backups', {
        deletedCount,
        remaining: backups.length - deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete old backups', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return 0;
    }
  }

  /**
   * Get total size of all backups
   */
  getTotalBackupSize(): number {
    try {
      if (!existsSync(BACKUP_DIR)) {
        return 0;
      }

      const files = readdirSync(BACKUP_DIR);
      let totalSize = 0;

      for (const file of files) {
        const filePath = join(BACKUP_DIR, file);
        const stats = statSync(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (_error) {
      logger.error('Failed to calculate backup size');
      return 0;
    }
  }
}

// Singleton instance
let backupManagerInstance: BackupManager | null = null;

export function getBackupManager(): BackupManager {
  if (!backupManagerInstance) {
    backupManagerInstance = new BackupManager();
  }
  return backupManagerInstance;
}
