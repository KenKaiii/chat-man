/**
 * Data Subject Request (DSR) Workflow System
 * Handles GDPR/HIPAA data subject rights requests
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { logger } from '../utils/secureLogger';
import { logAuditEvent } from '../audit/auditLogger';
import { AuditEventType } from '../audit/auditEvents';
import { getSessionDatabase } from '../database';

const DSR_DB_PATH = join(process.cwd(), 'data', 'dsr-requests.db');

/**
 * GDPR Data Subject Request Types
 */
export enum DSRType {
  ACCESS = 'access',                     // Article 15 - Right to Access
  RECTIFICATION = 'rectification',       // Article 16 - Right to Rectification
  ERASURE = 'erasure',                   // Article 17 - Right to Erasure (Right to be Forgotten)
  PORTABILITY = 'portability',           // Article 20 - Right to Data Portability
  RESTRICTION = 'restriction',           // Article 18 - Right to Restriction of Processing
  OBJECTION = 'objection',               // Article 21 - Right to Object
  WITHDRAW_CONSENT = 'withdraw_consent', // Article 7(3) - Withdrawal of Consent
}

/**
 * DSR Request Status
 */
export enum DSRStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

/**
 * DSR Request interface
 */
export interface DSRRequest {
  id: string;
  type: DSRType;
  status: DSRStatus;
  created_at: string;
  updated_at: string;
  due_date: string;  // 30 days from creation (GDPR requirement)
  completed_at?: string;
  requester_info: string;  // JSON: { email, userId, etc. }
  request_details: string;  // JSON: additional details
  response_data?: string;   // JSON: response/report data
  notes?: string;
}

/**
 * DSR Workflow Manager
 */
export class DSRWorkflowManager {
  private db: Database;

  constructor() {
    this.db = new Database(DSR_DB_PATH);
    this.initializeDatabase();
  }

