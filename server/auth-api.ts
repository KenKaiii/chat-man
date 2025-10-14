/**
 * Authentication API Endpoints
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getPasswordManager } from './auth/passwordManager';
import { getSessionManager } from './auth/sessionManager';
import { getRateLimiter } from './auth/middleware';
import { logger } from './utils/secureLogger';

/**
 * POST /api/auth/setup - Initial password setup
 */
export async function handleAuthSetup(req: Request): Promise<Response> {
  try {
    const { password } = await req.json() as { password: string };

    const passwordManager = getPasswordManager();

    if (passwordManager.isPasswordSet()) {
      return Response.json(
        { error: 'Password already set' },
        { status: 400 }
      );
    }

    await passwordManager.setPassword(password);

    // Create initial session token
    const sessionManager = getSessionManager();
    const token = sessionManager.createSessionToken();

    logger.info('Initial password setup completed');

    return Response.json({
      success: true,
      token,
      message: 'Password set successfully',
    });
  } catch (error) {
    logger.error('Auth setup failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return Response.json(
      { error: error instanceof Error ? error.message : 'Setup failed' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/auth/login - Login with password
 */
export async function handleAuthLogin(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateLimiter = getRateLimiter();

  // Check rate limiting
  if (rateLimiter.isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const { password } = await req.json() as { password: string };

    const passwordManager = getPasswordManager();

    if (!passwordManager.isPasswordSet()) {
      return Response.json(
        { error: 'Password not set. Complete setup first.' },
        { status: 400 }
      );
    }

    const isValid = await passwordManager.verifyPassword(password);

    // Record attempt
    rateLimiter.recordAttempt(ip, isValid);

    if (!isValid) {
      return Response.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create session token
    const sessionManager = getSessionManager();
    const token = sessionManager.createSessionToken();

    logger.info('User logged in successfully');

    return Response.json({
      success: true,
      token,
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('Login failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return Response.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/change-password - Change password
 */
export async function handleAuthChangePassword(req: Request): Promise<Response> {
  try {
    const { oldPassword, newPassword } = await req.json() as {
      oldPassword: string;
      newPassword: string;
    };

    const passwordManager = getPasswordManager();
    const success = await passwordManager.changePassword(oldPassword, newPassword);

    if (!success) {
      return Response.json(
        { error: 'Incorrect old password' },
        { status: 401 }
      );
    }

    logger.info('Password changed successfully');

    return Response.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Password change failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return Response.json(
      { error: error instanceof Error ? error.message : 'Password change failed' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/auth/refresh - Refresh session token
 */
export async function handleAuthRefresh(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const sessionManager = getSessionManager();
    const newToken = sessionManager.refreshSessionToken(token);

    if (!newToken) {
      return Response.json(
        { error: 'Cannot refresh token' },
        { status: 401 }
      );
    }

    return Response.json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    logger.error('Token refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return Response.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/validate - Validate session token
 */
export async function handleAuthValidate(req: Request): Promise<Response> {
  try {
    const { token } = await req.json() as { token: string };

    if (!token) {
      return Response.json(
        { valid: false, error: 'No token provided' },
        { status: 400 }
      );
    }

    const sessionManager = getSessionManager();
    const validation = sessionManager.validateSessionToken(token);

    if (!validation.valid) {
      return Response.json({
        valid: false,
        error: validation.error,
      });
    }

    return Response.json({
      valid: true,
      sessionId: validation.sessionId,
    });
  } catch (error) {
    logger.error('Token validation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return Response.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/status - Check auth status
 */
export async function handleAuthStatus(_req: Request): Promise<Response> {
  const passwordManager = getPasswordManager();
  const isSetup = passwordManager.isPasswordSet();

  const info = passwordManager.getPasswordInfo();

  return Response.json({
    isSetup,
    passwordInfo: info ? {
      createdAt: info.createdAt,
      lastChanged: info.lastChanged,
    } : null,
  });
}
