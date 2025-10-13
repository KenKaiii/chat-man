/**
 * Chat Man - WebSocket server with Ollama integration
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ServerWebSocket } from 'bun';
import { checkOllamaHealth, streamChat, listModels, getDefaultModel } from './ollama';
import type {
  ChatMessage,
  StopGenerationMessage,
  OllamaChatMessage,
} from './types';
import { buildSystemContext, getModelConfig, loadSettings, reloadConfig } from './config';
import { handleRAGUpload, handleRAGQuery, handleRAGList, handleRAGDelete } from './rag-api';

const PORT = process.env.PORT || 3001;

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

// Track active generation streams per session
const activeGenerations = new Map<string, AbortController>();

// Conversation history per session (in-memory for demo)
const conversationHistory = new Map<string, OllamaChatMessage[]>();

// System context (loaded from config)
let systemContext = '';

// Model configuration
let modelConfig: Awaited<ReturnType<typeof getModelConfig>>;

// WebSocket handler
const server = Bun.serve({
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
        return Response.json(models);
      } catch (error) {
        return Response.json(
          { error: 'Failed to fetch models' },
          { status: 500 }
        );
      }
    }

    // Health check
    if (url.pathname === '/api/health') {
      const ollamaHealthy = await checkOllamaHealth();
      return Response.json({
        status: ollamaHealthy ? 'ok' : 'ollama_unavailable',
        ollama: ollamaHealthy,
      });
    }

    // Reload configuration
    if (url.pathname === '/api/reload-config' && req.method === 'POST') {
      try {
        const { systemContext: newContext, settings } = await reloadConfig();
        systemContext = newContext;
        modelConfig = settings.model;
        return Response.json({
          success: true,
          message: 'Configuration reloaded successfully',
        });
      } catch (error) {
        return Response.json(
          { error: 'Failed to reload configuration' },
          { status: 500 }
        );
      }
    }

    // Get current settings
    if (url.pathname === '/api/settings') {
      try {
        const settings = await loadSettings();
        return Response.json(settings);
      } catch (error) {
        return Response.json(
          { error: 'Failed to load settings' },
          { status: 500 }
        );
      }
    }

    // Get user config (optional display name, etc.)
    if (url.pathname === '/api/user-config') {
      try {
        // For now, return a default empty config
        // In the future, this could read from a user-config.json file
        return Response.json({
          displayName: null
        });
      } catch (error) {
        return Response.json(
          { error: 'Failed to load user config' },
          { status: 500 }
        );
      }
    }

    // RAG: Upload document
    if (url.pathname === '/api/rag/upload' && req.method === 'POST') {
      return await handleRAGUpload(req);
    }

    // RAG: Query documents
    if (url.pathname === '/api/rag/query' && req.method === 'POST') {
      return await handleRAGQuery(req);
    }

    // RAG: List documents
    if (url.pathname === '/api/rag/documents' && req.method === 'GET') {
      return await handleRAGList();
    }

    // RAG: Delete document
    if (url.pathname.startsWith('/api/rag/documents/') && req.method === 'DELETE') {
      const documentId = url.pathname.split('/').pop();
      if (documentId) {
        return await handleRAGDelete(documentId);
      }
    }

    return new Response('Not found', { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket) {
      console.log('✅ WebSocket client connected');
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
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },

    close(ws: ServerWebSocket) {
      console.log('❌ WebSocket client disconnected');
    },
  },
});

/**
 * Handle incoming chat messages
 */
async function handleChatMessage(ws: ServerWebSocket, data: ChatMessage) {
  const sessionId = data.sessionId || 'default';

  // Extract text content
  let userMessage = '';
  if (typeof data.content === 'string') {
    userMessage = data.content;
  } else if (Array.isArray(data.content)) {
    const textBlock = data.content.find(block => block.type === 'text');
    userMessage = textBlock?.text || '';
  }

  if (!userMessage.trim()) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Empty message',
      sessionId,
    }));
    return;
  }

  // Get or create conversation history
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  const history = conversationHistory.get(sessionId)!;

  // Add system context as first message if this is a new conversation
  if (history.length === 0 && systemContext) {
    history.push({
      role: 'system',
      content: systemContext,
    });
  }

  // Add user message to history
  history.push({
    role: 'user',
    content: userMessage,
  });

  // Get model (use default or from config if not specified)
  const model = data.model || modelConfig.name || await getDefaultModel();

  // Create abort controller for this generation
  const abortController = new AbortController();
  activeGenerations.set(sessionId, abortController);

  try {
    let fullResponse = '';
    let tokenCount = 0;

    // Stream response from Ollama with model config
    for await (const chunk of streamChat(model, history, {
      temperature: modelConfig.temperature,
      top_p: modelConfig.top_p,
      top_k: modelConfig.top_k,
    })) {
      // Check if generation was stopped
      if (abortController.signal.aborted) {
        console.log('Generation stopped for session:', sessionId);
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
        // Add assistant response to history
        history.push({
          role: 'assistant',
          content: fullResponse,
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
    console.error('Error streaming from Ollama:', error);

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
    console.log('Stopped generation for session:', sessionId);
  }
}

// Load configuration and check Ollama health on startup
(async () => {
  // Load configuration
  try {
    systemContext = await buildSystemContext();
    modelConfig = await getModelConfig();
    console.log('✅ Configuration loaded');
    console.log(`📝 System prompt: ${systemContext.split('\n')[0].substring(0, 60)}...`);
    console.log(`🎛️  Model config: ${modelConfig.name} (temp: ${modelConfig.temperature})`);
  } catch (error) {
    console.warn('⚠️  Failed to load configuration, using defaults');
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
    console.warn('⚠️  Ollama is not running or not accessible at http://localhost:11434');
    console.warn('   Please start Ollama: ollama serve');
    console.warn('   Or install it: https://ollama.ai');
  } else {
    console.log('✅ Ollama is running');
    try {
      const defaultModel = await getDefaultModel();
      console.log(`✅ Using model: ${defaultModel}`);
    } catch (error) {
      console.warn('⚠️  No models found. Install one with: ollama pull llama3.2');
    }
  }
})();

console.log(`🚀 Server running on http://localhost:${PORT}`);
console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
