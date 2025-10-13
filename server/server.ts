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
import { retrieveContext } from './rag/retriever';
import { SessionDatabase } from './database';

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

// Initialize database
const db = new SessionDatabase();

// Track active generation streams per session
const activeGenerations = new Map<string, AbortController>();

// System context (loaded from config)
let systemContext = '';

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
      } catch (_error) {
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
      } catch (_error) {
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
      } catch (_error) {
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
      } catch (_error) {
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

    // Session Management: Get all sessions
    if (url.pathname === '/api/sessions' && req.method === 'GET') {
      const sessions = db.getAllSessions();
      return addCorsHeaders(Response.json(sessions));
    }

    // Session Management: Create new session
    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const body = await req.json() as { mode?: 'general' | 'rag' | 'spark' | 'voice' };
      const session = db.createSession(body.mode);
      return addCorsHeaders(Response.json(session));
    }

    // Session Management: Get specific session
    if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'GET') {
      const id = url.pathname.split('/').pop()!;
      const session = db.getSession(id);
      if (!session) {
        return addCorsHeaders(Response.json({ error: 'Session not found' }, { status: 404 }));
      }
      return addCorsHeaders(Response.json(session));
    }

    // Session Management: Get session messages
    if (url.pathname.match(/^\/api\/sessions\/[^/]+\/messages$/) && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      const messages = db.getMessages(id);
      return addCorsHeaders(Response.json(messages));
    }

    // Session Management: Update session (rename)
    if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'PATCH') {
      const id = url.pathname.split('/').pop()!;
      const body = await req.json() as { title: string };
      db.updateSessionTitle(id, body.title);
      return addCorsHeaders(Response.json({ success: true }));
    }

    // Session Management: Delete session
    if (url.pathname.match(/^\/api\/sessions\/[^/]+$/) && req.method === 'DELETE') {
      const id = url.pathname.split('/').pop()!;
      db.deleteSession(id);
      return addCorsHeaders(Response.json({ success: true }));
    }

    return new Response('Not found', { status: 404 });
  },

  websocket: {
    open(_ws: ServerWebSocket) {
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

    close(_ws: ServerWebSocket) {
      console.log('❌ WebSocket client disconnected');
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

  // Debug: Log incoming message
  console.log('📨 Received chat message:', { mode: data.mode, sessionId });

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

  // Get or create session
  let session = db.getSession(sessionId);
  if (!session) {
    session = db.createSession(data.mode || 'general');
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
      console.log('🔍 RAG mode enabled, retrieving context for:', userMessage.substring(0, 60) + '...');
      // Note: Documents are global, but context injection is session-specific
      // because it's only added to this session's in-memory history and not saved to DB
      const ragResult = await retrieveContext(userMessage, { topK: 5 });

      if (ragResult.context && ragResult.chunks.length > 0) {
        console.log(`✅ Retrieved ${ragResult.chunks.length} relevant document chunks`);
        console.log('📄 Context preview:', ragResult.context.substring(0, 200) + '...');

        // Inject RAG context as USER message with special formatting
        // (Ollama handles multiple system messages poorly)
        const ragContextMessage = `[Context from uploaded documents]:\n\n${ragResult.context}\n\n[End of context]\n\nNow please answer this question based on the context above: ${userMessage}`;

        // Replace the last user message with one that includes context
        history[history.length - 1] = {
          role: 'user',
          content: ragContextMessage
        };

        console.log('💬 Injected RAG context into user message');
      } else {
        console.log('⚠️  No relevant context found in uploaded documents');
      }
    } catch (error) {
      console.error('❌ Error retrieving RAG context:', error);
      // Continue without RAG context
    }
  }

  // Get model (use default or from config if not specified)
  const model = data.model || modelConfig.name || await getDefaultModel();

  console.log(`🤖 Sending ${history.length} messages to Ollama (model: ${model})`);
  console.log('📋 History structure:', history.map(m => ({ role: m.role, contentLength: m.content.length })));

  // Create abort controller for this generation
  const abortController = new AbortController();
  activeGenerations.set(sessionId, abortController);

  try {
    let fullResponse = '';
    let tokenCount = 0;

    console.log('⏳ Starting Ollama stream...');

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
  } catch (_error) {
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
    } catch (_error) {
      console.warn('⚠️  No models found. Install one with: ollama pull llama3.2');
    }
  }
})();

console.log(`🚀 Server running on http://localhost:${PORT}`);
console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
