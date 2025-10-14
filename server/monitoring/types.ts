/**
 * Monitoring Types and Interfaces
 * Production readiness - Security monitoring and alerting
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertType {
  BRUTE_FORCE_ATTACK = 'BRUTE_FORCE_ATTACK',
  MULTIPLE_BACKUP_RESTORES = 'MULTIPLE_BACKUP_RESTORES',
  AUDIT_LOG_FAILURE = 'AUDIT_LOG_FAILURE',
  BACKUP_FAILURE = 'BACKUP_FAILURE',
  RETENTION_CLEANUP_FAILURE = 'RETENTION_CLEANUP_FAILURE',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SYSTEM_HEALTH_CRITICAL = 'SYSTEM_HEALTH_CRITICAL',
  DISK_SPACE_LOW = 'DISK_SPACE_LOW',
  MEMORY_USAGE_HIGH = 'MEMORY_USAGE_HIGH',
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
}

export interface SecurityMetrics {
  failedLoginAttempts: {
    last15Minutes: number;
    last1Hour: number;
    last24Hours: number;
  };
  backupRestores: {
    last1Hour: number;
    last24Hours: number;
  };
  auditLogFailures: {
    last1Hour: number;
    last24Hours: number;
  };
  criticalEvents: {
    last1Hour: number;
    last24Hours: number;
  };
  activeAlerts: number;
  totalAlerts: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  alertWebhookUrl: string | null;
  failedLoginThreshold: number;
  backupRestoreThreshold: number;
  checkIntervalMinutes: number;
  retainAlertsForDays: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthStatus;
    encryption: HealthStatus;
    backup: HealthStatus;
    audit: HealthStatus;
    diskSpace: HealthStatus;
    memory: HealthStatus;
    ollama: HealthStatus;
  };
  timestamp: string;
}

export interface HealthStatus {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  uptime: number;
  requests: {
    total: number;
    perSecond: number;
    byEndpoint: Record<string, number>;
  };
  authentication: {
    successfulLogins: number;
    failedLogins: number;
    activeSession: number;
  };
  backups: {
    totalCreated: number;
    successful: number;
    failed: number;
    lastBackupTime: string | null;
  };
  audit: {
    totalEvents: number;
    failedWrites: number;
    lastEventTime: string | null;
  };
  sessions: {
    total: number;
    active: number;
  };
  websocket: {
    activeConnections: number;
    totalConnections: number;
  };
}
