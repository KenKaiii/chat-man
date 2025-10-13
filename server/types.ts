/**
 * Chat Man - Shared types for client and server
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
}

export interface ChatMessage extends WebSocketMessage {
  type: 'chat';
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
  model?: string;
  mode?: 'general' | 'rag' | 'spark' | 'voice';
}

export interface StopGenerationMessage extends WebSocketMessage {
  type: 'stop_generation';
  sessionId: string;
}

export interface AssistantMessageEvent extends WebSocketMessage {
  type: 'assistant_message';
  content: string;
}

export interface ThinkingStartEvent extends WebSocketMessage {
  type: 'thinking_start';
}

export interface ThinkingDeltaEvent extends WebSocketMessage {
  type: 'thinking_delta';
  content: string;
}

export interface TokenUpdateEvent extends WebSocketMessage {
  type: 'token_update';
  outputTokens: number;
}

export interface ResultEvent extends WebSocketMessage {
  type: 'result';
}

export interface ErrorEvent extends WebSocketMessage {
  type: 'error';
  message: string;
  errorType?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaListResponse {
  models: OllamaModel[];
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}
