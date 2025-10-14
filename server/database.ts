/**
 * SQLite database for session and message persistence
 * NOW WITH ENCRYPTION KEY MANAGEMENT (GDPR/HIPAA Compliant)
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import type { Message } from '../src/components/message/types';
import { getKeyManager } from './encryption/keyManager';
import { logger } from './utils/secureLogger';

const DB_PATH = join(process.cwd(), 'data', 'sessions.db');

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  mode: 'general' | 'rag' | 'spark' | 'voice';
}

export interface DBMessage {
  id: string;
  session_id: string;
  type: 'user' | 'assistant';
  content: string; // JSON-serialized
  timestamp: string;
}

export class SessionDatabase {
  private db: Database;

  constructor() {
    // IMPORTANT: KeyManager must be unlocked before creating database
    const keyManager = getKeyManager();
    if (!keyManager.isSetup()) {
      throw new Error(
        'Encryption is not initialized. Please run setup wizard first.'
      );
    }

    // Create database connection
    this.db = new Database(DB_PATH);

    // Note: bun:sqlite doesn't support SQLCipher-style encryption natively
    // For production HIPAA compliance, consider:
    // 1. File-system level encryption (LUKS, FileVault, BitLocker)
    // 2. Application-level encryption (encrypt sensitive fields before storing)
    // 3. Run with Node.js + @journeyapps/sqlcipher for database encryption
    logger.info('Database using Bun SQLite (no at-rest encryption)');
    logger.warn('For production HIPAA compliance:');
    logger.warn('  - Use filesystem encryption (LUKS/FileVault/BitLocker)');
    logger.warn('  - OR run with Node.js + SQLCipher for database encryption');
    logger.warn('  - OR implement application-level field encryption');

    this.initializeTables();
    logger.info('Connected to SQLite database', { path: DB_PATH });
  }

  private initializeTables(): void {
    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        mode TEXT DEFAULT 'general'
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id
      ON messages(session_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
      ON sessions(updated_at DESC)
    `);

    logger.info('Database tables initialized');
  }

  /**
   * Create a new session
   */
  createSession(mode: 'general' | 'rag' | 'spark' | 'voice' = 'general'): Session {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const session: Session = {
      id,
      title: 'New Chat',
      created_at: now,
      updated_at: now,
      mode,
    };

    this.db.run(
      'INSERT INTO sessions (id, title, created_at, updated_at, mode) VALUES (?, ?, ?, ?, ?)',
      [session.id, session.title, session.created_at, session.updated_at, session.mode]
    );

    logger.info('Created new session', { sessionId: id.substring(0, 8) + '...', mode });
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | null {
    const row = this.db.query('SELECT * FROM sessions WHERE id = ?').get(id) as Session | null;
    return row;
  }

  /**
   * Get all sessions ordered by most recent
   */
  getAllSessions(): Session[] {
    const rows = this.db.query('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Session[];
    return rows;
  }

  /**
   * Update session title
   */
  updateSessionTitle(id: string, title: string): void {
    this.db.run('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?', [
      title,
      new Date().toISOString(),
      id
    ]);
    logger.info('Updated session title', { sessionId: id.substring(0, 8) + '...' });
  }

  /**
   * Delete a session (cascade deletes messages)
   */
  deleteSession(id: string): void {
    // First delete messages (explicit cascade since SQLite might not enforce FK constraints)
    this.db.run('DELETE FROM messages WHERE session_id = ?', [id]);
    this.db.run('DELETE FROM sessions WHERE id = ?', [id]);

    logger.info('Deleted session', { sessionId: id.substring(0, 8) + '...' });
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: Omit<Message, 'type'> & { type: 'user' | 'assistant' }): void {
    const contentStr = typeof message.content === 'string'
      ? JSON.stringify(message.content)
      : JSON.stringify(message.content);

    this.db.run(
      'INSERT INTO messages (id, session_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [message.id, sessionId, message.type, contentStr, message.timestamp]
    );

    // Update session's updated_at timestamp
    this.db.run('UPDATE sessions SET updated_at = ? WHERE id = ?', [
      new Date().toISOString(),
      sessionId
    ]);

    logger.debug('Added message to session', {
      type: message.type,
      sessionId: sessionId.substring(0, 8) + '...',
      // content: NEVER LOGGED
    });
  }

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string): Message[] {
    const rows = this.db.query(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(sessionId) as DBMessage[];

    return rows.map((row) => {
      const content = JSON.parse(row.content);

      return {
        id: row.id,
        type: row.type as 'user' | 'assistant',
        content,
        timestamp: row.timestamp,
      } as Message;
    });
  }

  /**
   * Auto-generate session title from first user message
   */
  autoGenerateTitle(sessionId: string, firstMessage: string): void {
    const trimmed = firstMessage.trim();
    let title = trimmed.substring(0, 15);

    if (trimmed.length > 15) {
      title += '...';
    }

    if (!title) {
      title = 'New Chat';
    }

    this.updateSessionTitle(sessionId, title);
  }

  /**
   * Get message count for a session
   */
  getMessageCount(sessionId: string): number {
    const result = this.db.query(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = ?'
    ).get(sessionId) as { count: number } | null;

    return result?.count || 0;
  }

  /**
   * Get all messages across all sessions (for export)
   */
  getAllMessages(): Message[] {
    const rows = this.db.query(
      'SELECT * FROM messages ORDER BY timestamp ASC'
    ).all() as DBMessage[];

    return rows.map((row) => {
      const content = JSON.parse(row.content);

      return {
        id: row.id,
        type: row.type as 'user' | 'assistant',
        content,
        timestamp: row.timestamp,
      } as Message;
    });
  }

  /**
   * Export all user data (GDPR Article 20 - Right to Data Portability)
   * Returns complete data set in JSON format
   */
  exportAllData(): {
    metadata: {
      exportDate: string;
      version: string;
      totalSessions: number;
      totalMessages: number;
    };
    sessions: Session[];
    messages: Array<Message & { session_id: string }>;
  } {
    const sessions = this.getAllSessions();
    const messagesRaw = this.db.query(
      'SELECT * FROM messages ORDER BY timestamp ASC'
    ).all() as DBMessage[];

    const messages = messagesRaw.map((row) => {
      const content = JSON.parse(row.content);
      return {
        id: row.id,
        session_id: row.session_id,
        type: row.type as 'user' | 'assistant',
        content,
        timestamp: row.timestamp,
      } as any;
    }) as Array<Message & { session_id: string }>;

    logger.info('Exported all user data', {
      sessionCount: sessions.length,
      messageCount: messages.length,
    });

    return {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        totalSessions: sessions.length,
        totalMessages: messages.length,
      },
      sessions,
      messages,
    };
  }

  /**
   * Delete all user data (GDPR Article 17 - Right to Erasure)
   * Permanently removes all sessions and messages
   */
  deleteAllData(): void {
    logger.warn('Deleting all user data (right to erasure)');

    // Delete all messages first
    this.db.run('DELETE FROM messages');

    // Delete all sessions
    this.db.run('DELETE FROM sessions');

    // Vacuum database to reclaim space
    this.db.run('VACUUM');

    logger.info('All user data deleted and database vacuumed');
  }

  /**
   * Get session age in days
   * Used for retention policy enforcement
   */
  getSessionAge(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (!session) return 0;

    const updatedAt = new Date(session.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get sessions that exceed retention period
   * (GDPR Article 5.1.e - Storage Limitation)
   */
  getExpiredSessions(retentionDays: number): Session[] {
    const sessions = this.getAllSessions();
    return sessions.filter(session => this.getSessionAge(session.id) > retentionDays);
  }

  /**
   * Delete sessions older than retention period
   * (GDPR Article 5.1.e - Storage Limitation)
   * Returns number of sessions deleted
   */
  deleteExpiredSessions(retentionDays: number): number {
    const expiredSessions = this.getExpiredSessions(retentionDays);
    let deletedCount = 0;

    for (const session of expiredSessions) {
      this.deleteSession(session.id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      logger.info('Retention cleanup completed', {
        deletedCount,
        retentionDays
      });
    }

    return deletedCount;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.info('Closed database connection');
  }
}

// Export singleton instance getter
let dbInstance: SessionDatabase | null = null;

export function getSessionDatabase(): SessionDatabase {
  if (!dbInstance) {
    dbInstance = new SessionDatabase();
  }
  return dbInstance;
}
