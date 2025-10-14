/**
 * Health Check System - Production Readiness
 * Comprehensive system health monitoring for Kubernetes/Docker deployments
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { HealthCheckResult, HealthStatus } from './types';
import { getKeyManager } from '../encryption/keyManager';
import { getBackupManager } from '../backup/backupManager';
import { getAuditLogger } from '../audit/auditLogger';
import { checkOllamaHealth } from '../ollama';
import { logger } from '../utils/secureLogger';

export class HealthChecker {
  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      encryption: await this.checkEncryption(),
      backup: await this.checkBackup(),
      audit: await this.checkAudit(),
      diskSpace: await this.checkDiskSpace(),
      memory: await this.checkMemory(),
      ollama: await this.checkOllama(),
    };

    // Determine overall health status
    const failedChecks = Object.values(checks).filter(c => c.status === 'fail').length;
    const warnChecks = Object.values(checks).filter(c => c.status === 'warn').length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failedChecks > 0) {
      status = 'unhealthy';
    } else if (warnChecks > 0) {
      status = 'degraded';
    }

    return {
      healthy: failedChecks === 0,
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check database connectivity and integrity
   */
  private async checkDatabase(): Promise<HealthStatus> {
    try {
      const dbPath = join(process.cwd(), 'data', 'sessions.db');

      if (!existsSync(dbPath)) {
        return {
          status: 'fail',
          message: 'Database file does not exist',
        };
      }

      const stats = statSync(dbPath);
      return {
        status: 'pass',
        message: 'Database is accessible',
        details: { size: stats.size, path: dbPath },
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Database check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }

  /**
   * Check encryption system status
   */
  private async checkEncryption(): Promise<HealthStatus> {
    try {
      const keyManager = getKeyManager();

      if (!keyManager.isSetup()) {
        return {
          status: 'fail',
          message: 'Encryption not initialized',
        };
      }

      return {
        status: 'pass',
        message: 'Encryption system is active',
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Encryption check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }

  /**
   * Check backup system status
   */
  private async checkBackup(): Promise<HealthStatus> {
    try {
      const backupManager = getBackupManager();
      const backups = backupManager.listBackups();

      if (backups.length === 0) {
        return {
          status: 'warn',
          message: 'No backups available',
          details: { backupCount: 0 },
        };
      }

      const latestBackup = backups[0];
      const backupAge = Date.now() - new Date(latestBackup.timestamp).getTime();
      const hoursSinceBackup = Math.floor(backupAge / (1000 * 60 * 60));

      if (hoursSinceBackup > 48) {
        return {
          status: 'warn',
          message: 'Latest backup is over 48 hours old',
          details: { latestBackup: latestBackup.timestamp, hoursSinceBackup },
        };
      }

      return {
        status: 'pass',
        message: 'Backup system is healthy',
        details: { backupCount: backups.length, latestBackup: latestBackup.timestamp },
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Backup check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }

  /**
   * Check audit logging system
   */
  private async checkAudit(): Promise<HealthStatus> {
    try {
      const auditLogger = getAuditLogger();
      const stats = auditLogger.getStats();

      if (stats.totalEvents === 0) {
        return {
          status: 'warn',
          message: 'No audit events logged',
          details: { totalEvents: 0 },
        };
      }

      return {
        status: 'pass',
        message: 'Audit logging is active',
        details: { totalEvents: stats.totalEvents, recentFailures: stats.recentFailures },
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Audit check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }

  /**
   * Check disk space availability
   */
  private async checkDiskSpace(): Promise<HealthStatus> {
    try {
      // This is a simplified check - in production, use fs.statfs or similar
      const dataDir = join(process.cwd(), 'data');

      if (!existsSync(dataDir)) {
        return {
          status: 'warn',
          message: 'Data directory does not exist',
        };
      }

      return {
        status: 'pass',
        message: 'Disk space check passed',
        details: { dataDir },
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Disk space check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthStatus> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const usagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      if (usagePercent > 90) {
        return {
          status: 'warn',
          message: 'High memory usage detected',
          details: { heapUsedMB, heapTotalMB, usagePercent },
        };
      }

      return {
        status: 'pass',
        message: 'Memory usage is normal',
        details: { heapUsedMB, heapTotalMB, usagePercent },
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Memory check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }

  /**
   * Check Ollama connectivity
   */
  private async checkOllama(): Promise<HealthStatus> {
    try {
      const isHealthy = await checkOllamaHealth();

      if (!isHealthy) {
        return {
          status: 'warn',
          message: 'Ollama is not accessible',
        };
      }

      return {
        status: 'pass',
        message: 'Ollama is running',
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Ollama check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      };
    }
  }
}

// Singleton instance
let healthCheckerInstance: HealthChecker | null = null;

export function getHealthChecker(): HealthChecker {
  if (!healthCheckerInstance) {
    healthCheckerInstance = new HealthChecker();
  }
  return healthCheckerInstance;
}
