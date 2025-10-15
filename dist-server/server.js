// @bun
// server/ollama.ts
var OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch (error) {
    console.error("Ollama health check failed:", error);
    return false;
  }
}
async function listModels() {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }
  return await response.json();
}
async function* streamChat(model, messages, options) {
  const requestBody = {
    model,
    messages,
    stream: true,
    options
  };
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error("No response body from Ollama");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(`
`);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield data;
          } catch (e) {
            console.error("Failed to parse Ollama response:", e);
          }
        }
      }
    }
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        yield data;
      } catch (e) {
        console.error("Failed to parse final Ollama response:", e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
async function getDefaultModel() {
  try {
    const { models } = await listModels();
    if (models.length === 0) {
      throw new Error("No Ollama models found. Run setup: bun run setup");
    }
    const preferredModels = [
      "llama3.2:3b-instruct-q4_K_M",
      "llama3.2:3b",
      "qwen2.5:7b-instruct-q4_K_M",
      "mistral:7b-instruct-q4_K_M",
      "llama3.1:8b",
      "llama3.2"
    ];
    for (const preferred of preferredModels) {
      const found = models.find((m) => m.name === preferred || m.name.includes(preferred));
      if (found) {
        console.log(`\u2705 Using model: ${found.name}`);
        return found.name;
      }
    }
    console.log(`\u26A0\uFE0F  Using first available model: ${models[0].name}`);
    return models[0].name;
  } catch (error) {
    console.error("Failed to get default model:", error);
    return "llama3.2:3b";
  }
}

// server/config.ts
import { readFile } from "fs/promises";
import { join } from "path";
var CONFIG_DIR = join(process.cwd(), "config");
async function loadSystemPrompt() {
  try {
    const path = join(CONFIG_DIR, "system-prompt.txt");
    return await readFile(path, "utf-8");
  } catch (error) {
    console.warn("\u26A0\uFE0F  Could not load system-prompt.txt, using default");
    return "You are a helpful AI assistant.";
  }
}
async function loadKnowledge() {
  try {
    const path = join(CONFIG_DIR, "knowledge.md");
    return await readFile(path, "utf-8");
  } catch (error) {
    console.warn("\u26A0\uFE0F  Could not load knowledge.md, skipping");
    return "";
  }
}
async function loadSettings() {
  try {
    const path = join(CONFIG_DIR, "settings.json");
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn("\u26A0\uFE0F  Could not load settings.json, using defaults");
    return {
      model: {
        name: "llama3.2:3b",
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        max_tokens: 2048
      },
      system: {
        enableKnowledgeBase: true,
        enableSystemPrompt: true,
        streamingEnabled: true
      },
      ui: {
        appName: "Chat Man",
        welcomeMessage: "Welcome! How can I help you today?",
        placeholder: "Type a message...",
        theme: "dark"
      }
    };
  }
}
async function buildSystemContext() {
  const settings = await loadSettings();
  const parts = [];
  if (settings.system.enableSystemPrompt) {
    const systemPrompt = await loadSystemPrompt();
    if (systemPrompt) {
      parts.push(systemPrompt);
    }
  }
  if (settings.system.enableKnowledgeBase) {
    const knowledge = await loadKnowledge();
    if (knowledge && knowledge.trim().length > 0) {
      parts.push(`

---

# Knowledge Base

` + knowledge);
    }
  }
  return parts.join(`
`).trim();
}
async function getModelConfig() {
  const settings = await loadSettings();
  return settings.model;
}
async function reloadConfig() {
  console.log("\uD83D\uDD04 Reloading configuration...");
  const systemContext = await buildSystemContext();
  const settings = await loadSettings();
  console.log("\u2705 Configuration reloaded");
  return { systemContext, settings };
}

// server/server.ts
var PORT = process.env.PORT || 3010;
var activeGenerations = new Map;
var conversationHistory = new Map;
var systemContext = "";
var modelConfig;
var server = Bun.serve({
  port: PORT,
  async fetch(req, server2) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const upgraded = server2.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return;
    }
    if (url.pathname === "/api/models") {
      try {
        const models = await listModels();
        return Response.json(models);
      } catch (error) {
        return Response.json({ error: "Failed to fetch models" }, { status: 500 });
      }
    }
    if (url.pathname === "/api/health") {
      const ollamaHealthy = await checkOllamaHealth();
      return Response.json({
        status: ollamaHealthy ? "ok" : "ollama_unavailable",
        ollama: ollamaHealthy
      });
    }
    if (url.pathname === "/api/reload-config" && req.method === "POST") {
      try {
        const { systemContext: newContext, settings } = await reloadConfig();
        systemContext = newContext;
        modelConfig = settings.model;
        return Response.json({
          success: true,
          message: "Configuration reloaded successfully"
        });
      } catch (error) {
        return Response.json({ error: "Failed to reload configuration" }, { status: 500 });
      }
    }
    if (url.pathname === "/api/settings") {
      try {
        const settings = await loadSettings();
        return Response.json(settings);
      } catch (error) {
        return Response.json({ error: "Failed to load settings" }, { status: 500 });
      }
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      console.log("\u2705 WebSocket client connected");
    },
    async message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "chat") {
          await handleChatMessage(ws, data);
        } else if (data.type === "stop_generation") {
          handleStopGeneration(data);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error"
        }));
      }
    },
    close(ws) {
      console.log("\u274C WebSocket client disconnected");
    }
  }
});
async function handleChatMessage(ws, data) {
  const sessionId = data.sessionId || "default";
  let userMessage = "";
  if (typeof data.content === "string") {
    userMessage = data.content;
  } else if (Array.isArray(data.content)) {
    const textBlock = data.content.find((block) => block.type === "text");
    userMessage = textBlock?.text || "";
  }
  if (!userMessage.trim()) {
    ws.send(JSON.stringify({
      type: "error",
      message: "Empty message",
      sessionId
    }));
    return;
  }
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  const history = conversationHistory.get(sessionId);
  if (history.length === 0 && systemContext) {
    history.push({
      role: "system",
      content: systemContext
    });
  }
  history.push({
    role: "user",
    content: userMessage
  });
  const model = data.model || modelConfig.name || await getDefaultModel();
  const abortController = new AbortController;
  activeGenerations.set(sessionId, abortController);
  try {
    let fullResponse = "";
    let tokenCount = 0;
    for await (const chunk of streamChat(model, history, {
      temperature: modelConfig.temperature,
      top_p: modelConfig.top_p,
      top_k: modelConfig.top_k
    })) {
      if (abortController.signal.aborted) {
        console.log("Generation stopped for session:", sessionId);
        break;
      }
      if (chunk.message?.content) {
        fullResponse += chunk.message.content;
        tokenCount++;
        ws.send(JSON.stringify({
          type: "assistant_message",
          content: chunk.message.content,
          sessionId
        }));
        if (tokenCount % 10 === 0) {
          ws.send(JSON.stringify({
            type: "token_update",
            outputTokens: tokenCount,
            sessionId
          }));
        }
      }
      if (chunk.done) {
        history.push({
          role: "assistant",
          content: fullResponse
        });
        ws.send(JSON.stringify({
          type: "token_update",
          outputTokens: tokenCount,
          sessionId
        }));
        ws.send(JSON.stringify({
          type: "result",
          sessionId
        }));
        break;
      }
    }
  } catch (error) {
    console.error("Error streaming from Ollama:", error);
    let errorMessage = "An error occurred while generating response";
    let errorType = "unknown_error";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes("ECONNREFUSED")) {
        errorMessage = "Ollama is not running. Please start Ollama first.";
        errorType = "ollama_unavailable";
      }
    }
    ws.send(JSON.stringify({
      type: "error",
      message: errorMessage,
      errorType,
      sessionId
    }));
  } finally {
    activeGenerations.delete(sessionId);
  }
}
function handleStopGeneration(data) {
  const sessionId = data.sessionId;
  const abortController = activeGenerations.get(sessionId);
  if (abortController) {
    abortController.abort();
    activeGenerations.delete(sessionId);
    console.log("Stopped generation for session:", sessionId);
  }
}
(async () => {
  try {
    systemContext = await buildSystemContext();
    modelConfig = await getModelConfig();
    console.log("\u2705 Configuration loaded");
    console.log(`\uD83D\uDCDD System prompt: ${systemContext.split(`
`)[0].substring(0, 60)}...`);
    console.log(`\uD83C\uDF9B\uFE0F  Model config: ${modelConfig.name} (temp: ${modelConfig.temperature})`);
  } catch (error) {
    console.warn("\u26A0\uFE0F  Failed to load configuration, using defaults");
    modelConfig = {
      name: "llama3.2:3b",
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      max_tokens: 2048
    };
  }
  const healthy = await checkOllamaHealth();
  if (!healthy) {
    console.warn("\u26A0\uFE0F  Ollama is not running or not accessible at http://localhost:11434");
    console.warn("   Please start Ollama: ollama serve");
    console.warn("   Or install it: https://ollama.ai");
  } else {
    console.log("\u2705 Ollama is running");
    try {
      const defaultModel = await getDefaultModel();
      console.log(`\u2705 Using model: ${defaultModel}`);
    } catch (error) {
      console.warn("\u26A0\uFE0F  No models found. Install one with: ollama pull llama3.2");
    }
  }
})();
console.log(`\uD83D\uDE80 Server running on http://localhost:${PORT}`);
console.log(`\uD83D\uDD0C WebSocket endpoint: ws://localhost:${PORT}/ws`);
