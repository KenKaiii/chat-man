/**
 * Audit Event Types
 * HIPAA Security Rule - Audit Controls (§164.312(b))
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Audit event types for critical operations
 */
export enum AuditEventType {
  // Authentication events
  AUTH_SETUP = 'AUTH_SETUP',
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  AUTH_PASSWORD_CHANGE = 'AUTH_PASSWORD_CHANGE',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_LOGOUT = 'AUTH_LOGOUT',

  // Data management events
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_DELETE_ALL = 'DATA_DELETE_ALL',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFY = 'DATA_MODIFY',
  SESSION_CREATE = 'SESSION_CREATE',
  SESSION_DELETE = 'SESSION_DELETE',
  SESSION_VIEW = 'SESSION_VIEW',

  // Backup events
  BACKUP_CREATE = 'BACKUP_CREATE',
  BACKUP_RESTORE = 'BACKUP_RESTORE',
  BACKUP_DELETE = 'BACKUP_DELETE',
  BACKUP_VERIFY = 'BACKUP_VERIFY',
  BACKUP_TEST_RESTORE = 'BACKUP_TEST_RESTORE',

  // Retention events
  RETENTION_CLEANUP = 'RETENTION_CLEANUP',

  // System events
  SERVER_START = 'SERVER_START',
  SERVER_STOP = 'SERVER_STOP',
  CONFIG_RELOAD = 'CONFIG_RELOAD',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  WEBSOCKET_CONNECT = 'WEBSOCKET_CONNECT',
  WEBSOCKET_DISCONNECT = 'WEBSOCKET_DISCONNECT',

  // Error events
  ERROR_ENCRYPTION = 'ERROR_ENCRYPTION',
  ERROR_DATABASE = 'ERROR_DATABASE',
  ERROR_AUTHENTICATION = 'ERROR_AUTHENTICATION',
  ERROR_VALIDATION = 'ERROR_VALIDATION',
  ERROR_NOT_FOUND = 'ERROR_NOT_FOUND',

  // Monitoring events
  SECURITY_ALERT = 'SECURITY_ALERT',
  HEALTH_CHECK = 'HEALTH_CHECK',
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',           // Informational events
  WARNING = 'WARNING',     // Warning conditions
  CRITICAL = 'CRITICAL',   // Critical security events
}

/**
 * Audit event structure
 */
export interface AuditEvent {
  timestamp: string;
  event: AuditEventType;
  severity: AuditSeverity;
  user?: string;        // User ID or identifier (if applicable)
  details?: Record<string, unknown>; // Additional event details (no PII/PHI)
  result: 'SUCCESS' | 'FAILURE';
  ip?: string;          // IP address (for network events)
}

/**
 * Get default severity for event type
 */
export function getDefaultSeverity(eventType: AuditEventType): AuditSeverity {
  // Critical events (authentication failures, data deletions)
  const criticalEvents = [
    AuditEventType.AUTH_LOGIN_FAILED,
    AuditEventType.AUTH_PASSWORD_CHANGE,
    AuditEventType.DATA_DELETE_ALL,
    AuditEventType.BACKUP_RESTORE,
    AuditEventType.ERROR_ENCRYPTION,
    AuditEventType.ERROR_DATABASE,
    AuditEventType.ERROR_AUTHENTICATION,
    AuditEventType.ERROR_NOT_FOUND,
  ];

  // Warning events (session expirations, backups, settings changes)
  const warningEvents = [
    AuditEventType.AUTH_SESSION_EXPIRED,
    AuditEventType.BACKUP_CREATE,
    AuditEventType.BACKUP_DELETE,
    AuditEventType.RETENTION_CLEANUP,
    AuditEventType.CONFIG_RELOAD,
    AuditEventType.SETTINGS_CHANGE,
    AuditEventType.DATA_MODIFY,
    AuditEventType.ERROR_VALIDATION,
  ];

  if (criticalEvents.includes(eventType)) {
    return AuditSeverity.CRITICAL;
  } else if (warningEvents.includes(eventType)) {
    return AuditSeverity.WARNING;
  } else {
    return AuditSeverity.INFO;
  }
}
