/**
 * SQLite database for session and message persistence
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import type { Message } from '../src/components/message/types';

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
    this.db = new Database(DB_PATH, { create: true });
    this.initializeTables();
    console.log('✅ Connected to SQLite database at:', DB_PATH);
  }

  private initializeTables(): void {
    // Create sessions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        mode TEXT DEFAULT 'general'
      )
    `);

    // Create messages table
    this.db.run(`
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
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id
      ON messages(session_id)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
      ON sessions(updated_at DESC)
    `);

    console.log('✅ Database tables initialized');
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

    console.log(`✅ Created new session: ${id} (${mode})`);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | null {
    const row = this.db.query('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
    return row || null;
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
      id,
    ]);
    console.log(`✅ Updated session title: ${id} -> "${title}"`);
  }

  /**
   * Delete a session (cascade deletes messages)
   */
  deleteSession(id: string): void {
    // First delete messages (explicit cascade since SQLite might not enforce FK constraints)
    this.db.run('DELETE FROM messages WHERE session_id = ?', [id]);
    this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
    console.log(`✅ Deleted session: ${id}`);
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
      sessionId,
    ]);

    console.log(`✅ Added ${message.type} message to session ${sessionId}`);
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
    ).get(sessionId) as { count: number } | undefined;

    return result?.count || 0;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    console.log('✅ Closed database connection');
  }
}
