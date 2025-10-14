/**
 * Metrics Collection System
 * Prometheus-compatible metrics for monitoring
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { SystemMetrics } from './types';
import { getAuditLogger } from '../audit/auditLogger';
import { AuditEventType } from '../audit/auditEvents';

export class MetricsCollector {
  private startTime: number = Date.now();
  private requestCounts: Map<string, number> = new Map();
  private activeWebSocketConnections: number = 0;
  private totalWebSocketConnections: number = 0;

  /**
   * Record an API request
   */
  recordRequest(endpoint: string): void {
    const count = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, count + 1);
  }

  /**
   * Record WebSocket connection
   */
  recordWebSocketConnect(): void {
    this.activeWebSocketConnections++;
    this.totalWebSocketConnections++;
  }

  /**
   * Record WebSocket disconnection
   */
  recordWebSocketDisconnect(): void {
    this.activeWebSocketConnections = Math.max(0, this.activeWebSocketConnections - 1);
  }

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics {
    const auditLogger = getAuditLogger();
    const auditStats = auditLogger.getStats();

    // Calculate uptime
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Calculate total requests
    let totalRequests = 0;
    const byEndpoint: Record<string, number> = {};
    for (const [endpoint, count] of this.requestCounts.entries()) {
      totalRequests += count;
      byEndpoint[endpoint] = count;
    }

    // Calculate requests per second
    const perSecond = uptime > 0 ? Number((totalRequests / uptime).toFixed(2)) : 0;

    // Get authentication stats
    const successfulLogins = auditLogger.readLogs({
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      limit: 10000,
    }).events.length;

    const failedLogins = auditLogger.readLogs({
      eventType: AuditEventType.AUTH_LOGIN_FAILED,
      limit: 10000,
    }).events.length;

    // Get backup stats
    const backupEvents = auditLogger.readLogs({
      eventType: AuditEventType.BACKUP_CREATE,
      limit: 10000,
    }).events;

    const successfulBackups = backupEvents.filter(e => e.result === 'SUCCESS').length;
    const failedBackups = backupEvents.filter(e => e.result === 'FAILURE').length;
    const lastBackupTime = backupEvents.length > 0 ? backupEvents[0].timestamp : null;

    // Get session stats (would require database query in full implementation)
    const sessionCount = auditLogger.readLogs({
      eventType: AuditEventType.SESSION_CREATE,
      limit: 10000,
    }).events.length;

    return {
      uptime,
      requests: {
        total: totalRequests,
        perSecond,
        byEndpoint,
      },
      authentication: {
        successfulLogins,
        failedLogins,
        activeSession: 0, // Would require session tracking
      },
      backups: {
        totalCreated: backupEvents.length,
        successful: successfulBackups,
        failed: failedBackups,
        lastBackupTime,
      },
      audit: {
        totalEvents: auditStats.totalEvents,
        failedWrites: 0, // Would require tracking
        lastEventTime: auditStats.totalEvents > 0 ? new Date().toISOString() : null,
      },
      sessions: {
        total: sessionCount,
        active: 0, // Would require tracking
      },
      websocket: {
        activeConnections: this.activeWebSocketConnections,
        totalConnections: this.totalWebSocketConnections,
      },
    };
  }

  /**
   * Get Prometheus-formatted metrics
   */
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Uptime
    lines.push('# HELP chatman_uptime_seconds Application uptime in seconds');
    lines.push('# TYPE chatman_uptime_seconds counter');
    lines.push(`chatman_uptime_seconds ${metrics.uptime}`);

    // Requests
    lines.push('# HELP chatman_requests_total Total number of requests');
    lines.push('# TYPE chatman_requests_total counter');
    lines.push(`chatman_requests_total ${metrics.requests.total}`);

    // WebSocket connections
    lines.push('# HELP chatman_websocket_active Active WebSocket connections');
    lines.push('# TYPE chatman_websocket_active gauge');
    lines.push(`chatman_websocket_active ${metrics.websocket.activeConnections}`);

    // Audit events
    lines.push('# HELP chatman_audit_events_total Total audit events');
    lines.push('# TYPE chatman_audit_events_total counter');
    lines.push(`chatman_audit_events_total ${metrics.audit.totalEvents}`);

    return lines.join('\n');
  }
}

// Singleton instance
let metricsCollectorInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new MetricsCollector();
  }
  return metricsCollectorInstance;
}
