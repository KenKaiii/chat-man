/**
 * HIPAA/GDPR-Compliant Secure Logger
 * Automatically redacts PII/PHI from logs
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Log levels (aligned with syslog severity)
 */
export enum LogLevel {
  ERROR = 0,   // Error conditions
  WARN = 1,    // Warning conditions
  INFO = 2,    // Informational messages
  DEBUG = 3,   // Debug-level messages
}

/**
 * Configuration for logging
 */
export interface LoggerConfig {
  level: LogLevel;
  enableTimestamps: boolean;
  enableColors: boolean;
  redactContent: boolean; // Always redact message content
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableTimestamps: true,
  enableColors: true,
  redactContent: true, // Default to true for HIPAA compliance
};

/**
 * PII/PHI patterns to detect and redact
 */
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

  // Phone numbers (various formats)
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

  // US Social Security Numbers
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // IP addresses
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,

  // Common password patterns in JSON
  password: /(["'])(password|passwd|pwd)(["']\s*:\s*["'])[^"']+/gi,

  // API keys and tokens (common patterns)
  apiKey: /(api[_-]?key|token|bearer|authorization)[\s:="']+[\w\-.]+/gi,

  // Medical Record Numbers (MRN) - common patterns
  mrn: /\b(MRN|mrn|medical[\s_]?record[\s_]?number)[\s:#-]*\d{6,10}\b/gi,

  // Dates of birth
  dob: /\b(dob|date[\s_]?of[\s_]?birth)[\s:#-]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
};

/**
 * Sensitive field names that should be redacted
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'bearer',
  'ssn',
  'social_security',
  'creditCard',
  'credit_card',
  'cvv',
  'content', // Always redact message content
  'message',
  'text',
  'body',
  'data',
  'mrn',
  'medical_record_number',
  'dob',
  'date_of_birth',
  'address',
  'phone',
  'email',
]);

/**
 * Fields that are safe to log
 */
const SAFE_FIELDS = new Set([
  'type',
  'status',
  'method',
  'path',
  'statusCode',
  'timestamp',
  'duration',
  'mode',
  'model',
  'temperature',
  'success',
  'error_type',
  'level',
]);

class SecureLogger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Redact PII/PHI from a string
   */
  private redactPII(text: string): string {
    if (typeof text !== 'string') {
      return text;
    }

    let redacted = text;

    // Apply all PII patterns
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      redacted = redacted.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
    }

    return redacted;
  }

  /**
   * Redact sensitive fields from an object
   */
  private redactObject(obj: unknown, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > 5) {
      return '[MAX_DEPTH]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redactPII(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const redacted: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();

        // Check if this is a sensitive field
        if (SENSITIVE_FIELDS.has(keyLower)) {
          redacted[key] = '[REDACTED]';
          continue;
        }

        // Check if this is a safe field (don't redact)
        if (SAFE_FIELDS.has(keyLower)) {
          redacted[key] = value;
          continue;
        }

        // For IDs, only show partial (first 8 chars)
        if (keyLower.includes('id') || keyLower.includes('session')) {
          if (typeof value === 'string' && value.length > 8) {
            redacted[key] = value.substring(0, 8) + '...';
          } else {
            redacted[key] = value;
          }
          continue;
        }

        // Recursively redact nested objects
        redacted[key] = this.redactObject(value, depth + 1);
      }

      return redacted;
    }

    return obj;
  }

  /**
   * Format log message with timestamp and colors
   */
  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = this.config.enableTimestamps
      ? `[${new Date().toISOString()}] `
      : '';

    const levelStr = LogLevel[level].padEnd(5);

    let formatted = `${timestamp}${levelStr} ${message}`;

    if (data !== undefined) {
      const redactedData = this.redactObject(data);
      formatted += ` ${JSON.stringify(redactedData, null, 2)}`;
    }

    // Add colors if enabled (ANSI color codes)
    if (this.config.enableColors) {
      const colors = {
        [LogLevel.ERROR]: '\x1b[31m',   // Red
        [LogLevel.WARN]: '\x1b[33m',    // Yellow
        [LogLevel.INFO]: '\x1b[36m',    // Cyan
        [LogLevel.DEBUG]: '\x1b[90m',   // Gray
      };
      const reset = '\x1b[0m';
      formatted = `${colors[level]}${formatted}${reset}`;
    }

    return formatted;
  }

  /**
   * Log at specified level
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level <= this.config.level) {
      const formatted = this.formatMessage(level, message, data);

      if (level === LogLevel.ERROR) {
        console.error(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  /**
   * Log error message
   */
  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log with explicit safe data (bypasses some redaction)
   * Use ONLY for data you're certain contains no PII/PHI
   */
  infoSafe(message: string, safeData?: unknown): void {
    if (LogLevel.INFO <= this.config.level) {
      const timestamp = this.config.enableTimestamps
        ? `[${new Date().toISOString()}] `
        : '';

      let formatted = `${timestamp}INFO  ${message}`;

      if (safeData !== undefined) {
        formatted += ` ${JSON.stringify(safeData)}`;
      }

      console.log(formatted);
    }
  }
}

// Singleton instance
let loggerInstance: SecureLogger | null = null;

/**
 * Get the global logger instance
 */
export function getLogger(): SecureLogger {
  if (!loggerInstance) {
    loggerInstance = new SecureLogger();
  }
  return loggerInstance;
}

/**
 * Configure the global logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  if (!loggerInstance) {
    loggerInstance = new SecureLogger(config);
  } else {
    loggerInstance = new SecureLogger({ ...DEFAULT_CONFIG, ...config });
  }
}

// Export convenience functions
export const logger = {
  error: (message: string, data?: unknown) => getLogger().error(message, data),
  warn: (message: string, data?: unknown) => getLogger().warn(message, data),
  info: (message: string, data?: unknown) => getLogger().info(message, data),
  debug: (message: string, data?: unknown) => getLogger().debug(message, data),
  infoSafe: (message: string, data?: unknown) => getLogger().infoSafe(message, data),
  setLevel: (level: LogLevel) => getLogger().setLevel(level),
};

export default logger;