  /**
   * Initialize DSR request database
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dsr_requests (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        due_date TEXT NOT NULL,
        completed_at TEXT,
        requester_info TEXT NOT NULL,
        request_details TEXT NOT NULL,
        response_data TEXT,
        notes TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_dsr_status
      ON dsr_requests(status)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_dsr_due_date
      ON dsr_requests(due_date)
    `);

    logger.info('DSR workflow database initialized');
  }

  /**
   * Create a new DSR request
   */
  createRequest(
    type: DSRType,
    requesterInfo: Record<string, any>,
    requestDetails: Record<string, any> = {}
  ): DSRRequest {
    const id = crypto.randomUUID();
    const now = new Date();
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const request: DSRRequest = {
      id,
      type,
      status: DSRStatus.PENDING,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      due_date: dueDate.toISOString(),
      requester_info: JSON.stringify(requesterInfo),
      request_details: JSON.stringify(requestDetails),
    };

    this.db.run(
      `INSERT INTO dsr_requests (
        id, type, status, created_at, updated_at, due_date,
        requester_info, request_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        request.type,
        request.status,
        request.created_at,
        request.updated_at,
        request.due_date,
        request.requester_info,
        request.request_details,
      ]
    );

    // Audit log
    logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
      action: 'dsr_request_created',
      dsrType: type,
      dsrId: id.substring(0, 8) + '...',
      dueDate: dueDate.toISOString(),
    });

    logger.info('DSR request created', {
      id: id.substring(0, 8) + '...',
      type,
      dueDate: dueDate.toISOString(),
    });

    return request;
  }

  /**
   * Get DSR request by ID
   */
  getRequest(id: string): DSRRequest | null {
    const row = this.db.query('SELECT * FROM dsr_requests WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      ...row,
      requester_info: row.requester_info,
      request_details: row.request_details,
      response_data: row.response_data || undefined,
      notes: row.notes || undefined,
      completed_at: row.completed_at || undefined,
    };
  }

  /**
   * List all DSR requests
   */
  listRequests(filter?: {
    status?: DSRStatus;
    type?: DSRType;
    overdue?: boolean;
  }): DSRRequest[] {
    let query = 'SELECT * FROM dsr_requests WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }

    if (filter?.overdue) {
      query += ' AND due_date < ? AND status != ?';
      params.push(new Date().toISOString());
      params.push(DSRStatus.COMPLETED);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.query(query).all(...params) as any[];

    return rows.map(row => ({
      ...row,
      requester_info: row.requester_info,
      request_details: row.request_details,
      response_data: row.response_data || undefined,
      notes: row.notes || undefined,
      completed_at: row.completed_at || undefined,
    }));
  }

  /**
   * Update DSR request status
   */
  updateStatus(
    id: string,
    status: DSRStatus,
    notes?: string,
    responseData?: Record<string, any>
  ): void {
    const now = new Date().toISOString();
    const completed_at = status === DSRStatus.COMPLETED ? now : null;

    if (responseData) {
      this.db.run(
        `UPDATE dsr_requests SET
          status = ?,
          updated_at = ?,
          completed_at = ?,
          response_data = ?,
          notes = ?
        WHERE id = ?`,
        [
          status,
          now,
          completed_at,
          JSON.stringify(responseData),
          notes || null,
          id
        ]
      );
    } else {
      this.db.run(
        `UPDATE dsr_requests SET
          status = ?,
          updated_at = ?,
          completed_at = ?,
          notes = ?
        WHERE id = ?`,
        [status, now, completed_at, notes || null, id]
      );
    }

    // Audit log
    logAuditEvent(AuditEventType.DATA_MODIFY, 'SUCCESS', {
      action: 'dsr_request_updated',
      dsrId: id.substring(0, 8) + '...',
      newStatus: status,
    });

    logger.info('DSR request updated', {
      id: id.substring(0, 8) + '...',
      status,
    });
  }

  /**
   * Process ACCESS request (GDPR Article 15)
   * Returns all user data in JSON format
   */
  async processAccessRequest(id: string): Promise<Record<string, any>> {
    this.updateStatus(id, DSRStatus.IN_PROGRESS, 'Processing access request');

    const db = getSessionDatabase();
    const exportData = db.exportAllData();

    const response = {
      requestType: 'access',
      generatedAt: new Date().toISOString(),
      data: exportData,
      dataCategories: {
        sessions: exportData.metadata.totalSessions,
        messages: exportData.metadata.totalMessages,
      },
      processingPurpose: 'AI chat assistant - conversation history',
      legalBasis: 'User consent (GDPR Article 6.1.a)',
      retentionPeriod: '90 days (configurable)',
      thirdPartySharing: 'None - all data stored locally',
    };

    this.updateStatus(
      id,
      DSRStatus.COMPLETED,
      'Access request completed - data exported',
      response
    );

    // Audit log
    logAuditEvent(AuditEventType.DATA_EXPORT, 'SUCCESS', {
      action: 'dsr_access_completed',
      dsrId: id.substring(0, 8) + '...',
      sessionCount: exportData.metadata.totalSessions,
      messageCount: exportData.metadata.totalMessages,
    });

    return response;
  }

  /**
   * Process ERASURE request (GDPR Article 17)
   * Permanently deletes all user data
   */
  async processErasureRequest(id: string): Promise<Record<string, any>> {
    this.updateStatus(id, DSRStatus.IN_PROGRESS, 'Processing erasure request');

    const db = getSessionDatabase();

    // Get counts before deletion
    const sessions = db.getAllSessions();
    const messages = db.getAllMessages();

    // Delete all data
    db.deleteAllData();

    const response = {
      requestType: 'erasure',
      processedAt: new Date().toISOString(),
      deletedData: {
        sessions: sessions.length,
        messages: messages.length,
      },
      confirmation: 'All personal data has been permanently deleted',
      dataRetention: 'No data retained except this DSR request record (legal requirement)',
    };

    this.updateStatus(
      id,
      DSRStatus.COMPLETED,
      'Erasure request completed - all data deleted',
      response
    );

    // Audit log
    logAuditEvent(AuditEventType.DATA_DELETE_ALL, 'SUCCESS', {
      action: 'dsr_erasure_completed',
      dsrId: id.substring(0, 8) + '...',
      deletedSessions: sessions.length,
      deletedMessages: messages.length,
    });

    return response;
  }

  /**
   * Process PORTABILITY request (GDPR Article 20)
   * Returns data in machine-readable format
   */
  async processPortabilityRequest(id: string): Promise<Record<string, any>> {
    this.updateStatus(id, DSRStatus.IN_PROGRESS, 'Processing portability request');

    const db = getSessionDatabase();
    const exportData = db.exportAllData();

    const response = {
      requestType: 'portability',
      generatedAt: new Date().toISOString(),
      format: 'JSON',
      encoding: 'UTF-8',
      data: exportData,
      instructions: {
        description: 'This is your data in a structured, machine-readable format',
        usage: 'You can import this data to another service or store it for your records',
        format: 'JSON (JavaScript Object Notation)',
      },
    };

    this.updateStatus(
      id,
      DSRStatus.COMPLETED,
      'Portability request completed - data exported in JSON format',
      response
    );

    // Audit log
    logAuditEvent(AuditEventType.DATA_EXPORT, 'SUCCESS', {
      action: 'dsr_portability_completed',
      dsrId: id.substring(0, 8) + '...',
    });

    return response;
  }

  /**
   * Get overdue requests (past 30 days)
   */
  getOverdueRequests(): DSRRequest[] {
    return this.listRequests({ overdue: true });
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const stats = {
      total: this.db.query('SELECT COUNT(*) as count FROM dsr_requests').get() as { count: number },
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      overdue: this.getOverdueRequests().length,
      avgProcessingTimeHours: 0,
    };

    // Count by status
    const statusRows = this.db.query('SELECT status, COUNT(*) as count FROM dsr_requests GROUP BY status').all() as Array<{ status: string; count: number }>;
    for (const row of statusRows) {
      stats.byStatus[row.status] = row.count;
    }

    // Count by type
    const typeRows = this.db.query('SELECT type, COUNT(*) as count FROM dsr_requests GROUP BY type').all() as Array<{ type: string; count: number }>;
    for (const row of typeRows) {
      stats.byType[row.type] = row.count;
    }

    // Calculate average processing time for completed requests
    const completedRows = this.db.query(`
      SELECT created_at, completed_at
      FROM dsr_requests
      WHERE status = ? AND completed_at IS NOT NULL
    `).all(DSRStatus.COMPLETED) as Array<{ created_at: string; completed_at: string }>;

    if (completedRows.length > 0) {
      const totalHours = completedRows.reduce((sum, row) => {
        const created = new Date(row.created_at);
        const completed = new Date(row.completed_at);
        return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
      }, 0);
      stats.avgProcessingTimeHours = Math.round(totalHours / completedRows.length * 10) / 10;
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
let dsrManagerInstance: DSRWorkflowManager | null = null;

export function getDSRWorkflowManager(): DSRWorkflowManager {
  if (!dsrManagerInstance) {
    dsrManagerInstance = new DSRWorkflowManager();
  }
  return dsrManagerInstance;
}
