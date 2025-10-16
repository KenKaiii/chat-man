/**
 * Chat Man - Ollama API integration
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type {
  OllamaListResponse,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaChatMessage,
} from './types';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/**
 * Check if Ollama is running and accessible
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch (error) {
    console.error('Ollama health check failed:', error);
    return false;
  }
}

/**
 * List all available models from Ollama
 */
export async function listModels(): Promise<OllamaListResponse> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Stream chat completion from Ollama
 */
export async function* streamChat(
  model: string,
  messages: OllamaChatMessage[],
  options?: { temperature?: number; top_p?: number; top_k?: number }
): AsyncGenerator<OllamaChatResponse> {
  const requestBody: OllamaChatRequest = {
    model,
    messages,
    stream: true,
    options,
  };

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body from Ollama');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON objects
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: OllamaChatResponse = JSON.parse(line);
            yield data;
          } catch (e) {
            console.error('Failed to parse Ollama response:', e);
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      try {
        const data: OllamaChatResponse = JSON.parse(buffer);
        yield data;
      } catch (e) {
        console.error('Failed to parse final Ollama response:', e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get the default model with priority for tool calling and accessibility
 * Priority: Llama 3.2 3B (best for 8GB RAM + tool calling)
 */
export async function getDefaultModel(): Promise<string> {
  try {
    const { models } = await listModels();

    if (models.length === 0) {
      console.log('ℹ️  No models installed yet - you can download one from the UI');
      return 'llama3.2:3b'; // Return recommended model for UI to prompt download
    }

    // Priority order: best for tool calling + accessibility (8GB RAM+)
    const preferredModels = [
      'llama3.2:3b-instruct-q4_K_M',  // Best overall: tool calling + 4-5GB RAM
      'llama3.2:3b',                   // Fallback without quantization
      'qwen2.5:7b-instruct-q4_K_M',   // If more RAM available (12GB+)
      'mistral:7b-instruct-q4_K_M',   // Alternative 7B option
      'llama3.1:8b',                   // Legacy support
      'llama3.2',                      // Any llama3.2 variant
    ];

    // Try to find preferred models in order
    for (const preferred of preferredModels) {
      const found = models.find(m => m.name === preferred || m.name.includes(preferred));
      if (found) {
        console.log(`✅ Using model: ${found.name}`);
        return found.name;
      }
    }

    // Fallback to first available model
    console.log(`⚠️  Using first available model: ${models[0].name}`);
    return models[0].name;
  } catch (error) {
    console.error('Failed to get default model:', error);
    return 'llama3.2:3b'; // Fallback
  }
}

/**
 * Get recommended model for setup
 */
export function getRecommendedModel(): string {
  return 'llama3.2:3b';
}

/**
 * Pull/download a model from Ollama with progress tracking
 * Returns an async generator that yields progress updates
 */
export async function* pullModelWithProgress(
  modelName: string,
  abortSignal?: AbortSignal
): AsyncGenerator<{
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  progress?: number;
}> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: modelName,
      stream: true,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(`Failed to pull model: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body from Ollama');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield {
              status: data.status,
              digest: data.digest,
              total: data.total,
              completed: data.completed,
              progress: data.total && data.completed ? (data.completed / data.total) * 100 : undefined,
            };
          } catch (e) {
            console.error('Failed to parse Ollama pull response:', e);
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        yield {
          status: data.status,
          digest: data.digest,
          total: data.total,
          completed: data.completed,
          progress: data.total && data.completed ? (data.completed / data.total) * 100 : undefined,
        };
      } catch (e) {
        console.error('Failed to parse final Ollama pull response:', e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
