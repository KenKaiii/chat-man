/**
 * DSR Identity Verification System
 * GDPR Article 12(6) - Identity Verification for Data Subject Requests
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { logger } from '../utils/secureLogger';
import { logAuditEvent } from '../audit/auditLogger';
import { AuditEventType, AuditSeverity } from '../audit/auditEvents';

const VERIFICATION_DB_PATH = join(process.cwd(), 'data', 'dsr-verification.db');

/**
 * Verification token interface
 */
export interface VerificationToken {
  id: string;
  email: string;
  code: string;
  dsr_request_id?: string;
  created_at: string;
  expires_at: string;
  verified_at?: string;
  attempts: number;
  ip_address?: string;
}

/**
 * DSR Identity Verifier
 * Implements multi-factor verification for DSR requests
 */
export class DSRIdentityVerifier {
  private db: Database;
  private readonly TOKEN_EXPIRY_MINUTES = 30;
  private readonly MAX_VERIFICATION_ATTEMPTS = 5;
  private readonly CODE_LENGTH = 6;

  constructor() {
    this.db = new Database(VERIFICATION_DB_PATH);
    this.initializeDatabase();
  }

  /**
   * Initialize verification database
   */
  private initializeDatabase(): void {
    // Create verification tokens table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        dsr_request_id TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        verified_at TEXT,
        attempts INTEGER DEFAULT 0,
        ip_address TEXT
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_verification_email
      ON verification_tokens(email)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_verification_expires
      ON verification_tokens(expires_at)
    `);

    // Create rate limiting table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verification_rate_limit (
        email TEXT PRIMARY KEY,
        request_count INTEGER DEFAULT 0,
        window_start TEXT NOT NULL,
        last_request TEXT NOT NULL
      )
    `);

