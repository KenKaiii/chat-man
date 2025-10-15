/**
 * Chat Man - WebSocket server with Ollama integration
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ServerWebSocket } from 'bun';
import { checkOllamaHealth, streamChat, listModels, getDefaultModel, pullModelWithProgress } from './ollama';
import type {
  ChatMessage,
  StopGenerationMessage,
  OllamaChatMessage,
} from './types';
import { buildSystemContext, getModelConfig, loadSettings, reloadConfig } from './config';
import { handleRAGUpload, handleRAGQuery, handleRAGList, handleRAGDelete } from './rag-api';
import { retrieveContext } from './rag/retriever';
import { SessionDatabase } from './database';
import { logger } from './utils/secureLogger';
import { authenticateWebSocket, isAuthenticationRequired, authMiddleware } from './auth/middleware';
import { getBackupManager } from './backup/backupManager';
import { AuditSeverity } from './audit/auditEvents';
import {
  handleAuthSetup,
  handleAuthLogin,
  handleAuthChangePassword,
  handleAuthRefresh,
  handleAuthValidate,
  handleAuthStatus,
} from './auth-api';
import {
  handleCreateDSRRequest,
  handleListDSRRequests,
  handleGetDSRRequest,
  handleUpdateDSRRequest,
  handleProcessDSRRequest,
  handleGetDSRStatistics,
} from './dsr-api';
import { ensureEncryptionUnlocked } from './encryption/setupWizard';
import { logAuditEvent } from './audit/auditLogger';
import { AuditEventType } from './audit/auditEvents';

const PORT = process.env.PORT || 3010;

// CORS helper function
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Database (initialized after encryption)
let db: SessionDatabase;

// Track active generation streams per session
const activeGenerations = new Map<string, AbortController>();

// Track model download progress
const downloadProgress = new Map<string, {
  status: string;
  progress: number;
  completed: number;
  total: number;
}>();

// Track active model downloads for cancellation
const activeDownloads = new Map<string, AbortController>();

// Model configuration
let modelConfig: Awaited<ReturnType<typeof getModelConfig>>;

// WebSocket handler
Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // WebSocket upgrade for /ws
    if (url.pathname === '/ws') {
      // Authenticate WebSocket connection if authentication is enabled
      if (isAuthenticationRequired()) {
        const auth = authenticateWebSocket(req.url);
        if (!auth.authenticated) {
          logger.warn('WebSocket connection rejected - authentication failed');
          return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 500 });
      }
      return undefined;
    }

    // API endpoint to list models
    if (url.pathname === '/api/models') {
      try {
        const models = await listModels();
        return addCorsHeaders(Response.json(models));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to fetch models' },
          { status: 500 }
        ));
      }
    }

    // API endpoint to check model availability status
    if (url.pathname === '/api/models/status' && req.method === 'GET') {
      try {
        // Get list of downloaded models from Ollama
        const { models: ollamaModels } = await listModels();
        const downloadedModelNames = ollamaModels.map(m => m.name);

        // Import configured models
        const { AVAILABLE_MODELS } = await import('../src/config/models');

        // Check which configured models are downloaded
        const modelStatus = AVAILABLE_MODELS.map(model => {
          // Check if model is downloaded with flexible matching
          const isDownloaded = downloadedModelNames.some(downloadedName => {
            // Exact match
            if (downloadedName === model.apiModelId) return true;

            // Check if downloaded name starts with our model ID + ':'
            // e.g., "qwen2.5-coder:7b" matches "qwen2.5-coder"
            if (downloadedName.startsWith(model.apiModelId + ':')) return true;

            // Check if our model ID starts with downloaded name + ':'
            // e.g., config "llama3.3:70b" matches downloaded "llama3.3:70b"
            // But "llama3.2:1b" should NOT match "llama3.2:3b"
            if (model.apiModelId.startsWith(downloadedName + ':')) return true;

            return false;
          });

          return {
            id: model.id,
            name: model.name,
            description: model.description,
            apiModelId: model.apiModelId,
            provider: model.provider,
            downloaded: isDownloaded,
          };
        });

        return addCorsHeaders(Response.json({ models: modelStatus }));
      } catch (error) {
        logger.error('Failed to check model status', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to check model status' },
          { status: 500 }
        ));
      }
    }

    // API endpoint to download a model
    if (url.pathname === '/api/models/download' && req.method === 'POST') {
      try {
        const body = await req.json() as { modelId: string };
        const { modelId } = body;

        if (!modelId) {
          return addCorsHeaders(Response.json(
            { error: 'Model ID is required' },
            { status: 400 }
          ));
        }

        // Import configured models to validate
        const { AVAILABLE_MODELS } = await import('../src/config/models');
        const model = AVAILABLE_MODELS.find(m => m.apiModelId === modelId);

        if (!model) {
          return addCorsHeaders(Response.json(
            { error: 'Invalid model ID' },
            { status: 400 }
          ));
        }

        // Audit log model download initiation
        logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
          action: 'model_download_start',
          modelId: model.apiModelId,
        });

        // Initialize progress tracking
        downloadProgress.set(model.apiModelId, {
          status: 'starting',
          progress: 0,
          completed: 0,
          total: 0,
        });

        // Create abort controller for this download
        const abortController = new AbortController();
        activeDownloads.set(model.apiModelId, abortController);

        // Start the download in the background with progress tracking
        (async () => {
          try {
            for await (const progress of pullModelWithProgress(model.apiModelId, abortController.signal)) {
              downloadProgress.set(model.apiModelId, {
                status: progress.status,
                progress: progress.progress || 0,
                completed: progress.completed || 0,
                total: progress.total || 0,
              });
            }
            // Download complete
            downloadProgress.delete(model.apiModelId);
            activeDownloads.delete(model.apiModelId);
            logger.info('Model download completed', { modelId: model.apiModelId });
          } catch (error) {
            logger.error('Model download failed', {
              modelId: model.apiModelId,
              error: error instanceof Error ? error.message : 'Unknown',
            });
            downloadProgress.delete(model.apiModelId);
            activeDownloads.delete(model.apiModelId);
          }
        })();

        // Return immediately - client should poll /api/models/download/progress to check progress
        return addCorsHeaders(Response.json({
          success: true,
          message: `Downloading ${model.name}. This may take several minutes.`,
          modelId: model.apiModelId,
        }));
      } catch (error) {
        logger.error('Failed to initiate model download', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to initiate model download' },
          { status: 500 }
        ));
      }
    }

    // API endpoint to get model download progress
    if (url.pathname.match(/^\/api\/models\/download\/progress\/.+$/) && req.method === 'GET') {
      try {
        const modelId = url.pathname.split('/').pop();
        if (!modelId) {
          return addCorsHeaders(Response.json(
            { error: 'Model ID is required' },
            { status: 400 }
          ));
        }

        const progress = downloadProgress.get(decodeURIComponent(modelId));

        if (!progress) {
          // Not currently downloading
          return addCorsHeaders(Response.json({
            downloading: false,
          }));
        }

        return addCorsHeaders(Response.json({
          downloading: true,
          ...progress,
        }));
      } catch (error) {
        logger.error('Failed to get download progress', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to get download progress' },
          { status: 500 }
        ));
      }
    }

    // API endpoint to cancel model download
    if (url.pathname.match(/^\/api\/models\/download\/cancel\/.+$/) && req.method === 'POST') {
      try {
        const modelId = url.pathname.split('/').pop();
        if (!modelId) {
          return addCorsHeaders(Response.json(
            { error: 'Model ID is required' },
            { status: 400 }
          ));
        }

        const decodedModelId = decodeURIComponent(modelId);
        const abortController = activeDownloads.get(decodedModelId);

        if (!abortController) {
          return addCorsHeaders(Response.json(
            { error: 'No active download for this model' },
            { status: 404 }
          ));
        }

        // Abort the download
        abortController.abort();
        activeDownloads.delete(decodedModelId);
        downloadProgress.delete(decodedModelId);

        logger.info('Model download cancelled', { modelId: decodedModelId });

        return addCorsHeaders(Response.json({
          success: true,
          message: 'Download cancelled',
        }));
      } catch (error) {
        logger.error('Failed to cancel download', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to cancel download' },
          { status: 500 }
        ));
      }
    }

    // Health check
    if (url.pathname === '/api/health') {
      const ollamaHealthy = await checkOllamaHealth();
      return addCorsHeaders(Response.json({
        status: ollamaHealthy ? 'ok' : 'ollama_unavailable',
        ollama: ollamaHealthy,
        authRequired: isAuthenticationRequired(),
      }));
    }

    // Reload configuration
    if (url.pathname === '/api/reload-config' && req.method === 'POST') {
      try {
        const { settings } = await reloadConfig();
        modelConfig = settings.model;
        return addCorsHeaders(Response.json({
          success: true,
          message: 'Configuration reloaded successfully',
        }));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to reload configuration' },
          { status: 500 }
        ));
      }
    }

    // Get current settings
    if (url.pathname === '/api/settings') {
      try {
        const settings = await loadSettings();
        return addCorsHeaders(Response.json(settings));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to load settings' },
          { status: 500 }
        ));
      }
    }

    // Get user config (optional display name, etc.)
    if (url.pathname === '/api/user-config') {
      try {
        // For now, return a default empty config
        // In the future, this could read from a user-config.json file
        return addCorsHeaders(Response.json({
          displayName: null
        }));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to load user config' },
          { status: 500 }
        ));
      }
    }

    // Compliance Status: Check GDPR/HIPAA compliance requirements
    if (url.pathname === '/api/compliance/status' && req.method === 'GET') {
      try {
        const { existsSync } = await import('fs');
        const { join } = await import('path');
        const { getKeyManager } = await import('./encryption/keyManager');
        const { getAuditLogger } = await import('./audit/auditLogger');
        const backupManager = getBackupManager();
        const settings = await loadSettings();

        // Check file existence
        const files = {
          securityDocs: existsSync(join(process.cwd(), 'required_files', 'SECURITY_REQUIREMENTS.md')),
          privacyNotice: existsSync(join(process.cwd(), 'src', 'components', 'auth', 'PrivacyNotice.tsx')),
          backupManager: existsSync(join(process.cwd(), 'server', 'backup', 'backupManager.ts')),
          auditLogger: existsSync(join(process.cwd(), 'server', 'audit', 'auditLogger.ts')),
          auditEvents: existsSync(join(process.cwd(), 'server', 'audit', 'auditEvents.ts')),
        };

        // Check encryption
        const keyManager = getKeyManager();
        const encryptionSetup = keyManager.isSetup();

        // Check backup system
        const backupDir = join(process.cwd(), 'backups');
        const backupDirExists = existsSync(backupDir);
        const backups = backupManager.listBackups();
        const backupEnabled = settings.backup?.enabled || false;

        // Check audit logging
        const auditDir = join(process.cwd(), 'data', 'audit');
        const auditDirExists = existsSync(auditDir);
        const auditLogger = getAuditLogger();
        const auditLogCount = auditLogger.getLogFileCount();

        // Check retention policy
        const retentionEnabled = settings.retention?.enabled || false;
        const retentionDays = settings.retention?.maxSessionAgeDays || 0;

        // Check GDPR rights implementation
        const gdprRights = {
          rightToAccess: true, // exportAllData() exists
          rightToErasure: true, // deleteAllData() exists
          rightToPortability: true, // exportAllData() returns JSON
          storageLimitation: retentionEnabled,
          privacyNotice: files.privacyNotice,
        };

        // Check HIPAA controls
        const hipaaControls = {
          encryption: encryptionSetup,
          backupControls: backupEnabled && backupDirExists,
          auditControls: auditDirExists && auditLogCount > 0,
        };

        const complianceStatus = {
          files,
          encryption: {
            enabled: encryptionSetup,
            status: encryptionSetup ? 'active' : 'not_configured',
          },
          backup: {
            enabled: backupEnabled,
            directoryExists: backupDirExists,
            backupCount: backups.length,
            hasBackups: backups.length > 0,
            autoBackupEnabled: settings.backup?.autoBackupEnabled || false,
            schedule: settings.backup?.autoBackupSchedule || 'daily',
          },
          audit: {
            directoryExists: auditDirExists,
            logFileCount: auditLogCount,
            hasLogs: auditLogCount > 0,
          },
          retention: {
            enabled: retentionEnabled,
            maxSessionAgeDays: retentionDays,
            autoCleanupEnabled: settings.retention?.autoCleanupEnabled || false,
            schedule: settings.retention?.cleanupSchedule || 'daily',
          },
          gdpr: gdprRights,
          hipaa: hipaaControls,
          overallCompliance: {
            filesComplete: Object.values(files).every(v => v),
            encryptionActive: encryptionSetup,
            backupActive: backupEnabled && backupDirExists,
            auditActive: auditDirExists && auditLogCount > 0,
            retentionConfigured: retentionEnabled,
            gdprCompliant: Object.values(gdprRights).every(v => v),
            hipaaCompliant: Object.values(hipaaControls).every(v => v),
          },
        };

        return addCorsHeaders(Response.json(complianceStatus));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to check compliance status' },
          { status: 500 }
        ));
      }
    }

    // Audit Logs: Get audit logs with filtering
    // GDPR Article 15 - Right to Access
    // HIPAA §164.312(b) - Audit Controls
    if (url.pathname === '/api/audit/logs' && req.method === 'GET') {
      try {
        const { getAuditLogger } = await import('./audit/auditLogger');
        const auditLogger = getAuditLogger();

        // Parse query parameters
        const searchParams = url.searchParams;
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const eventType = searchParams.get('eventType') || undefined;
        const result = searchParams.get('result') as 'SUCCESS' | 'FAILURE' | undefined;
        const severity = searchParams.get('severity') || undefined;
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const searchTerm = searchParams.get('searchTerm') || undefined;

        const { events, total } = auditLogger.readLogs({
          limit: Math.min(limit, 100), // Cap at 100
          offset,
          eventType,
          result,
          severity: severity as AuditSeverity | undefined,
          startDate,
          endDate,
          searchTerm,
        });

        return addCorsHeaders(Response.json({
          events,
          total,
          limit: Math.min(limit, 100),
          offset,
        }));
      } catch (error) {
        logger.error('Failed to read audit logs', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to read audit logs' },
          { status: 500 }
        ));
      }
    }

    // Audit Logs: Get statistics
    if (url.pathname === '/api/audit/stats' && req.method === 'GET') {
      try {
        const { getAuditLogger } = await import('./audit/auditLogger');
        const auditLogger = getAuditLogger();
        const stats = auditLogger.getStats();

        return addCorsHeaders(Response.json(stats));
      } catch (error) {
        logger.error('Failed to get audit stats', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to get audit statistics' },
          { status: 500 }
        ));
      }
    }

    // Audit Logs: Export logs
    // GDPR Article 15 - Right to Data Portability
    if (url.pathname === '/api/audit/export' && req.method === 'GET') {
      try {
        const { getAuditLogger } = await import('./audit/auditLogger');
        const auditLogger = getAuditLogger();

        const searchParams = url.searchParams;
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;

        const exportJson = auditLogger.exportLogs(startDate, endDate);

        // Audit log this export
        logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
          action: 'audit_log_export',
          startDate,
          endDate,
        });

        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        headers.set('Content-Disposition', `attachment; filename="audit-logs-export-${new Date().toISOString().split('T')[0]}.json"`);

        return addCorsHeaders(new Response(exportJson, {
          status: 200,
          headers,
        }));
      } catch (error) {
        logger.error('Failed to export audit logs', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        return addCorsHeaders(Response.json(
          { error: 'Failed to export audit logs' },
          { status: 500 }
        ));
      }
    }

    // Authentication API Endpoints
    if (url.pathname === '/api/auth/setup' && req.method === 'POST') {
      return addCorsHeaders(await handleAuthSetup(req));
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      return addCorsHeaders(await handleAuthLogin(req));
    }

    if (url.pathname === '/api/auth/change-password' && req.method === 'POST') {
      const auth = authMiddleware(req);
      if (!auth.authenticated) {
        return addCorsHeaders(Response.json({ error: auth.error }, { status: auth.statusCode || 401 }));
      }
      return addCorsHeaders(await handleAuthChangePassword(req));
    }

    if (url.pathname === '/api/auth/refresh' && req.method === 'POST') {
      return addCorsHeaders(await handleAuthRefresh(req));
    }

    if (url.pathname === '/api/auth/validate' && req.method === 'POST') {
      return addCorsHeaders(await handleAuthValidate(req));
    }

    if (url.pathname === '/api/auth/status' && req.method === 'GET') {
      return addCorsHeaders(await handleAuthStatus(req));
    }

    // RAG: Upload document
    if (url.pathname === '/api/rag/upload' && req.method === 'POST') {
      return addCorsHeaders(await handleRAGUpload(req));
    }

    // RAG: Query documents
    if (url.pathname === '/api/rag/query' && req.method === 'POST') {
      return addCorsHeaders(await handleRAGQuery(req));
    }

    // RAG: List documents
    if (url.pathname === '/api/rag/documents' && req.method === 'GET') {
      return addCorsHeaders(await handleRAGList());
    }

    // RAG: Delete document
    if (url.pathname.startsWith('/api/rag/documents/') && req.method === 'DELETE') {
      const documentId = url.pathname.split('/').pop();
      if (documentId) {
        return addCorsHeaders(await handleRAGDelete(documentId));
      }
    }

    // Session Management: Get all sessions
    if (url.pathname === '/api/sessions' && req.method === 'GET') {
      const sessions = db.getAllSessions();

      // Audit log data access
      logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
        action: 'list_sessions',
        sessionCount: sessions.length,
      });

      return addCorsHeaders(Response.json(sessions));
    }

    // Session Management: Create new session
    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const body = await req.json() as { mode?: 'general' | 'rag' | 'spark' | 'voice' };
      const session = db.createSession(body.mode);

      // Audit log session creation
      logAuditEvent(AuditEventType.SESSION_CREATE, 'SUCCESS', {
        sessionId: session.id.substring(0, 8) + '...',
        mode: session.mode,
      });

      return addCorsHeaders(Response.json(session));
    }

    // Session Management: Get specific session
    if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
      const id = url.pathname.split('/').pop()!;
      const session = db.getSession(id);
      if (!session) {
        return addCorsHeaders(Response.json({ error: 'Session not found' }, { status: 404 }));
      }

      // Audit log session view
      logAuditEvent(AuditEventType.SESSION_VIEW, 'SUCCESS', {
        sessionId: id.substring(0, 8) + '...',
        action: 'view_session',
      });

      return addCorsHeaders(Response.json(session));
    }

    // Session Management: Get session messages
    if (url.pathname.match(/^\/api\/sessions\/[^/]+\/messages$/) && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      const messages = db.getMessages(id);

      // Audit log data access
      logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
        sessionId: id.substring(0, 8) + '...',
        action: 'view_messages',
        messageCount: messages.length,
      });

      return addCorsHeaders(Response.json(messages));
    }

    // Session Management: Update session (rename)
    if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'PATCH') {
      const id = url.pathname.split('/').pop()!;
      const body = await req.json() as { title: string };
      db.updateSessionTitle(id, body.title);

      // Audit log data modification
      logAuditEvent(AuditEventType.DATA_MODIFY, 'SUCCESS', {
        sessionId: id.substring(0, 8) + '...',
        action: 'rename_session',
      });

      return addCorsHeaders(Response.json({ success: true }));
    }

    // Session Management: Delete session
    if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'DELETE') {
      const id = url.pathname.split('/').pop()!;
      db.deleteSession(id);

      // Audit log session deletion
      logAuditEvent(AuditEventType.SESSION_DELETE, 'SUCCESS', {
        sessionId: id.substring(0, 8) + '...',
      });

      return addCorsHeaders(Response.json({ success: true }));
    }

    // Data Management: Export all data (GDPR Right to Data Portability)
    if (url.pathname === '/api/data/export' && req.method === 'GET') {
      const exportData = db.exportAllData();

      // Audit log
      logAuditEvent(AuditEventType.DATA_EXPORT, 'SUCCESS', {
        sessionCount: exportData.metadata.totalSessions,
        messageCount: exportData.metadata.totalMessages,
      });

      // Set headers for file download
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('Content-Disposition', `attachment; filename="chat-man-export-${new Date().toISOString().split('T')[0]}.json"`);

      const corsResponse = addCorsHeaders(new Response(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers,
      }));

      return corsResponse;
    }

    // Data Management: Delete all data (GDPR Right to Erasure)
    if (url.pathname === '/api/data/delete-all' && req.method === 'DELETE') {
      // Audit log before deletion
      logAuditEvent(AuditEventType.DATA_DELETE_ALL, 'SUCCESS');

      db.deleteAllData();
      return addCorsHeaders(Response.json({
        success: true,
        message: 'All user data has been permanently deleted',
      }));
    }

    // Retention Policy: Get status
    if (url.pathname === '/api/retention/status' && req.method === 'GET') {
      try {
        const settings = await loadSettings();
        const retentionEnabled = settings.retention?.enabled || false;
        const retentionDays = settings.retention?.maxSessionAgeDays || 90;
        const expiredSessions = retentionEnabled ? db.getExpiredSessions(retentionDays) : [];

        return addCorsHeaders(Response.json({
          enabled: retentionEnabled,
          maxSessionAgeDays: retentionDays,
          autoCleanupEnabled: settings.retention?.autoCleanupEnabled || false,
          cleanupSchedule: settings.retention?.cleanupSchedule || 'daily',
          expiredCount: expiredSessions.length,
        }));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to get retention status' },
          { status: 500 }
        ));
      }
    }

    // Retention Policy: Manual cleanup
    if (url.pathname === '/api/retention/cleanup' && req.method === 'POST') {
      try {
        const settings = await loadSettings();
        if (!settings.retention?.enabled) {
          return addCorsHeaders(Response.json(
            { error: 'Retention policy is not enabled' },
            { status: 400 }
          ));
        }

        const retentionDays = settings.retention.maxSessionAgeDays;
        const deletedCount = db.deleteExpiredSessions(retentionDays);

        // Audit log
        logAuditEvent(AuditEventType.RETENTION_CLEANUP, 'SUCCESS', { deletedCount, retentionDays });

        return addCorsHeaders(Response.json({
          success: true,
          deletedCount,
          message: `Deleted ${deletedCount} expired session(s)`,
        }));
      } catch (_error) {
        logAuditEvent(AuditEventType.RETENTION_CLEANUP, 'FAILURE');
        return addCorsHeaders(Response.json(
          { error: 'Failed to run cleanup' },
          { status: 500 }
        ));
      }
    }

    // Backup: Create backup
    if (url.pathname === '/api/backup/create' && req.method === 'POST') {
      try {
        const backupManager = getBackupManager();
        const metadata = backupManager.createBackup();

        // Audit log
        logAuditEvent(AuditEventType.BACKUP_CREATE, 'SUCCESS', { backupId: metadata.id, size: metadata.size });

        return addCorsHeaders(Response.json({
          success: true,
          backup: metadata,
          message: 'Backup created successfully',
        }));
      } catch (_error) {
        logAuditEvent(AuditEventType.BACKUP_CREATE, 'FAILURE');
        return addCorsHeaders(Response.json(
          { error: 'Failed to create backup' },
          { status: 500 }
        ));
      }
    }

    // Backup: List backups
    if (url.pathname === '/api/backup/list' && req.method === 'GET') {
      try {
        const backupManager = getBackupManager();
        const backups = backupManager.listBackups();
        const totalSize = backupManager.getTotalBackupSize();

        return addCorsHeaders(Response.json({
          backups,
          totalSize,
          count: backups.length,
        }));
      } catch (_error) {
        return addCorsHeaders(Response.json(
          { error: 'Failed to list backups' },
          { status: 500 }
        ));
      }
    }

    // Backup: Restore backup
    if (url.pathname.startsWith('/api/backup/restore/') && req.method === 'POST') {
      try {
        const backupId = url.pathname.split('/').pop();
        if (!backupId) {
          return addCorsHeaders(Response.json(
            { error: 'Backup ID is required' },
            { status: 400 }
          ));
        }

        const backupManager = getBackupManager();
        const success = backupManager.restoreBackup(backupId);

        if (success) {
          // Audit log
          logAuditEvent(AuditEventType.BACKUP_RESTORE, 'SUCCESS', { backupId });

          return addCorsHeaders(Response.json({
            success: true,
            message: 'Backup restored successfully. Please reload the application.',
          }));
        } else {
          logAuditEvent(AuditEventType.BACKUP_RESTORE, 'FAILURE', { backupId });
          return addCorsHeaders(Response.json(
            { error: 'Failed to restore backup' },
            { status: 500 }
          ));
        }
      } catch (_error) {
        logAuditEvent(AuditEventType.BACKUP_RESTORE, 'FAILURE');
        return addCorsHeaders(Response.json(
          { error: 'Failed to restore backup' },
          { status: 500 }
        ));
      }
    }

    // Backup: Delete backup
    if (url.pathname.startsWith('/api/backup/') && url.pathname.split('/').length === 4 && req.method === 'DELETE') {
      try {
        const backupId = url.pathname.split('/').pop();
        if (!backupId) {
          return addCorsHeaders(Response.json(
            { error: 'Backup ID is required' },
            { status: 400 }
          ));
        }

        const backupManager = getBackupManager();
        const success = backupManager.deleteBackup(backupId);

        if (success) {
          // Audit log
          logAuditEvent(AuditEventType.BACKUP_DELETE, 'SUCCESS', { backupId });

          return addCorsHeaders(Response.json({
            success: true,
            message: 'Backup deleted successfully',
          }));
        } else {
          logAuditEvent(AuditEventType.BACKUP_DELETE, 'FAILURE', { backupId });
          return addCorsHeaders(Response.json(
            { error: 'Backup not found' },
            { status: 404 }
          ));
        }
      } catch (_error) {
        logAuditEvent(AuditEventType.BACKUP_DELETE, 'FAILURE');
        return addCorsHeaders(Response.json(
          { error: 'Failed to delete backup' },
          { status: 500 }
        ));
      }
    }

    // Backup: Verify backup
    if (url.pathname.startsWith('/api/backup/verify/') && req.method === 'POST') {
      try {
        const backupId = url.pathname.split('/').pop();
        if (!backupId) {
          return addCorsHeaders(Response.json(
            { error: 'Backup ID is required' },
            { status: 400 }
          ));
        }

        const backupManager = getBackupManager();
        const result = backupManager.verifyBackup(backupId);

        if (result.valid) {
          logAuditEvent(AuditEventType.BACKUP_VERIFY, 'SUCCESS', { backupId, size: result.size });
          return addCorsHeaders(Response.json({ success: true, ...result }));
        } else {
          logAuditEvent(AuditEventType.BACKUP_VERIFY, 'FAILURE', { backupId, error: result.error });
          return addCorsHeaders(Response.json({ success: false, error: result.error }, { status: 500 }));
        }
      } catch (_error) {
        return addCorsHeaders(Response.json({ error: 'Backup verification failed' }, { status: 500 }));
      }
    }

    // Backup: Test restore
    if (url.pathname.startsWith('/api/backup/test-restore/') && req.method === 'POST') {
      try {
        const backupId = url.pathname.split('/').pop();
        if (!backupId) {
          return addCorsHeaders(Response.json({ error: 'Backup ID is required' }, { status: 400 }));
        }

        const backupManager = getBackupManager();
        const result = backupManager.testRestoreBackup(backupId);

        if (result.success) {
          logAuditEvent(AuditEventType.BACKUP_TEST_RESTORE, 'SUCCESS', { backupId, size: result.size });
          return addCorsHeaders(Response.json(result));
        } else {
          logAuditEvent(AuditEventType.BACKUP_TEST_RESTORE, 'FAILURE', { backupId, error: result.error });
          return addCorsHeaders(Response.json({ success: false, error: result.error }, { status: 500 }));
        }
      } catch (_error) {
        return addCorsHeaders(Response.json({ error: 'Test restore failed' }, { status: 500 }));
      }
    }

    // DSR: Create new DSR request (GDPR Articles 15-21)
    if (url.pathname === '/api/dsr/requests' && req.method === 'POST') {
      return addCorsHeaders(await handleCreateDSRRequest(req));
    }

    // DSR: List all DSR requests
    if (url.pathname === '/api/dsr/requests' && req.method === 'GET') {
      return addCorsHeaders(await handleListDSRRequests(req));
    }

    // DSR: Get specific DSR request
    if (url.pathname.match(/^\/api\/dsr\/requests\/[^/]+$/) && req.method === 'GET') {
      const requestId = url.pathname.split('/').pop();
      if (requestId) {
        return addCorsHeaders(await handleGetDSRRequest(requestId));
      }
    }

    // DSR: Update DSR request status
    if (url.pathname.match(/^\/api\/dsr\/requests\/[^/]+$/) && req.method === 'PATCH') {
      const requestId = url.pathname.split('/').pop();
      if (requestId) {
        return addCorsHeaders(await handleUpdateDSRRequest(requestId, req));
      }
    }

    // DSR: Process DSR request (auto-execute based on type)
    if (url.pathname.match(/^\/api\/dsr\/requests\/[^/]+\/process$/) && req.method === 'POST') {
      const requestId = url.pathname.split('/')[4];
      if (requestId) {
        return addCorsHeaders(await handleProcessDSRRequest(requestId));
      }
    }

    // DSR: Get DSR statistics
    if (url.pathname === '/api/dsr/statistics' && req.method === 'GET') {
      return addCorsHeaders(await handleGetDSRStatistics());
    }

    // Health: Detailed health check
    if (url.pathname === '/api/health/detailed' && req.method === 'GET') {
      try {
        const { getHealthChecker } = await import('./monitoring/healthCheck');
        const healthChecker = getHealthChecker();
        const healthResult = await healthChecker.performHealthCheck();

        return addCorsHeaders(Response.json(healthResult));
      } catch (error) {
        logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return addCorsHeaders(Response.json({ error: 'Health check failed' }, { status: 500 }));
      }
    }

    // Security: Get security alerts
    if (url.pathname === '/api/security/alerts' && req.method === 'GET') {
      try {
        const settings = await loadSettings();
        if (!settings.monitoring?.enabled) {
          return addCorsHeaders(Response.json({ error: 'Monitoring not enabled' }, { status: 400 }));
        }

        const { getAlertManager } = await import('./monitoring/alertManager');
        const { AlertSeverity: MonitoringAlertSeverity, AlertType } = await import('./monitoring/types');
        const alertManager = getAlertManager(settings.monitoring);

        const searchParams = url.searchParams;
        const limit = parseInt(searchParams.get('limit') || '50');
        const severityParam = searchParams.get('severity');
        const severity = severityParam && Object.values(MonitoringAlertSeverity).includes(severityParam as typeof MonitoringAlertSeverity[keyof typeof MonitoringAlertSeverity])
          ? (severityParam as typeof MonitoringAlertSeverity[keyof typeof MonitoringAlertSeverity])
          : undefined;
        const typeParam = searchParams.get('type');
        const type = typeParam && Object.values(AlertType).includes(typeParam as typeof AlertType[keyof typeof AlertType])
          ? (typeParam as typeof AlertType[keyof typeof AlertType])
          : undefined;
        const resolved = searchParams.get('resolved') === 'true' ? true : searchParams.get('resolved') === 'false' ? false : undefined;

        const alerts = alertManager.getAlerts({ limit, severity, type, resolved });

        return addCorsHeaders(Response.json({ alerts, count: alerts.length }));
      } catch (error) {
        logger.error('Failed to get security alerts', { error: error instanceof Error ? error.message : 'Unknown' });
        return addCorsHeaders(Response.json({ error: 'Failed to get alerts' }, { status: 500 }));
      }
    }

    // Security: Get security metrics
    if (url.pathname === '/api/security/metrics' && req.method === 'GET') {
      try {
        const settings = await loadSettings();
        if (!settings.monitoring?.enabled) {
          return addCorsHeaders(Response.json({ error: 'Monitoring not enabled' }, { status: 400 }));
        }

        const { getSecurityMonitor } = await import('./monitoring/securityMonitor');
        const securityMonitor = getSecurityMonitor(settings.monitoring);
        const metrics = await securityMonitor.getSecurityMetrics();

        return addCorsHeaders(Response.json(metrics));
      } catch (error) {
        logger.error('Failed to get security metrics', { error: error instanceof Error ? error.message : 'Unknown' });
        return addCorsHeaders(Response.json({ error: 'Failed to get metrics' }, { status: 500 }));
      }
    }

    // Metrics: Get system metrics
    if (url.pathname === '/api/metrics' && req.method === 'GET') {
      try {
        const { getMetricsCollector } = await import('./monitoring/metrics');
        const metrics = getMetricsCollector().getMetrics();

        return addCorsHeaders(Response.json(metrics));
      } catch (error) {
        logger.error('Failed to get metrics', { error: error instanceof Error ? error.message : 'Unknown' });
        return addCorsHeaders(Response.json({ error: 'Failed to get metrics' }, { status: 500 }));
      }
    }

    // Metrics: Prometheus format
    if (url.pathname === '/api/metrics/prometheus' && req.method === 'GET') {
      try {
        const { getMetricsCollector } = await import('./monitoring/metrics');
        const prometheusMetrics = getMetricsCollector().getPrometheusMetrics();

        return new Response(prometheusMetrics, {
          headers: new Headers({
            'Content-Type': 'text/plain; version=0.0.4',
            'Access-Control-Allow-Origin': '*',
          }),
        });
      } catch (error) {
        logger.error('Failed to get Prometheus metrics', { error: error instanceof Error ? error.message : 'Unknown' });
        return addCorsHeaders(Response.json({ error: 'Failed to get metrics' }, { status: 500 }));
      }
    }

    return new Response('Not found', { status: 404 });
  },

  websocket: {
    open(_ws: ServerWebSocket) {
      logger.info('WebSocket client connected');

      // Audit log WebSocket connection
      logAuditEvent(AuditEventType.WEBSOCKET_CONNECT, 'SUCCESS', {
        action: 'websocket_open',
      });
    },

    async message(ws: ServerWebSocket, message: string | Buffer) {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'chat') {
          await handleChatMessage(ws, data as ChatMessage);
        } else if (data.type === 'stop_generation') {
          handleStopGeneration(data as StopGenerationMessage);
        }
      } catch (error) {
        logger.error('WebSocket message error', { error: error instanceof Error ? error.message : 'Unknown error' });
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },

    close(_ws: ServerWebSocket) {
      logger.info('WebSocket client disconnected');

      // Audit log WebSocket disconnection
      logAuditEvent(AuditEventType.WEBSOCKET_DISCONNECT, 'SUCCESS', {
        action: 'websocket_close',
      });
    },
  },
});

/**
 * Handle incoming chat messages
 */
