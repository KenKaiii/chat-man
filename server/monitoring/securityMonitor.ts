/**
 * Security Monitor - Real-time Security Threat Detection
 * Production readiness - Monitors audit events for security threats
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getAuditLogger } from '../audit/auditLogger';
import { AuditEventType, AuditSeverity } from '../audit/auditEvents';
import { getAlertManager } from './alertManager';
import type { SecurityMetrics, MonitoringConfig } from './types';
import { AlertType, AlertSeverity } from './types';
import { logger } from '../utils/secureLogger';

export class SecurityMonitor {
  private config: MonitoringConfig;
  private monitoringInterval: Timer | null = null;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Start continuous security monitoring
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Security monitoring is disabled');
      return;
    }

    logger.info('Starting security monitoring', {
      checkIntervalMinutes: this.config.checkIntervalMinutes,
    });

    // Run initial check
    this.performSecurityCheck();

    // Schedule periodic checks
    const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
    this.monitoringInterval = setInterval(() => {
      this.performSecurityCheck();
    }, intervalMs);

    logger.info('Security monitoring started');
  }

  /**
   * Stop security monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Security monitoring stopped');
    }
  }

  /**
   * Perform comprehensive security checks
   */
  private async performSecurityCheck(): Promise<void> {
    try {
      logger.debug('Running security checks');

      // Check for brute force attacks
      await this.checkBruteForceAttacks();

      // Check for suspicious backup restores
      await this.checkSuspiciousBackupRestores();

      // Check for audit log failures
      await this.checkAuditLogFailures();

      // Check for critical events
      await this.checkCriticalEvents();

      logger.debug('Security checks completed');
    } catch (error) {
      logger.error('Security check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Check for brute force login attempts
   */
  private async checkBruteForceAttacks(): Promise<void> {
    const auditLogger = getAuditLogger();
    const alertManager = getAlertManager();

    // Get failed login attempts in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { events } = auditLogger.readLogs({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      startDate: fifteenMinutesAgo,
      limit: 100,
    });

    const failedAttempts = events.length;

    if (failedAttempts >= this.config.failedLoginThreshold) {
      await alertManager.sendAlert(
        AlertType.BRUTE_FORCE_ATTACK,
        AlertSeverity.CRITICAL,
        `Detected ${failedAttempts} failed login attempts in the last 15 minutes`,
        {
          failedAttempts,
          threshold: this.config.failedLoginThreshold,
          timeWindow: '15 minutes',
          events: events.slice(0, 5).map(e => ({
            timestamp: e.timestamp,
            details: e.details,
          })),
        }
      );

      logger.warn('Brute force attack detected', {
        failedAttempts,
        threshold: this.config.failedLoginThreshold,
      });
    }
  }

  /**
   * Check for suspicious backup restore operations
   */
  private async checkSuspiciousBackupRestores(): Promise<void> {
    const auditLogger = getAuditLogger();
    const alertManager = getAlertManager();

    // Get backup restore events in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { events } = auditLogger.readLogs({
      eventType: AuditEventType.BACKUP_RESTORE,
      startDate: oneHourAgo,
      limit: 100,
    });

    const restoreCount = events.length;

    if (restoreCount >= this.config.backupRestoreThreshold) {
      await alertManager.sendAlert(
        AlertType.MULTIPLE_BACKUP_RESTORES,
        AlertSeverity.HIGH,
        `Detected ${restoreCount} backup restore operations in the last hour`,
        {
          restoreCount,
          threshold: this.config.backupRestoreThreshold,
          timeWindow: '1 hour',
          events: events.map(e => ({
            timestamp: e.timestamp,
            backupId: e.details?.backupId,
            result: e.result,
          })),
        }
      );

      logger.warn('Multiple backup restores detected', {
        restoreCount,
        threshold: this.config.backupRestoreThreshold,
      });
    }
  }

  /**
   * Check for audit log write failures
   */
  private async checkAuditLogFailures(): Promise<void> {
    // This would require tracking failed audit writes
    // For now, we'll check for gaps in audit log timestamps

    const auditLogger = getAuditLogger();
    const alertManager = getAlertManager();

    const stats = auditLogger.getStats();

    // Check for recent failures (last 24 hours)
    if (stats.recentFailures > 0) {
      await alertManager.sendAlert(
        AlertType.AUDIT_LOG_FAILURE,
        AlertSeverity.HIGH,
        `Detected ${stats.recentFailures} audit log failures in the last 24 hours`,
        {
          failureCount: stats.recentFailures,
          totalEvents: stats.totalEvents,
        }
      );

      logger.warn('Audit log failures detected', {
        failureCount: stats.recentFailures,
      });
    }
  }

  /**
   * Check for critical security events
   */
  private async checkCriticalEvents(): Promise<void> {
    const auditLogger = getAuditLogger();
    const alertManager = getAlertManager();

    // Get critical events in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { events } = auditLogger.readLogs({
      severity: AuditSeverity.CRITICAL,
      startDate: oneHourAgo,
      limit: 100,
    });

    // Filter out SECURITY_ALERT events to avoid circular alerts
    const criticalEvents = events.filter(e => e.event !== AuditEventType.SECURITY_ALERT);

    if (criticalEvents.length > 0) {
      // Group by event type
      const eventsByType: Record<string, number> = {};
      for (const event of criticalEvents) {
        eventsByType[event.event] = (eventsByType[event.event] || 0) + 1;
      }

      // Send alerts for specific critical events
      for (const [eventType, count] of Object.entries(eventsByType)) {
        if (count >= 3) {
          await alertManager.sendAlert(
            AlertType.SYSTEM_HEALTH_CRITICAL,
            AlertSeverity.HIGH,
            `Detected ${count} ${eventType} critical events in the last hour`,
            {
              eventType,
              count,
              timeWindow: '1 hour',
            }
          );
        }
      }
    }
  }

  /**
   * Get current security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const auditLogger = getAuditLogger();
    const alertManager = getAlertManager();

    const now = Date.now();
    const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Get failed login attempts
    const failedLogins15m = auditLogger.readLogs({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      startDate: fifteenMinutesAgo,
      limit: 1000,
    }).events.length;

    const failedLogins1h = auditLogger.readLogs({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      startDate: oneHourAgo,
      limit: 1000,
    }).events.length;

    const failedLogins24h = auditLogger.readLogs({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      startDate: twentyFourHoursAgo,
      limit: 1000,
    }).events.length;

    // Get backup restores
    const backupRestores1h = auditLogger.readLogs({
      eventType: AuditEventType.BACKUP_RESTORE,
      startDate: oneHourAgo,
      limit: 1000,
    }).events.length;

    const backupRestores24h = auditLogger.readLogs({
      eventType: AuditEventType.BACKUP_RESTORE,
      startDate: twentyFourHoursAgo,
      limit: 1000,
    }).events.length;

    // Get audit log failures (using result=FAILURE)
    const auditFailures1h = auditLogger.readLogs({
      result: 'FAILURE',
      startDate: oneHourAgo,
      limit: 1000,
    }).events.length;

    const auditFailures24h = auditLogger.readLogs({
      result: 'FAILURE',
      startDate: twentyFourHoursAgo,
      limit: 1000,
    }).events.length;

    // Get critical events
    const criticalEvents1h = auditLogger.readLogs({
      severity: AuditSeverity.CRITICAL,
      startDate: oneHourAgo,
      limit: 1000,
    }).events.length;

    const criticalEvents24h = auditLogger.readLogs({
      severity: AuditSeverity.CRITICAL,
      startDate: twentyFourHoursAgo,
      limit: 1000,
    }).events.length;

    // Get alert stats
    const alertStats = alertManager.getAlertStats();

    return {
      failedLoginAttempts: {
        last15Minutes: failedLogins15m,
        last1Hour: failedLogins1h,
        last24Hours: failedLogins24h,
      },
      backupRestores: {
        last1Hour: backupRestores1h,
        last24Hours: backupRestores24h,
      },
      auditLogFailures: {
        last1Hour: auditFailures1h,
        last24Hours: auditFailures24h,
      },
      criticalEvents: {
        last1Hour: criticalEvents1h,
        last24Hours: criticalEvents24h,
      },
      activeAlerts: alertStats.active,
      totalAlerts: alertStats.total,
    };
  }

  /**
   * Manually trigger security checks
   */
  async triggerSecurityCheck(): Promise<void> {
    logger.info('Manually triggered security check');
    await this.performSecurityCheck();
  }
}

// Singleton instance
let securityMonitorInstance: SecurityMonitor | null = null;

export function getSecurityMonitor(config?: MonitoringConfig): SecurityMonitor {
  if (!securityMonitorInstance && config) {
    securityMonitorInstance = new SecurityMonitor(config);
  } else if (!securityMonitorInstance) {
    throw new Error('SecurityMonitor not initialized. Call with config first.');
  }
  return securityMonitorInstance;
}