    logger.info('DSR identity verification database initialized');
  }

  /**
   * Generate a secure verification code
   */
  private generateVerificationCode(): string {
    // Generate cryptographically secure random code
    const buffer = randomBytes(this.CODE_LENGTH);
    let code = '';

    // Convert to 6-digit numeric code
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += (buffer[i] % 10).toString();
    }

    return code;
  }

  /**
   * Check rate limiting for email address
   * Returns true if rate limit exceeded
   */
  private checkRateLimit(email: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour window
    const maxRequests = 5; // Max 5 verification requests per hour

    const row = this.db.query(
      'SELECT * FROM verification_rate_limit WHERE email = ?'
    ).get(email) as any;

    if (!row) {
      // First request from this email
      this.db.run(
        `INSERT INTO verification_rate_limit
        (email, request_count, window_start, last_request)
        VALUES (?, ?, ?, ?)`,
        [email, 1, new Date(now).toISOString(), new Date(now).toISOString()]
      );
      return false;
    }

    const windowStart = new Date(row.window_start).getTime();

    // Check if window has expired
    if (now - windowStart > windowMs) {
      // Reset window
      this.db.run(
        `UPDATE verification_rate_limit
        SET request_count = 1, window_start = ?, last_request = ?
        WHERE email = ?`,
        [new Date(now).toISOString(), new Date(now).toISOString(), email]
      );
      return false;
    }

    // Within window - check count
    if (row.request_count >= maxRequests) {
      logger.warn('DSR verification rate limit exceeded', {
        email: this.maskEmail(email),
        count: row.request_count,
        windowStart: row.window_start,
      });

      // Audit log
      logAuditEvent(
        AuditEventType.AUTH_LOGIN_FAILED,
        'FAILURE',
        {
          action: 'dsr_verification_rate_limit',
          email: this.maskEmail(email),
          attempts: row.request_count,
        },
        undefined,
        AuditSeverity.CRITICAL
      );

      return true;
    }

    // Increment count
    this.db.run(
      `UPDATE verification_rate_limit
      SET request_count = request_count + 1, last_request = ?
      WHERE email = ?`,
      [new Date(now).toISOString(), email]
    );

    return false;
  }

  /**
   * Mask email for logging (GDPR privacy)
   */
  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!user || !domain) return '***@***';

    const maskedUser = user.length > 2
      ? user.substring(0, 2) + '***'
      : '***';
    const maskedDomain = domain.length > 2
      ? '***' + domain.substring(domain.length - 2)
      : '***';

    return `${maskedUser}@${maskedDomain}`;
  }

  /**
   * Create verification token and send code
   * Returns token ID for tracking
   */
  async createVerificationToken(
    email: string,
    dsrRequestId?: string,
    ipAddress?: string
  ): Promise<{ tokenId: string; code: string } | { error: string }> {
    // Check rate limiting
    if (this.checkRateLimit(email)) {
      return {
        error: 'Too many verification requests. Please try again in 1 hour.',
      };
    }

    // Invalidate any existing tokens for this email
    this.db.run(
      'DELETE FROM verification_tokens WHERE email = ? AND verified_at IS NULL',
      [email]
    );

    const tokenId = crypto.randomUUID();
    const code = this.generateVerificationCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000);

    this.db.run(
      `INSERT INTO verification_tokens (
        id, email, code, dsr_request_id, created_at, expires_at,
        attempts, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenId,
        email,
        code,
        dsrRequestId || null,
        now.toISOString(),
        expiresAt.toISOString(),
        0,
        ipAddress || null,
      ]
    );

    // Audit log
    logAuditEvent(
      AuditEventType.DATA_ACCESS,
      'SUCCESS',
      {
        action: 'dsr_verification_token_created',
        email: this.maskEmail(email),
        tokenId: tokenId.substring(0, 8) + '...',
        expiresAt: expiresAt.toISOString(),
        dsrRequestId: dsrRequestId ? dsrRequestId.substring(0, 8) + '...' : undefined,
      },
      undefined,
      AuditSeverity.WARNING
    );

    logger.info('DSR verification token created', {
      tokenId: tokenId.substring(0, 8) + '...',
      email: this.maskEmail(email),
      expiresInMinutes: this.TOKEN_EXPIRY_MINUTES,
    });

    // In a real implementation, you would send this code via email
    // For now, we return it for testing purposes
    logger.info('⚠️  VERIFICATION CODE (implement email sending):', { code });

    return { tokenId, code };
  }

  /**
   * Verify a token with provided code
   */
  verifyToken(
    tokenId: string,
    code: string,
    ipAddress?: string
  ): { verified: boolean; error?: string; email?: string } {
    const token = this.db.query(
      'SELECT * FROM verification_tokens WHERE id = ?'
    ).get(tokenId) as any;

    if (!token) {
      logger.warn('DSR verification token not found', { tokenId: tokenId.substring(0, 8) + '...' });

      logAuditEvent(
        AuditEventType.AUTH_LOGIN_FAILED,
        'FAILURE',
        {
          action: 'dsr_verification_failed',
          reason: 'token_not_found',
          tokenId: tokenId.substring(0, 8) + '...',
        },
        undefined,
        AuditSeverity.WARNING
      );

      return { verified: false, error: 'Invalid verification token' };
    }

    // Check if already verified
    if (token.verified_at) {
      return { verified: true, email: token.email };
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    if (now > expiresAt) {
      logger.warn('DSR verification token expired', {
        tokenId: tokenId.substring(0, 8) + '...',
        email: this.maskEmail(token.email),
      });

      logAuditEvent(
        AuditEventType.AUTH_LOGIN_FAILED,
        'FAILURE',
        {
          action: 'dsr_verification_failed',
          reason: 'token_expired',
          email: this.maskEmail(token.email),
        },
        undefined,
        AuditSeverity.INFO
      );

      return { verified: false, error: 'Verification code has expired' };
    }

    // Check max attempts
    if (token.attempts >= this.MAX_VERIFICATION_ATTEMPTS) {
      logger.warn('DSR verification max attempts exceeded', {
        tokenId: tokenId.substring(0, 8) + '...',
        email: this.maskEmail(token.email),
        attempts: token.attempts,
      });

      logAuditEvent(
        AuditEventType.AUTH_LOGIN_FAILED,
        'FAILURE',
        {
          action: 'dsr_verification_failed',
          reason: 'max_attempts_exceeded',
          email: this.maskEmail(token.email),
          attempts: token.attempts,
        },
        undefined,
        AuditSeverity.CRITICAL
      );

      return { verified: false, error: 'Maximum verification attempts exceeded' };
    }

    // Verify code
    if (token.code !== code) {
      // Increment attempts
      this.db.run(
        'UPDATE verification_tokens SET attempts = attempts + 1 WHERE id = ?',
        [tokenId]
      );

      logger.warn('DSR verification code mismatch', {
        tokenId: tokenId.substring(0, 8) + '...',
        email: this.maskEmail(token.email),
        attempts: token.attempts + 1,
      });

      logAuditEvent(
        AuditEventType.AUTH_LOGIN_FAILED,
        'FAILURE',
        {
          action: 'dsr_verification_failed',
          reason: 'invalid_code',
          email: this.maskEmail(token.email),
          attempts: token.attempts + 1,
        },
        undefined,
        AuditSeverity.WARNING
      );

      return { verified: false, error: 'Invalid verification code' };
    }

    // Success! Mark as verified
    this.db.run(
      'UPDATE verification_tokens SET verified_at = ? WHERE id = ?',
      [now.toISOString(), tokenId]
    );

    logAuditEvent(
      AuditEventType.DATA_ACCESS,
      'SUCCESS',
      {
        action: 'dsr_verification_success',
        email: this.maskEmail(token.email),
        tokenId: tokenId.substring(0, 8) + '...',
        dsrRequestId: token.dsr_request_id ? token.dsr_request_id.substring(0, 8) + '...' : undefined,
      },
      undefined,
      AuditSeverity.WARNING
    );

    logger.info('DSR verification successful', {
      tokenId: tokenId.substring(0, 8) + '...',
      email: this.maskEmail(token.email),
    });

    return { verified: true, email: token.email };
  }

  /**
   * Check if a token is verified
   */
  isTokenVerified(tokenId: string): boolean {
    const token = this.db.query(
      'SELECT verified_at FROM verification_tokens WHERE id = ?'
    ).get(tokenId) as any;

    return token && token.verified_at !== null;
  }

  /**
   * Get verification token by ID
   */
  getToken(tokenId: string): VerificationToken | null {
    const token = this.db.query(
      'SELECT * FROM verification_tokens WHERE id = ?'
    ).get(tokenId) as any;

    if (!token) return null;

    return {
      ...token,
      verified_at: token.verified_at || undefined,
      dsr_request_id: token.dsr_request_id || undefined,
      ip_address: token.ip_address || undefined,
    };
  }

  /**
   * Clean up expired tokens (called periodically)
   */
  cleanupExpiredTokens(): number {
    const now = new Date().toISOString();

    // Delete expired unverified tokens
    const result = this.db.run(
      'DELETE FROM verification_tokens WHERE expires_at < ? AND verified_at IS NULL',
      [now]
    );

    if (result.changes > 0) {
      logger.info('Cleaned up expired DSR verification tokens', {
        deletedCount: result.changes,
      });
    }

    return result.changes;
  }

  /**
   * Get verification statistics
   */
  getStatistics(): {
    totalTokens: number;
    verifiedTokens: number;
    expiredTokens: number;
    averageVerificationTimeSeconds: number;
  } {
    const stats = {
      totalTokens: 0,
      verifiedTokens: 0,
      expiredTokens: 0,
      averageVerificationTimeSeconds: 0,
    };

    // Total tokens
    const totalRow = this.db.query('SELECT COUNT(*) as count FROM verification_tokens').get() as any;
    stats.totalTokens = totalRow.count;

    // Verified tokens
    const verifiedRow = this.db.query(
      'SELECT COUNT(*) as count FROM verification_tokens WHERE verified_at IS NOT NULL'
    ).get() as any;
    stats.verifiedTokens = verifiedRow.count;

    // Expired tokens
    const now = new Date().toISOString();
    const expiredRow = this.db.query(
      'SELECT COUNT(*) as count FROM verification_tokens WHERE expires_at < ? AND verified_at IS NULL'
    ).get(now) as any;
    stats.expiredTokens = expiredRow.count;

    // Average verification time
    const timingRows = this.db.query(`
      SELECT created_at, verified_at
      FROM verification_tokens
      WHERE verified_at IS NOT NULL
    `).all() as Array<{ created_at: string; verified_at: string }>;

    if (timingRows.length > 0) {
      const totalSeconds = timingRows.reduce((sum, row) => {
        const created = new Date(row.created_at);
        const verified = new Date(row.verified_at);
        return sum + (verified.getTime() - created.getTime()) / 1000;
      }, 0);
      stats.averageVerificationTimeSeconds = Math.round(totalSeconds / timingRows.length);
    }

    return stats;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let verifierInstance: DSRIdentityVerifier | null = null;

export function getDSRIdentityVerifier(): DSRIdentityVerifier {
  if (!verifierInstance) {
    verifierInstance = new DSRIdentityVerifier();
  }
  return verifierInstance;
}