async function handleChatMessage(ws: ServerWebSocket, data: ChatMessage) {
  const sessionId = data.sessionId;

  if (!sessionId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Session ID is required',
    }));
    return;
  }

  // Log incoming message (NEVER log content - HIPAA/GDPR)
  logger.info('Received chat message', {
    mode: data.mode,
    sessionId: sessionId.substring(0, 8) + '...',
    // content: NEVER LOGGED
  });

  // Extract text content
  let userMessage = '';
  if (typeof data.content === 'string') {
    userMessage = data.content;
  } else if (Array.isArray(data.content)) {
    const textBlock = data.content.find(block => block.type === 'text');
    userMessage = textBlock?.text || '';
  }

  if (!userMessage.trim()) {
    logger.warn('Empty message received', { sessionId: sessionId.substring(0, 8) + '...' });
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Empty message',
      sessionId,
    }));
    return;
  }

  // Get or create session
  let session = db.getSession(sessionId);
  if (!session) {
    session = db.createSession(data.mode || 'general');

    // Audit log session creation (WebSocket)
    logAuditEvent(AuditEventType.SESSION_CREATE, 'SUCCESS', {
      sessionId: session.id.substring(0, 8) + '...',
      mode: session.mode,
      via: 'websocket',
    });
  }

  // Load mode-specific system context for this session
  const sessionSystemContext = await buildSystemContext(session.mode);

  // Load conversation history from database
  const dbMessages = db.getMessages(sessionId);

  // Keep only the last 10 messages for context window
  const MAX_CONTEXT_MESSAGES = 10;
  const recentMessages = dbMessages.slice(-MAX_CONTEXT_MESSAGES);

  const history: OllamaChatMessage[] = [];

  // Add mode-specific system context as first message
  if (sessionSystemContext) {
    history.push({
      role: 'system',
      content: sessionSystemContext,
    });
  }

  interface ContentBlock {
    type: 'text' | 'tool_use' | 'thinking' | 'tool_result';
    text?: string;
  }

  // Convert database messages to Ollama format
  for (const msg of recentMessages) {
    if (msg.type === 'user') {
      history.push({
        role: 'user',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    } else if (msg.type === 'assistant') {
      // Extract text from assistant content blocks
      const content = Array.isArray(msg.content) ? msg.content : [msg.content];
      const textBlocks = (content as ContentBlock[]).filter((b) => b.type === 'text');
      const text = textBlocks.map((b) => b.text).join('');
      if (text) {
        history.push({
          role: 'assistant',
          content: text,
        });
      }
    }
  }

  // Add new user message to history (for Ollama)
  history.push({
    role: 'user',
    content: userMessage,
  });

  // Save user message to database
  const userMessageId = crypto.randomUUID();
  db.addMessage(sessionId, {
    id: userMessageId,
    type: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  // Auto-generate title if this is the first user message
  const userMessageCount = dbMessages.filter(m => m.type === 'user').length;
  if (userMessageCount === 0) {
    db.autoGenerateTitle(sessionId, userMessage);
  }

  // RAG: Retrieve context if RAG mode is enabled
  if (data.mode === 'rag') {
    try {
      logger.info('RAG mode enabled, retrieving context');
      // Note: Documents are global, but context injection is session-specific
      // because it's only added to this session's in-memory history and not saved to DB
      const ragResult = await retrieveContext(userMessage, { topK: 5 });

      if (ragResult.context && ragResult.chunks.length > 0) {
        logger.info('Retrieved relevant document chunks', {
          chunkCount: ragResult.chunks.length,
          // context: NEVER LOGGED - may contain PHI
        });

        // Inject RAG context as USER message with special formatting
        // (Ollama handles multiple system messages poorly)
        const ragContextMessage = `[Context from uploaded documents]:\n\n${ragResult.context}\n\n[End of context]\n\nNow please answer this question based on the context above: ${userMessage}`;

        // Replace the last user message with one that includes context
        history[history.length - 1] = {
          role: 'user',
          content: ragContextMessage
        };

        logger.debug('Injected RAG context into user message');
      } else {
        logger.warn('No relevant context found in uploaded documents');
      }
    } catch (error) {
      logger.error('Error retrieving RAG context', { error: error instanceof Error ? error.message : 'Unknown' });
      // Continue without RAG context
    }
  }

  // Get model (use default or from config if not specified)
  const model = data.model || modelConfig.name || await getDefaultModel();

  logger.info('Sending messages to Ollama', {
    model,
    messageCount: history.length,
    sessionId: sessionId.substring(0, 8) + '...',
  });
  logger.debug('History structure', {
    history: history.map(m => ({ role: m.role, contentLength: m.content.length }))
  });

  // Create abort controller for this generation
  const abortController = new AbortController();
  activeGenerations.set(sessionId, abortController);

  try {
    let fullResponse = '';
    let tokenCount = 0;

    logger.debug('Starting Ollama stream');

    // Stream response from Ollama with model config
    for await (const chunk of streamChat(model, history, {
      temperature: modelConfig.temperature,
      top_p: modelConfig.top_p,
      top_k: modelConfig.top_k,
    })) {
      // Check if generation was stopped
      if (abortController.signal.aborted) {
        logger.info('Generation stopped', { sessionId: sessionId.substring(0, 8) + '...' });
        break;
      }

      if (chunk.message?.content) {
        fullResponse += chunk.message.content;
        tokenCount++;

        // Send streaming delta to client
        ws.send(JSON.stringify({
          type: 'assistant_message',
          content: chunk.message.content,
          sessionId,
        }));

        // Send token count update every 10 tokens
        if (tokenCount % 10 === 0) {
          ws.send(JSON.stringify({
            type: 'token_update',
            outputTokens: tokenCount,
            sessionId,
          }));
        }
      }

      // Check if done
      if (chunk.done) {
        // Save assistant response to database
        const assistantMessageId = crypto.randomUUID();
        db.addMessage(sessionId, {
          id: assistantMessageId,
          type: 'assistant',
          content: [{ type: 'text' as const, text: fullResponse }],
          timestamp: new Date().toISOString(),
        });

        // Send final token count
        ws.send(JSON.stringify({
          type: 'token_update',
          outputTokens: tokenCount,
          sessionId,
        }));

        // Send result message
        ws.send(JSON.stringify({
          type: 'result',
          sessionId,
        }));

        break;
      }
    }
  } catch (error) {
    logger.error('Error streaming from Ollama', {
      error: error instanceof Error ? error.message : 'Unknown',
      sessionId: sessionId.substring(0, 8) + '...',
    });

    let errorMessage = 'An error occurred while generating response';
    let errorType = 'unknown_error';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Ollama is not running. Please start Ollama first.';
        errorType = 'ollama_unavailable';
      }
    }

    ws.send(JSON.stringify({
      type: 'error',
      message: errorMessage,
      errorType,
      sessionId,
    }));
  } finally {
    activeGenerations.delete(sessionId);
  }
}

/**
 * Handle stop generation request
 */
function handleStopGeneration(data: StopGenerationMessage) {
  const sessionId = data.sessionId;
  const abortController = activeGenerations.get(sessionId);

  if (abortController) {
    abortController.abort();
    activeGenerations.delete(sessionId);
    logger.info('Stopped generation', { sessionId: sessionId.substring(0, 8) + '...' });
  }
}

// Load configuration and check Ollama health on startup
(async () => {
  // Initialize encryption (first-run setup wizard if needed)
  try {
    await ensureEncryptionUnlocked();
    logger.info('Encryption system initialized');
  } catch (error) {
    logger.error('Failed to initialize encryption', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    logger.error('Cannot start server without encryption. Exiting...');
    process.exit(1);
  }

  // SECURITY: Verify file permissions for sensitive files
  try {
    const { stat } = await import('fs/promises');
    const { join } = await import('path');

    const sensitiveFiles = [
      join(process.cwd(), 'config', '.auth'),
      join(process.cwd(), 'config', '.encryption_salt'),
    ];

    for (const filePath of sensitiveFiles) {
      try {
        const stats = await stat(filePath);
        const permissions = (stats.mode & 0o777).toString(8);

        // Check if file is readable by others (should be 600 or 400)
        if (parseInt(permissions, 8) & 0o077) {
          logger.warn('Insecure file permissions detected', {
            file: filePath,
            permissions,
            expected: '600',
          });

          // Fix permissions automatically
          const { chmod } = await import('fs/promises');
          await chmod(filePath, 0o600);
          logger.info('Fixed file permissions', {
            file: filePath,
            newPermissions: '600',
          });
        } else {
          logger.debug('File permissions verified', {
            file: filePath,
            permissions,
          });
        }
      } catch (_error) {
        // File doesn't exist yet (first run) - this is okay
        logger.debug('Sensitive file not found (may be first run)', {
          file: filePath,
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to verify file permissions', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // SECURITY: Verify filesystem encryption (HIPAA §164.312(a)(2)(iv))
  try {
    const { verifyEncryptionOrWarn } = await import('./utils/encryptionVerifier');
    await verifyEncryptionOrWarn();
  } catch (error) {
    logger.error('Failed to verify filesystem encryption', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    // Continue startup - verifyEncryptionOrWarn handles warnings
  }

  // Initialize database (after encryption is ready)
  try {
    db = new SessionDatabase();
    logger.info('Database initialized');
  } catch (error) {
    logger.error('Failed to initialize database', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    logger.error('Cannot start server without database. Exiting...');
    process.exit(1);
  }

  // Set up data retention policy (GDPR Article 5.1.e - Storage Limitation)
  try {
    const settings = await loadSettings();
    if (settings.retention?.enabled) {
      const retentionDays = settings.retention.maxSessionAgeDays;

      // Run cleanup function
      const runCleanup = () => {
        logger.info('Running retention cleanup', { retentionDays });
        const deletedCount = db.deleteExpiredSessions(retentionDays);
        if (deletedCount > 0) {
          logger.info('Retention cleanup completed', { deletedCount });
        }
      };

      // Run cleanup immediately on startup
      runCleanup();

      // Set up scheduled cleanup if enabled
      if (settings.retention.autoCleanupEnabled) {
        const scheduleMap: Record<string, number> = {
          'daily': 24 * 60 * 60 * 1000,     // 24 hours
          'weekly': 7 * 24 * 60 * 60 * 1000, // 7 days
        };
        const interval = scheduleMap[settings.retention.cleanupSchedule] || scheduleMap['daily'];

        setInterval(runCleanup, interval);
        logger.info('Scheduled retention cleanup enabled', {
          schedule: settings.retention.cleanupSchedule,
          intervalMs: interval,
        });
      }
    } else {
      logger.info('Data retention policy disabled');
    }
  } catch (error) {
    logger.warn('Failed to set up retention policy', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Set up encrypted backup system (HIPAA §164.308(a)(7)(ii)(A) - Backup Controls)
  try {
    const settings = await loadSettings();
    if (settings.backup?.enabled) {
      const backupManager = getBackupManager();
      const keepLastN = settings.backup.keepLastN;

      // Run backup and cleanup function
      const runBackup = () => {
        logger.info('Running scheduled backup');
        try {
          const metadata = backupManager.createBackup();
          logger.info('Scheduled backup created', { id: metadata.id });

          // Clean up old backups
          const deletedCount = backupManager.deleteOldBackups(keepLastN);
          if (deletedCount > 0) {
            logger.info('Cleaned up old backups', { deletedCount, keepLastN });
          }
        } catch (error) {
          logger.error('Scheduled backup failed', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      };

      // Set up scheduled backups if enabled
      if (settings.backup.autoBackupEnabled) {
        const scheduleMap: Record<string, number> = {
          'daily': 24 * 60 * 60 * 1000,     // 24 hours
          'weekly': 7 * 24 * 60 * 60 * 1000, // 7 days
        };
        const interval = scheduleMap[settings.backup.autoBackupSchedule] || scheduleMap['daily'];

        setInterval(runBackup, interval);
        logger.info('Scheduled backups enabled', {
          schedule: settings.backup.autoBackupSchedule,
          keepLastN,
          intervalMs: interval,
        });
      }
    } else {
      logger.info('Backup system disabled');
    }
  } catch (error) {
    logger.warn('Failed to set up backup system', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Load configuration
  try {
    await buildSystemContext();
    modelConfig = await getModelConfig();
    logger.info('Configuration loaded', {
      model: modelConfig.name,
      temperature: modelConfig.temperature,
    });
  } catch (_error) {
    logger.warn('Failed to load configuration, using defaults');
    modelConfig = {
      name: 'llama3.2:3b',
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      max_tokens: 2048,
    };
  }

  // Check Ollama health
  const healthy = await checkOllamaHealth();

  if (!healthy) {
    logger.warn('Ollama is not running or not accessible at http://localhost:11434');
    logger.warn('Please start Ollama: ollama serve');
    logger.warn('Or install it: https://ollama.ai');
  } else {
    logger.info('Ollama is running');
    try {
      const defaultModel = await getDefaultModel();
      logger.info('Using model', { model: defaultModel });
    } catch (_error) {
      logger.warn('No models found. Install one with: ollama pull llama3.2');
    }
  }
})();

logger.info('Server running', { port: PORT });
logger.info('WebSocket endpoint', { endpoint: `ws://localhost:${PORT}/ws` });

// Audit log server startup
logAuditEvent(AuditEventType.SERVER_START, 'SUCCESS', { port: PORT });
