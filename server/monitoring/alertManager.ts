/**
 * Alert Manager - Security Alert Handling and Notifications
 * Production readiness - Alert routing and notification system
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SecurityAlert, AlertType, AlertSeverity, MonitoringConfig } from './types';
import { logger } from '../utils/secureLogger';
import { logAuditEvent } from '../audit/auditLogger';
import { AuditEventType, AuditSeverity } from '../audit/auditEvents';

const ALERTS_DIR = join(process.cwd(), 'data', 'alerts');
const ALERTS_FILE = join(ALERTS_DIR, 'alerts.json');
const MAX_ALERTS_RETAINED = 10000;

export class AlertManager {
  private alerts: SecurityAlert[] = [];
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;

    // Ensure alerts directory exists
    if (!existsSync(ALERTS_DIR)) {
      mkdirSync(ALERTS_DIR, { recursive: true });
      logger.info('Created alerts directory', { path: ALERTS_DIR });
    }

    // Load existing alerts
    this.loadAlerts();
  }

  /**
   * Load alerts from file
   */
  private loadAlerts(): void {
    try {
      if (existsSync(ALERTS_FILE)) {
        const data = readFileSync(ALERTS_FILE, 'utf-8');
        this.alerts = JSON.parse(data);
        logger.info('Loaded security alerts', { count: this.alerts.length });
      } else {
        this.alerts = [];
      }
    } catch (error) {
      logger.error('Failed to load alerts', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      this.alerts = [];
    }
  }

  /**
   * Save alerts to file
   */
  private saveAlerts(): void {
    try {
      // Keep only recent alerts (retention policy)
      const retentionMs = this.config.retainAlertsForDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      this.alerts = this.alerts.filter(alert => {
        const alertTime = new Date(alert.timestamp).getTime();
        return now - alertTime < retentionMs;
      });

      // Limit total alerts
      if (this.alerts.length > MAX_ALERTS_RETAINED) {
        this.alerts = this.alerts.slice(-MAX_ALERTS_RETAINED);
      }

      writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      logger.error('Failed to save alerts', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Create and send a security alert
   */
  async sendAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    details: Record<string, unknown> = {}
  ): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      details,
      resolved: false,
    };

    // Add to alerts list
    this.alerts.push(alert);
    this.saveAlerts();

    // Log to audit trail
    logAuditEvent(
      AuditEventType.SECURITY_ALERT,
      'SUCCESS',
      {
        alertId: alert.id,
        type,
        severity,
        // message: Not logged (may contain sensitive details)
      },
      undefined,
      severity === 'CRITICAL' || severity === 'HIGH' ? AuditSeverity.CRITICAL : AuditSeverity.WARNING
    );

    // Log to console
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      logger.warn(`Security Alert [${severity}]: ${message}`, { type, details });
    } else {
      logger.info(`Security Alert [${severity}]: ${message}`, { type });
    }

    // Send webhook notification if configured
    if (this.config.alertWebhookUrl) {
      this.sendWebhookNotification(alert).catch(error => {
        logger.error('Failed to send webhook notification', {
          error: error instanceof Error ? error.message : 'Unknown',
          alertId: alert.id,
        });
      });
    }

    return alert;
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: SecurityAlert): Promise<void> {
    try {
      const webhookUrl = this.config.alertWebhookUrl;
      if (!webhookUrl) return;

      const payload = {
        alert_id: alert.id,
        timestamp: alert.timestamp,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        details: alert.details,
        resolved: alert.resolved,
        application: 'Chat Man',
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Chat-Man-Alert-System/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      logger.info('Sent webhook notification', {
        alertId: alert.id,
        webhookUrl: webhookUrl.substring(0, 30) + '...',
      });
    } catch (error) {
      logger.error('Webhook notification failed', {
        error: error instanceof Error ? error.message : 'Unknown',
        alertId: alert.id,
      });
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    this.saveAlerts();

    logger.info('Resolved security alert', { alertId });
    return true;
  }

  /**
   * Get recent alerts with filtering
   */
  getAlerts(options: {
    limit?: number;
    severity?: AlertSeverity;
    type?: AlertType;
    resolved?: boolean;
  } = {}): SecurityAlert[] {
    let filtered = [...this.alerts];

    if (options.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }

    if (options.resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === options.resolved);
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    last24Hours: number;
  } {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let last24Hours = 0;

    for (const alert of this.alerts) {
      // Count by severity
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;

      // Count by type
      byType[alert.type] = (byType[alert.type] || 0) + 1;

      // Count recent alerts
      const alertTime = new Date(alert.timestamp).getTime();
      if (alertTime >= twentyFourHoursAgo) {
        last24Hours++;
      }
    }

    return {
      total: this.alerts.length,
      active: this.alerts.filter(a => !a.resolved).length,
      resolved: this.alerts.filter(a => a.resolved).length,
      bySeverity,
      byType,
      last24Hours,
    };
  }

  /**
   * Clear old resolved alerts (maintenance)
   */
  clearOldAlerts(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const originalCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert => {
      // Keep unresolved alerts
      if (!alert.resolved) return true;

      // Keep recent resolved alerts
      const alertTime = new Date(alert.timestamp).getTime();
      return alertTime >= cutoffTime;
    });

    const deletedCount = originalCount - this.alerts.length;

    if (deletedCount > 0) {
      this.saveAlerts();
      logger.info('Cleared old resolved alerts', {
        deletedCount,
        remaining: this.alerts.length,
      });
    }

    return deletedCount;
  }
}

// Singleton instance
let alertManagerInstance: AlertManager | null = null;

export function getAlertManager(config?: MonitoringConfig): AlertManager {
  if (!alertManagerInstance && config) {
    alertManagerInstance = new AlertManager(config);
  } else if (!alertManagerInstance) {
    throw new Error('AlertManager not initialized. Call with config first.');
  }
  return alertManagerInstance;
}
