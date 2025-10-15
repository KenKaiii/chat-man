/**
 * Database Migration Script: Encrypt Existing Messages
 * Encrypts all plaintext messages in the database with AES-256-GCM
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { getKeyManager } from '../encryption/keyManager';
import { logger } from '../utils/secureLogger';
import type { DBMessage } from '../database';

const DB_PATH = join(process.cwd(), 'data', 'sessions.db');

interface MigrationReport {
  totalMessages: number;
  alreadyEncrypted: number;
  encrypted: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
}

/**
 * Migrate unencrypted messages to encrypted format
 */
async function migrateEncryptMessages(): Promise<MigrationReport> {
  console.log('🔒 Database Encryption Migration\n');
  console.log('This script will encrypt all plaintext messages in the database.');
  console.log('Encrypted messages will use AES-256-GCM encryption.\n');

  const report: MigrationReport = {
    totalMessages: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    errors: [],
  };

  // Initialize encryption system
  const { ensureEncryptionUnlocked } = await import('../encryption/setupWizard');
  try {
    await ensureEncryptionUnlocked();
    console.log('✅ Encryption system initialized\n');
  } catch (_error) {
    console.error('❌ ERROR: Failed to initialize encryption');
    console.error('Please ensure CHAT_MAN_PASSWORD environment variable is set.\n');
    process.exit(1);
  }

  // Check if encryption is initialized
  const keyManager = getKeyManager();
  if (!keyManager.isSetup()) {
    console.error('❌ ERROR: Encryption is not initialized');
    console.error('Please ensure the authentication password is set first.\n');
    process.exit(1);
  }

  console.log('✅ Encryption system is ready\n');

  // Open database connection
  const db = new Database(DB_PATH);

  try {
    // Get all messages
    const messages = db.query('SELECT * FROM messages').all() as DBMessage[];
    report.totalMessages = messages.length;

    console.log(`Found ${messages.length} messages in database\n`);

    if (messages.length === 0) {
      console.log('No messages to migrate.\n');
      return report;
    }

    // Process each message
    for (const msg of messages) {
      // Check if already encrypted
      if (msg.is_encrypted === 1) {
        report.alreadyEncrypted++;
        continue;
      }

      try {
        // Check if content exists
        if (!msg.content || msg.content.trim() === '') {
          logger.warn('Skipping message with empty content', {
            messageId: msg.id.substring(0, 8) + '...',
          });
          report.failed++;
          report.errors.push({
            messageId: msg.id,
            error: 'Empty content',
          });
          continue;
        }

        // Encrypt the content
        const encrypted = keyManager.encrypt(msg.content, 'message-content');

        // Update database with encrypted content
        db.run(
          `UPDATE messages SET
            content = '',
            content_encrypted = ?,
            content_iv = ?,
            content_tag = ?,
            is_encrypted = 1
          WHERE id = ?`,
          [encrypted.encrypted, encrypted.iv, encrypted.tag, msg.id]
        );

        // Verify encryption by attempting to decrypt
        const decrypted = keyManager.decrypt(
          encrypted.encrypted,
          encrypted.iv,
          encrypted.tag,
          'message-content'
        );

        if (decrypted.toString('utf-8') !== msg.content) {
          throw new Error('Decryption verification failed - content mismatch');
        }

        report.encrypted++;
        console.log(`✓ Encrypted message ${msg.id.substring(0, 8)}...`);
      } catch (error) {
        report.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({
          messageId: msg.id,
          error: errorMsg,
        });

        logger.error('Failed to encrypt message', {
          messageId: msg.id.substring(0, 8) + '...',
          error: errorMsg,
        });

        console.error(`✗ Failed to encrypt message ${msg.id.substring(0, 8)}...: ${errorMsg}`);
      }
    }
  } finally {
    db.close();
  }

  return report;
}

/**
 * Print migration report
 */
function printReport(report: MigrationReport): void {
  console.log('\n' + '='.repeat(50));
  console.log('MIGRATION REPORT');
  console.log('='.repeat(50) + '\n');

  console.log(`Total messages:        ${report.totalMessages}`);
  console.log(`Already encrypted:     ${report.alreadyEncrypted}`);
  console.log(`Newly encrypted:       ${report.encrypted}`);
  console.log(`Failed:                ${report.failed}`);

  if (report.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of report.errors) {
      console.log(`  - ${err.messageId.substring(0, 8)}...: ${err.error}`);
    }
  }

  console.log('\n' + '='.repeat(50));

  const successRate = report.totalMessages > 0
    ? ((report.encrypted + report.alreadyEncrypted) / report.totalMessages) * 100
    : 100;

  if (report.failed === 0) {
    console.log('✅ Migration completed successfully!');
  } else if (successRate >= 90) {
    console.log('⚠️  Migration completed with some errors');
  } else {
    console.log('❌ Migration failed - too many errors');
  }

  console.log(`Success rate: ${successRate.toFixed(1)}%\n`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const report = await migrateEncryptMessages();
    printReport(report);

    if (report.failed > 0 && report.encrypted === 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    console.error('');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { migrateEncryptMessages, type MigrationReport };
