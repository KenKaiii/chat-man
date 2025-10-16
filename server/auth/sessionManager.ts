/**
 * JWT Session Management
 * Manages authentication tokens and sessions
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as jwt from 'jsonwebtoken';
import { getKeyManager } from '../encryption/keyManager';
import { logger } from '../utils/secureLogger';

interface SessionPayload {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
}

interface TokenValidationResult {
  valid: boolean;
  sessionId?: string;
  error?: string;
}

export class SessionManager {
  private jwtSecret: string;
  private readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes (HIPAA §164.312(a)(2)(iii))

  constructor() {
    // Generate JWT secret from encryption key manager
    // If key manager isn't initialized yet, use a temporary generated secret
    try {
      const keyManager = getKeyManager();
      this.jwtSecret = keyManager.generateJWTSecret();
    } catch (_error) {
      // Key manager not initialized yet - generate temporary secret
      // This will be replaced once key manager is properly initialized
      this.jwtSecret = crypto.randomBytes(64).toString('base64');
      logger.warn('Using temporary JWT secret - key manager not initialized');
    }
  }

  /**
   * Create a new session token
   */
  createSessionToken(): string {
    const now = Date.now();
    const sessionId = crypto.randomUUID();

    const payload: SessionPayload = {
      sessionId,
      createdAt: now,
      expiresAt: now + this.TOKEN_EXPIRY,
      lastActivity: now,
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h',
      algorithm: 'HS512', // HMAC SHA-512
    });

    logger.info('Session token created', {
      sessionId: sessionId.substring(0, 8) + '...',
      expiresIn: '24h',
    });

    return token;
  }

  /**
   * Validate session token
   */
  validateSessionToken(token: string): TokenValidationResult {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS512'],
      }) as SessionPayload;

      const now = Date.now();

      // Check if token is expired
      if (decoded.expiresAt < now) {
        logger.warn('Session token expired');
        return {
          valid: false,
          error: 'Token expired',
        };
      }

      // Check if session has exceeded maximum duration
      if (now - decoded.createdAt > this.MAX_SESSION_DURATION) {
        logger.warn('Session exceeded maximum duration');
        return {
          valid: false,
          error: 'Session expired - maximum duration exceeded',
        };
      }

      // Check for inactivity timeout (HIPAA §164.312(a)(2)(iii))
      if (now - decoded.lastActivity > this.INACTIVITY_TIMEOUT) {
        logger.warn('Session timed out due to inactivity', {
          sessionId: decoded.sessionId.substring(0, 8) + '...',
          inactiveForMs: now - decoded.lastActivity,
        });
        return {
          valid: false,
          error: 'Session timed out due to inactivity',
        };
      }

      logger.debug('Session token validated', {
        sessionId: decoded.sessionId.substring(0, 8) + '...',
      });

      return {
        valid: true,
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid session token', {
          error: error.message,
        });
        return {
          valid: false,
          error: 'Invalid token',
        };
      }

      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Session token expired');
        return {
          valid: false,
          error: 'Token expired',
        };
      }

      logger.error('Error validating session token', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return {
        valid: false,
        error: 'Validation error',
      };
    }
  }

  /**
   * Refresh session token (extend expiry)
   */
  refreshSessionToken(token: string): string | null {
    const validation = this.validateSessionToken(token);

    if (!validation.valid || !validation.sessionId) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as SessionPayload;

      const now = Date.now();

      // Only refresh if session hasn't exceeded max duration
      if (now - decoded.createdAt > this.MAX_SESSION_DURATION) {
        logger.warn('Cannot refresh - session exceeded maximum duration');
        return null;
      }

      const newPayload: SessionPayload = {
        sessionId: decoded.sessionId,
        createdAt: decoded.createdAt, // Keep original creation time
        expiresAt: now + this.TOKEN_EXPIRY, // Extend expiry
        lastActivity: now, // Reset activity timestamp
      };

      const newToken = jwt.sign(newPayload, this.jwtSecret, {
        expiresIn: '24h',
        algorithm: 'HS512',
      });

      logger.info('Session token refreshed', {
        sessionId: decoded.sessionId.substring(0, 8) + '...',
      });

      return newToken;
    } catch (error) {
      logger.error('Error refreshing session token', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): SessionPayload | null {
    try {
      const decoded = jwt.decode(token) as SessionPayload;
      return decoded;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Revoke all sessions (by rotating JWT secret)
   * This invalidates all existing tokens
   */
  revokeAllSessions(): void {
    // Re-generate JWT secret
    try {
      const keyManager = getKeyManager();
      this.jwtSecret = keyManager.generateJWTSecret();
    } catch (_error) {
      // Key manager not initialized - generate new temporary secret
      this.jwtSecret = crypto.randomBytes(64).toString('base64');
      logger.warn('Using temporary JWT secret for session revocation');
    }

    logger.warn('All sessions revoked - JWT secret rotated');
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
