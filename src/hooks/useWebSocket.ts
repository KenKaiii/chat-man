/**
 * Chat Man - Modern chat interface for Claude Agent SDK
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { showError } from '../utils/errorMessages';

interface BaseWebSocketMessage {
  type: string;
  sessionId?: string;
}

interface AssistantMessageEvent extends BaseWebSocketMessage {
  type: 'assistant_message';
  content: string;
}

interface ToolUseEvent extends BaseWebSocketMessage {
  type: 'tool_use';
  toolId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

interface ResultEvent extends BaseWebSocketMessage {
  type: 'result';
}

interface ErrorEvent extends BaseWebSocketMessage {
  type: 'error';
  message?: string;
  error?: string;
}

interface UserMessageEvent extends BaseWebSocketMessage {
  type: 'user_message';
}

interface ExitPlanModeEvent extends BaseWebSocketMessage {
  type: 'exit_plan_mode';
  plan?: string;
}

interface PermissionModeChangedEvent extends BaseWebSocketMessage {
  type: 'permission_mode_changed';
  mode: string;
}

interface BackgroundProcessStartedEvent extends BaseWebSocketMessage {
  type: 'background_process_started';
  bashId: string;
  command: string;
  description: string;
}

interface BackgroundProcessKilledEvent extends BaseWebSocketMessage {
  type: 'background_process_killed';
  bashId: string;
}

interface BackgroundProcessExitedEvent extends BaseWebSocketMessage {
  type: 'background_process_exited';
  bashId: string;
  exitCode: number;
}

interface TimeoutWarningEvent extends BaseWebSocketMessage {
  type: 'timeout_warning';
  message: string;
  elapsedSeconds: number;
}

interface RetryAttemptEvent extends BaseWebSocketMessage {
  type: 'retry_attempt';
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  errorType: string;
  message: string;
}

interface TokenUpdateEvent extends BaseWebSocketMessage {
  type: 'token_update';
  outputTokens: number;
}

interface ThinkingStartEvent extends BaseWebSocketMessage {
  type: 'thinking_start';
}

interface ThinkingDeltaEvent extends BaseWebSocketMessage {
  type: 'thinking_delta';
  content: string;
}

interface SlashCommand {
  name: string;
  description: string;
  argumentHint: string;
}

interface SlashCommandsAvailableEvent extends BaseWebSocketMessage {
  type: 'slash_commands_available';
  commands: SlashCommand[];
}

export type WebSocketMessage =
  | AssistantMessageEvent
  | ToolUseEvent
  | ResultEvent
  | ErrorEvent
  | UserMessageEvent
  | ExitPlanModeEvent
  | PermissionModeChangedEvent
  | BackgroundProcessStartedEvent
  | BackgroundProcessKilledEvent
  | BackgroundProcessExitedEvent
  | TimeoutWarningEvent
  | RetryAttemptEvent
  | TokenUpdateEvent
  | ThinkingStartEvent
  | ThinkingDeltaEvent
  | SlashCommandsAvailableEvent
  | BaseWebSocketMessage; // Fallback for unknown types

export type { SlashCommand };

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<string[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(false);

  // Use refs for callbacks to prevent reconnections when they change
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onMessage, onConnect, onDisconnect, onError]);

  const connect = useCallback(() => {
    // Don't attempt connection if already connected or if we've exceeded max attempts
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();

        // Send any queued messages
        while (messageQueueRef.current.length > 0) {
          const msg = messageQueueRef.current.shift();
          if (msg) ws.send(msg);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessageRef.current?.(message);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown parse error';
          showError('WEBSOCKET_PARSE', errorMsg);
        }
      };

      ws.onerror = (error) => {
        onErrorRef.current?.(error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnectRef.current?.();
        wsRef.current = null;

        // Only attempt reconnection if still mounted
        if (isMountedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    } catch {
      // Failed to create WebSocket connection
    }
  }, [url, maxReconnectAttempts, reconnectDelay]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    const messageStr = JSON.stringify(message);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(messageStr);
    } else {
      // Queue the message if not connected
      messageQueueRef.current.push(messageStr);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const stopGeneration = useCallback((sessionId: string) => {
    // Send proper stop_generation message to trigger SDK AbortController
    sendMessage({
      type: 'stop_generation',
      sessionId: sessionId,
    });
  }, [sendMessage]);

  // Initialize connection
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      // Clear reconnection timeout on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
    reconnect: connect,
    stopGeneration,
  };
}