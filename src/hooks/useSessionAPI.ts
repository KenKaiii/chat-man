/**
 * Chat Man - Generic chat interface component library
 * Copyright (C) 2025 KenKai
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useCallback } from 'react';
import { toast } from '../utils/toast';
import type { Message } from '../components/message/types';

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  mode: 'general' | 'rag' | 'spark' | 'voice';
}

// Use dynamic URL based on current window location (works on any port)
const API_BASE = `${window.location.protocol}//${window.location.host}/api`;

export function useSessionAPI() {

  /**
   * Fetch all sessions
   */
  const fetchSessions = useCallback(async (): Promise<Session[]> => {
    try {
      const response = await fetch(`${API_BASE}/sessions`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const sessions = await response.json() as Session[];
      return sessions;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch sessions';
      console.error('Failed to fetch sessions:', errorMsg);
      toast.error('Failed to load chats', {
        description: errorMsg,
      });
      return [];
    }
  }, []);

  /**
   * Fetch messages for a specific session
   */
  const fetchSessionMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const messages = await response.json() as Message[];
      return messages;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch messages';
      console.error('Failed to fetch messages:', errorMsg);
      toast.error('Failed to load messages', {
        description: errorMsg,
      });
      return [];
    }
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (mode?: 'general' | 'rag' | 'spark' | 'voice'): Promise<Session | null> => {
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: mode || 'general' }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const session = await response.json() as Session;
      return session;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create session';
      console.error('Failed to create session:', errorMsg);
      toast.error('Failed to create chat', {
        description: errorMsg,
      });
      return null;
    }
  }, []);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete session';
      console.error('Failed to delete session:', errorMsg);
      toast.error('Failed to delete chat', {
        description: errorMsg,
      });
      return false;
    }
  }, []);

  /**
   * Rename a session (update title)
   */
  const renameSession = useCallback(async (sessionId: string, newTitle: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to rename session';
      console.error('Failed to rename session:', errorMsg);
      toast.error('Failed to rename chat', {
        description: errorMsg,
      });
      return false;
    }
  }, []);

  return {
    fetchSessions,
    fetchSessionMessages,
    createSession,
    deleteSession,
    renameSession,
  };
}
