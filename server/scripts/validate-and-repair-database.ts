/**
 * Database Validation and Repair Script
 * Scans for data integrity issues and provides repair options
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { logger } from '../utils/secureLogger';
import type { DBMessage } from '../database';

const DB_PATH = join(process.cwd(), 'data', 'sessions.db');

interface ValidationIssue {
  type: 'encrypted_flag_mismatch' | 'missing_encryption_fields' | 'no_content' | 'orphaned_message';
  messageId: string;
  sessionId?: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixable: boolean;
}

interface ValidationReport {
  totalMessages: number;
  totalSessions: number;
  issues: ValidationIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  healthScore: number;
}

interface RepairReport {
  issuesFound: number;
  issuesFixed: number;
  issuesDeleted: number;
  errors: Array<{ messageId: string; error: string }>;
}

/**
 * Validate database integrity
 */
async function validateDatabase(): Promise<ValidationReport> {
  console.log('🔍 Database Integrity Validation\n');
  console.log('Scanning for data integrity issues...\n');

  const report: ValidationReport = {
    totalMessages: 0,
    totalSessions: 0,
    issues: [],
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    healthScore: 100,
  };

  const db = new Database(DB_PATH);

  try {
    // Get total counts
    const sessionCount = db.query('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    const messageCount = db.query('SELECT COUNT(*) as count FROM messages').get() as { count: number };

    report.totalSessions = sessionCount.count;
    report.totalMessages = messageCount.count;

    console.log(`Found ${report.totalSessions} sessions and ${report.totalMessages} messages\n`);

    // Check 1: Messages with is_encrypted=1 but missing encryption fields
    console.log('Check 1: Encrypted flag without encryption data...');
    const flaggedButNotEncrypted = db.query(`
      SELECT id, session_id, is_encrypted, content_encrypted, content_iv, content_tag
      FROM messages
      WHERE is_encrypted = 1
        AND (content_encrypted IS NULL OR content_encrypted = ''
             OR content_iv IS NULL OR content_iv = ''
             OR content_tag IS NULL OR content_tag = '')
    `).all() as DBMessage[];

    for (const msg of flaggedButNotEncrypted) {
      report.issues.push({
        type: 'missing_encryption_fields',
        messageId: msg.id,
        sessionId: msg.session_id,
        description: `Message marked as encrypted but missing encryption fields`,
        severity: 'critical',
        autoFixable: true,
      });
      report.summary.critical++;
    }
    console.log(`  Found ${flaggedButNotEncrypted.length} issues\n`);

    // Check 2: Messages with encryption fields but is_encrypted=0
    console.log('Check 2: Encryption data without encrypted flag...');
    const encryptedButNotFlagged = db.query(`
      SELECT id, session_id, is_encrypted, content_encrypted, content_iv, content_tag
      FROM messages
      WHERE (is_encrypted = 0 OR is_encrypted IS NULL)
        AND content_encrypted IS NOT NULL
        AND content_encrypted != ''
        AND content_iv IS NOT NULL
        AND content_iv != ''
        AND content_tag IS NOT NULL
        AND content_tag != ''
    `).all() as DBMessage[];

    for (const msg of encryptedButNotFlagged) {
      report.issues.push({
        type: 'encrypted_flag_mismatch',
        messageId: msg.id,
        sessionId: msg.session_id,
        description: `Message has encryption data but is_encrypted flag is not set`,
        severity: 'high',
        autoFixable: true,
      });
      report.summary.high++;
    }
    console.log(`  Found ${encryptedButNotFlagged.length} issues\n`);

    // Check 3: Messages with neither content nor encrypted content
    console.log('Check 3: Messages with no content...');
    const noContent = db.query(`
      SELECT id, session_id, content, content_encrypted
      FROM messages
      WHERE (content IS NULL OR content = '')
        AND (content_encrypted IS NULL OR content_encrypted = '')
    `).all() as DBMessage[];

    for (const msg of noContent) {
      report.issues.push({
        type: 'no_content',
        messageId: msg.id,
        sessionId: msg.session_id,
        description: `Message has no content (neither plaintext nor encrypted)`,
        severity: 'critical',
        autoFixable: true,
      });
      report.summary.critical++;
    }
    console.log(`  Found ${noContent.length} issues\n`);

    // Check 4: Orphaned messages (session_id doesn't exist)
    console.log('Check 4: Orphaned messages...');
    const orphaned = db.query(`
      SELECT m.id, m.session_id
      FROM messages m
      LEFT JOIN sessions s ON m.session_id = s.id
      WHERE s.id IS NULL
    `).all() as DBMessage[];

    for (const msg of orphaned) {
      report.issues.push({
        type: 'orphaned_message',
        messageId: msg.id,
        sessionId: msg.session_id,
        description: `Message references non-existent session ${msg.session_id?.substring(0, 8)}...`,
        severity: 'medium',
        autoFixable: true,
      });
      report.summary.medium++;
    }
    console.log(`  Found ${orphaned.length} issues\n`);

    // Calculate health score
    const totalIssues = report.issues.length;
    if (totalIssues === 0) {
      report.healthScore = 100;
    } else {
      const weightedIssues =
        report.summary.critical * 10 +
        report.summary.high * 5 +
        report.summary.medium * 2 +
        report.summary.low * 1;
      const maxScore = report.totalMessages * 10; // Worst case: all messages critical
      report.healthScore = Math.max(0, Math.round(100 - (weightedIssues / maxScore) * 100));
    }
  } finally {
    db.close();
  }

  return report;
}

/**
 * Repair database integrity issues
 */
async function repairDatabase(dryRun: boolean = true): Promise<RepairReport> {
  console.log(dryRun ? '\n🔧 Database Repair (DRY RUN)\n' : '\n🔧 Database Repair (LIVE MODE)\n');
  console.log(dryRun
    ? 'This is a dry run - no changes will be made.\n'
    : 'WARNING: This will modify your database!\n'
  );

  const report: RepairReport = {
    issuesFound: 0,
    issuesFixed: 0,
    issuesDeleted: 0,
    errors: [],
  };

  const db = new Database(DB_PATH);

  try {
    // Fix 1: Messages with is_encrypted=1 but missing encryption fields
    // Action: Set is_encrypted=0 (fall back to legacy content)
    const flaggedButNotEncrypted = db.query(`
      SELECT id, session_id, content
      FROM messages
      WHERE is_encrypted = 1
        AND (content_encrypted IS NULL OR content_encrypted = ''
             OR content_iv IS NULL OR content_iv = ''
             OR content_tag IS NULL OR content_tag = '')
    `).all() as DBMessage[];

    report.issuesFound += flaggedButNotEncrypted.length;

    for (const msg of flaggedButNotEncrypted) {
      try {
        if (!dryRun) {
          // Check if legacy content exists
          if (msg.content && msg.content.length > 0) {
            db.run('UPDATE messages SET is_encrypted = 0 WHERE id = ?', [msg.id]);
            console.log(`✓ Fixed: Set is_encrypted=0 for message ${msg.id.substring(0, 8)}...`);
            report.issuesFixed++;
          } else {
            // No content at all - delete
            db.run('DELETE FROM messages WHERE id = ?', [msg.id]);
            console.log(`✓ Deleted: Message ${msg.id.substring(0, 8)}... (no content)`);
            report.issuesDeleted++;
          }
        } else {
          console.log(`[DRY RUN] Would fix message ${msg.id.substring(0, 8)}...`);
          report.issuesFixed++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({ messageId: msg.id, error: errorMsg });
        console.error(`✗ Failed to fix message ${msg.id.substring(0, 8)}...: ${errorMsg}`);
      }
    }

    // Fix 2: Messages with encryption fields but is_encrypted=0
    // Action: Set is_encrypted=1
    const encryptedButNotFlagged = db.query(`
      SELECT id, session_id
      FROM messages
      WHERE (is_encrypted = 0 OR is_encrypted IS NULL)
        AND content_encrypted IS NOT NULL
        AND content_encrypted != ''
        AND content_iv IS NOT NULL
        AND content_iv != ''
        AND content_tag IS NOT NULL
        AND content_tag != ''
    `).all() as DBMessage[];

    report.issuesFound += encryptedButNotFlagged.length;

    for (const msg of encryptedButNotFlagged) {
      try {
        if (!dryRun) {
          db.run('UPDATE messages SET is_encrypted = 1 WHERE id = ?', [msg.id]);
          console.log(`✓ Fixed: Set is_encrypted=1 for message ${msg.id.substring(0, 8)}...`);
        } else {
          console.log(`[DRY RUN] Would set is_encrypted=1 for message ${msg.id.substring(0, 8)}...`);
        }
        report.issuesFixed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({ messageId: msg.id, error: errorMsg });
        console.error(`✗ Failed to fix message ${msg.id.substring(0, 8)}...: ${errorMsg}`);
      }
    }

    // Fix 3: Messages with no content
    // Action: Delete
    const noContent = db.query(`
      SELECT id, session_id
      FROM messages
      WHERE (content IS NULL OR content = '')
        AND (content_encrypted IS NULL OR content_encrypted = '')
    `).all() as DBMessage[];

    report.issuesFound += noContent.length;

    for (const msg of noContent) {
      try {
        if (!dryRun) {
          db.run('DELETE FROM messages WHERE id = ?', [msg.id]);
          console.log(`✓ Deleted: Message ${msg.id.substring(0, 8)}... (no content)`);
        } else {
          console.log(`[DRY RUN] Would delete message ${msg.id.substring(0, 8)}... (no content)`);
        }
        report.issuesDeleted++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({ messageId: msg.id, error: errorMsg });
        console.error(`✗ Failed to delete message ${msg.id.substring(0, 8)}...: ${errorMsg}`);
      }
    }

    // Fix 4: Orphaned messages
    // Action: Delete
    const orphaned = db.query(`
      SELECT m.id, m.session_id
      FROM messages m
      LEFT JOIN sessions s ON m.session_id = s.id
      WHERE s.id IS NULL
    `).all() as DBMessage[];

    report.issuesFound += orphaned.length;

    for (const msg of orphaned) {
      try {
        if (!dryRun) {
          db.run('DELETE FROM messages WHERE id = ?', [msg.id]);
          console.log(`✓ Deleted: Orphaned message ${msg.id.substring(0, 8)}...`);
        } else {
          console.log(`[DRY RUN] Would delete orphaned message ${msg.id.substring(0, 8)}...`);
        }
        report.issuesDeleted++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({ messageId: msg.id, error: errorMsg });
        console.error(`✗ Failed to delete orphaned message ${msg.id.substring(0, 8)}...: ${errorMsg}`);
      }
    }

    // Vacuum database if changes were made
    if (!dryRun && (report.issuesFixed > 0 || report.issuesDeleted > 0)) {
      console.log('\nVacuuming database...');
      db.run('VACUUM');
      console.log('✓ Database vacuumed\n');
    }
  } finally {
    db.close();
  }

  return report;
}

/**
 * Print validation report
 */
function printValidationReport(report: ValidationReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('DATABASE VALIDATION REPORT');
  console.log('='.repeat(60) + '\n');

  console.log(`Total sessions:        ${report.totalSessions}`);
  console.log(`Total messages:        ${report.totalMessages}`);
  console.log(`Issues found:          ${report.issues.length}\n`);

  console.log('Issue Severity Breakdown:');
  console.log(`  Critical:            ${report.summary.critical}`);
  console.log(`  High:                ${report.summary.high}`);
  console.log(`  Medium:              ${report.summary.medium}`);
  console.log(`  Low:                 ${report.summary.low}\n`);

  if (report.issues.length > 0) {
    console.log('Issue Details:');
    for (const issue of report.issues) {
      const severityIcon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[issue.severity];
      console.log(`  ${severityIcon} ${issue.type} - ${issue.messageId.substring(0, 8)}...`);
      console.log(`     ${issue.description}`);
      console.log(`     Auto-fixable: ${issue.autoFixable ? 'Yes' : 'No'}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log(`Database Health Score: ${report.healthScore}/100`);

  if (report.healthScore >= 90) {
    console.log('✅ Database is in excellent condition!');
  } else if (report.healthScore >= 70) {
    console.log('⚠️  Database has some issues - repair recommended');
  } else if (report.healthScore >= 50) {
    console.log('🔴 Database has significant issues - repair strongly recommended');
  } else {
    console.log('🚨 Database is in critical condition - immediate repair required!');
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * Print repair report
 */
function printRepairReport(report: RepairReport, dryRun: boolean): void {
  console.log('\n' + '='.repeat(60));
  console.log(dryRun ? 'DATABASE REPAIR REPORT (DRY RUN)' : 'DATABASE REPAIR REPORT');
  console.log('='.repeat(60) + '\n');

  console.log(`Issues found:          ${report.issuesFound}`);
  console.log(`Issues fixed:          ${report.issuesFixed}`);
  console.log(`Messages deleted:      ${report.issuesDeleted}`);
  console.log(`Errors:                ${report.errors.length}\n`);

  if (report.errors.length > 0) {
    console.log('Errors:');
    for (const err of report.errors) {
      console.log(`  - ${err.messageId.substring(0, 8)}...: ${err.error}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));

  if (dryRun) {
    console.log('ℹ️  This was a dry run - no changes were made.');
    console.log('Run with --repair to apply fixes.\n');
  } else {
    if (report.errors.length === 0) {
      console.log('✅ All issues repaired successfully!');
    } else {
      console.log('⚠️  Some issues could not be repaired - see errors above');
    }
    console.log('');
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldRepair = args.includes('--repair');
  const dryRun = !shouldRepair;

  try {
    // Always run validation first
    const validationReport = await validateDatabase();
    printValidationReport(validationReport);

    if (validationReport.issues.length === 0) {
      console.log('No issues found - database is healthy!\n');
      return;
    }

    // Run repair if requested
    if (shouldRepair || args.includes('--dry-run')) {
      const repairReport = await repairDatabase(dryRun);
      printRepairReport(repairReport, dryRun);

      if (dryRun && repairReport.issuesFound > 0) {
        console.log('To apply these fixes, run:');
        console.log('  bun run server/scripts/validate-and-repair-database.ts --repair\n');
      }
    } else {
      console.log('To see what would be fixed, run:');
      console.log('  bun run server/scripts/validate-and-repair-database.ts --dry-run');
      console.log('\nTo apply fixes, run:');
      console.log('  bun run server/scripts/validate-and-repair-database.ts --repair\n');
    }
  } catch (error) {
    console.error('\n❌ Validation/repair failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    console.error('');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { validateDatabase, repairDatabase, type ValidationReport, type RepairReport, type ValidationIssue };
