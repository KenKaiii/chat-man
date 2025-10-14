/**
 * Authentication Middleware
 * Protects routes and WebSocket connections
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getSessionManager } from './sessionManager';
import { getPasswordManager } from './passwordManager';
import { logger } from '../utils/secureLogger';

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if authentication is required
 * Returns false if password is not set (first-time setup)
 */
export function isAuthenticationRequired(): boolean {
  const passwordManager = getPasswordManager();
  return passwordManager.isPasswordSet();
}

/**
 * Authenticate request with JWT token
 */
export function authenticateRequest(authHeader: string | null): {
  authenticated: boolean;
  sessionId?: string;
  error?: string;
} {
  // If password is not set, allow unauthenticated access (for initial setup)
  if (!isAuthenticationRequired()) {
    logger.debug('Authentication bypassed - password not set');
    return {
      authenticated: true,
      sessionId: 'setup-mode',
    };
  }

  // Extract token
  const token = extractBearerToken(authHeader);
  if (!token) {
    logger.warn('Authentication failed - no token provided');
    return {
      authenticated: false,
      error: 'No authentication token provided',
    };
  }

  // Validate token
  const sessionManager = getSessionManager();
  const validation = sessionManager.validateSessionToken(token);

  if (!validation.valid) {
    logger.warn('Authentication failed - invalid token', {
      error: validation.error,
    });
    return {
      authenticated: false,
      error: validation.error || 'Invalid token',
    };
  }

  logger.debug('Request authenticated', {
    sessionId: validation.sessionId?.substring(0, 8) + '...',
  });

  return {
    authenticated: true,
    sessionId: validation.sessionId,
  };
}

/**
 * Authenticate WebSocket connection
 */
export function authenticateWebSocket(url: string): {
  authenticated: boolean;
  sessionId?: string;
  error?: string;
} {
  // If password is not set, allow unauthenticated access
  if (!isAuthenticationRequired()) {
    logger.debug('WebSocket authentication bypassed - password not set');
    return {
      authenticated: true,
      sessionId: 'setup-mode',
    };
  }

  try {
    // Extract token from URL query parameter (?token=xxx)
    const urlObj = new URL(url, 'http://localhost');
    const token = urlObj.searchParams.get('token');

    if (!token) {
      logger.warn('WebSocket authentication failed - no token');
      return {
        authenticated: false,
        error: 'No authentication token provided',
      };
    }

    // Validate token
    const sessionManager = getSessionManager();
    const validation = sessionManager.validateSessionToken(token);

    if (!validation.valid) {
      logger.warn('WebSocket authentication failed - invalid token', {
        error: validation.error,
      });
      return {
        authenticated: false,
        error: validation.error || 'Invalid token',
      };
    }

    logger.info('WebSocket authenticated', {
      sessionId: validation.sessionId?.substring(0, 8) + '...',
    });

    return {
      authenticated: true,
      sessionId: validation.sessionId,
    };
  } catch (error) {
    logger.error('WebSocket authentication error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      authenticated: false,
      error: 'Authentication error',
    };
  }
}

/**
 * Rate limiting for authentication attempts
 */
class RateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Check if IP is rate limited
   */
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(ip);

    if (!record) {
      return false;
    }

    // Check if in lockout period
    if (record.count >= this.MAX_ATTEMPTS) {
      const timeSinceLastAttempt = now - record.lastAttempt;
      if (timeSinceLastAttempt < this.LOCKOUT_MS) {
        logger.warn('Rate limit enforced', { ip });
        return true;
      } else {
        // Lockout expired, reset
        this.attempts.delete(ip);
        return false;
      }
    }

    // Check if window expired
    const timeSinceLastAttempt = now - record.lastAttempt;
    if (timeSinceLastAttempt > this.WINDOW_MS) {
      // Window expired, reset
      this.attempts.delete(ip);
      return false;
    }

    return false;
  }

  /**
   * Record authentication attempt
   */
  recordAttempt(ip: string, success: boolean): void {
    const now = Date.now();
    const record = this.attempts.get(ip);

    if (success) {
      // Successful auth, clear attempts
      this.attempts.delete(ip);
      return;
    }

    if (!record) {
      // First failed attempt
      this.attempts.set(ip, { count: 1, lastAttempt: now });
      return;
    }

    // Check if window expired
    const timeSinceLastAttempt = now - record.lastAttempt;
    if (timeSinceLastAttempt > this.WINDOW_MS) {
      // Window expired, start fresh
      this.attempts.set(ip, { count: 1, lastAttempt: now });
      return;
    }

    // Increment attempt counter
    record.count++;
    record.lastAttempt = now;

    if (record.count >= this.MAX_ATTEMPTS) {
      logger.warn('Max authentication attempts exceeded', {
        ip,
        lockoutDuration: '1 hour',
      });
    }
  }

  /**
   * Clear rate limit for IP (admin override)
   */
  clearRateLimit(ip: string): void {
    this.attempts.delete(ip);
    logger.info('Rate limit cleared', { ip });
  }
}

// Singleton rate limiter
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Middleware for HTTP requests
 */
export function authMiddleware(
  request: Request
): { authenticated: boolean; sessionId?: string; error?: string; statusCode?: number } {
  // Check rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimiter = getRateLimiter();

  if (rateLimiter.isRateLimited(ip)) {
    return {
      authenticated: false,
      error: 'Too many authentication attempts. Please try again later.',
      statusCode: 429, // Too Many Requests
    };
  }

  // Authenticate
  const authHeader = request.headers.get('authorization');
  const result = authenticateRequest(authHeader);

  // Record attempt for rate limiting
  rateLimiter.recordAttempt(ip, result.authenticated);

  if (!result.authenticated) {
    return {
      ...result,
      statusCode: 401, // Unauthorized
    };
  }

  return result;
}
