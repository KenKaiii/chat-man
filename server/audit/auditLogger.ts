/**
 * Audit Logger for HIPAA Compliance
 * HIPAA Security Rule - Audit Controls (§164.312(b))
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { appendFileSync, existsSync, mkdirSync, statSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import type { AuditEvent, AuditEventType } from './auditEvents';
import { AuditSeverity, getDefaultSeverity } from './auditEvents';
import { logger } from '../utils/secureLogger';

const AUDIT_DIR = join(process.cwd(), 'data', 'audit');
const AUDIT_FILE = join(AUDIT_DIR, 'audit.log');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export class AuditLogger {
  constructor() {
    // Ensure audit directory exists
    if (!existsSync(AUDIT_DIR)) {
      mkdirSync(AUDIT_DIR, { recursive: true });
      logger.info('Created audit directory', { path: AUDIT_DIR });
    }
  }

  /**
   * Log an audit event
   * HIPAA: Records security-relevant events for audit trail
   */
  log(
    event: AuditEventType,
    result: 'SUCCESS' | 'FAILURE',
    details?: Record<string, unknown>,
    user?: string,
    severity?: AuditSeverity
  ): void {
    const auditEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      event,
      severity: severity || getDefaultSeverity(event),
      user,
      details,
      result,
    };

    // Write to audit log file
    try {
      const logLine = JSON.stringify(auditEvent) + '\n';
      appendFileSync(AUDIT_FILE, logLine, { encoding: 'utf-8' });

      // Also log to console for real-time monitoring
      if (result === 'FAILURE' || auditEvent.severity === AuditSeverity.CRITICAL) {
        logger.warn('Audit event (critical/failure)', {
          event,
          result,
          severity: auditEvent.severity,
        });
      } else {
        logger.debug('Audit event logged', { event, result });
      }

      // Check if rotation is needed
      this.checkRotation();
    } catch (error) {
      logger.error('Failed to write audit log', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Check if audit log needs rotation based on size
   */
  private checkRotation(): void {
    try {
      if (!existsSync(AUDIT_FILE)) {
        return;
      }

      const stats = statSync(AUDIT_FILE);
      if (stats.size > MAX_FILE_SIZE) {
        this.rotateLog();
      }
    } catch (error) {
      logger.error('Failed to check audit log rotation', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Rotate audit log file
   * Renames current log to audit.log.1, audit.log.2, etc.
   */
  private rotateLog(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = join(AUDIT_DIR, `audit-${timestamp}.log`);

      renameSync(AUDIT_FILE, rotatedFile);
      logger.info('Rotated audit log', {
        oldFile: AUDIT_FILE,
        newFile: rotatedFile,
      });
    } catch (error) {
      logger.error('Failed to rotate audit log', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   * HIPAA: Audit logs must be retained for required period
   */
  cleanupOldLogs(retentionDays: number): number {
    try {
      if (!existsSync(AUDIT_DIR)) {
        return 0;
      }

      const now = Date.now();
      const maxAge = retentionDays * 24 * 60 * 60 * 1000;
      const files = readdirSync(AUDIT_DIR);
      let deletedCount = 0;

      for (const file of files) {
        // Skip current audit.log file
        if (file === 'audit.log') {
          continue;
        }

        // Only process audit log files
        if (!file.startsWith('audit-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = join(AUDIT_DIR, file);
        const stats = statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          unlinkSync(filePath);
          deletedCount++;
          logger.info('Deleted old audit log', { file, ageDays: Math.floor(age / (24 * 60 * 60 * 1000)) });
        }
      }

      if (deletedCount > 0) {
        logger.info('Audit log cleanup completed', {
          deletedCount,
          retentionDays,
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to clean up audit logs', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return 0;
    }
  }

  /**
   * Get total number of audit log files
   */
  getLogFileCount(): number {
    try {
      if (!existsSync(AUDIT_DIR)) {
        return 0;
      }

      const files = readdirSync(AUDIT_DIR);
      return files.filter(f => f.endsWith('.log')).length;
    } catch (error) {
      logger.error('Failed to count audit log files', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return 0;
    }
  }

  /**
   * Get total size of audit logs
   */
  getTotalLogSize(): number {
    try {
      if (!existsSync(AUDIT_DIR)) {
        return 0;
      }

      const files = readdirSync(AUDIT_DIR);
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = join(AUDIT_DIR, file);
          const stats = statSync(filePath);
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error('Failed to calculate audit log size', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return 0;
    }
  }
}

// Singleton instance
let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

// Export convenience function
export function logAuditEvent(
  event: AuditEventType,
  result: 'SUCCESS' | 'FAILURE',
  details?: Record<string, unknown>,
  user?: string,
  severity?: AuditSeverity
): void {
  getAuditLogger().log(event, result, details, user, severity);
}
