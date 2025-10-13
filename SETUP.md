# Chat Man - Setup Guide

## ✅ What's Been Done

1. **Created Ollama Backend Integration**
   - `server/ollama.ts` - Ollama API client with streaming support
   - `server/server.ts` - WebSocket server for real-time chat
   - `server/types.ts` - Shared TypeScript types

2. **Updated Dependencies**
   - All packages updated to latest versions
   - Framer Motion: 12.23.22 → 12.23.24
   - Vite: 6.0.11 → 6.3.6
   - Tailwind: 4.1.11 → 4.1.14
   - TypeScript: 5.9.2 → 5.9.3
   - And more...

3. **Added Server Scripts**
   - `bun run dev` - Client only (Vite)
   - `bun run dev:server` - Server only (WebSocket)
   - `bun run dev:full` - Both client and server
   - `bun run start` - Production server

## 🚀 Quick Start

### 1. Install Ollama (if not already)

```bash
# macOS
brew install ollama

# Or download from https://ollama.ai
```

### 2. Start Ollama Service

```bash
ollama serve
```

**Note:** This needs to run in a separate terminal and stay running.

### 3. Pull a Model

```bash
# Recommended: Fast and capable
ollama pull llama3.2

# Or other models:
ollama pull mistral       # Great for coding
ollama pull codellama     # Code specialist
ollama pull phi3          # Microsoft's efficient model
```

### 4. Start Chat Man

```bash
cd /Users/kenkai/Documents/UnstableMind/chat-man

# Option A: Run everything together
bun run dev:full

# Option B: Run separately (two terminals)
# Terminal 1:
bun run dev:server

# Terminal 2:
bun run dev
```

### 5. Open Browser

Navigate to http://localhost:5173

## 🔌 Architecture

```
┌─────────────┐      WebSocket       ┌─────────────┐      HTTP      ┌─────────────┐
│   Browser   │◄────────────────────►│ Bun Server  │◄──────────────►│   Ollama    │
│  (React UI) │  ws://localhost:3001 │ (WebSocket) │ localhost:11434│  (Local LLM)│
└─────────────┘                       └─────────────┘                └─────────────┘
```

**Data Flow:**
1. User types message in React UI
2. WebSocket sends to Bun server
3. Server streams from Ollama
4. Real-time deltas sent back to UI
5. Smooth streaming display

## 📁 Project Structure

```
chat-man/
├── src/                    # React UI (client)
│   ├── components/         # UI components
│   ├── hooks/             # WebSocket, etc.
│   └── globals.css        # Styles
├── server/                # Backend (NEW!)
│   ├── server.ts          # WebSocket server
│   ├── ollama.ts          # Ollama integration
│   └── types.ts           # Shared types
├── public/
│   └── logo.svg           # App icon
└── package.json           # Scripts & deps
```

## 🔧 Configuration

### Environment Variables (Optional)

Create `.env` in the project root:

```env
# Ollama API URL
OLLAMA_BASE_URL=http://localhost:11434

# Server port
PORT=3001
```

### Available Models

Check what models you have:
```bash
ollama list
```

Pull more models:
```bash
ollama pull llama3.2:1b    # Ultra-fast (1B params)
ollama pull llama3.2       # Balanced (3B params)
ollama pull llama3.2:70b   # Most capable (70B params)
```

## 🎯 Key Features

✅ **Zero External Dependencies**
- No OpenAI API keys needed
- No internet required after model download
- Complete privacy - all data stays local

✅ **Real-time Streaming**
- WebSocket-based communication
- Smooth token-by-token display
- Automatic reconnection

✅ **Beautiful UI**
- Dark mode optimized
- Markdown rendering
- Code syntax highlighting
- Mermaid diagrams
- Smooth animations

## 🐛 Troubleshooting

### Server won't start: "Port 3001 in use"

```bash
lsof -ti:3001 | xargs kill -9
bun run dev:server
```

### "Ollama is not running"

```bash
# Start Ollama in a separate terminal
ollama serve
```

### "No models found"

```bash
# Pull a model first
ollama pull llama3.2
```

### Client can't connect to WebSocket

1. Make sure server is running: `bun run dev:server`
2. Check browser console for errors
3. Verify WebSocket URL: `ws://localhost:3001/ws`

## 📊 Dependency Audit Summary

All dependencies have been updated to latest versions:

**Major Updates:**
- ✅ Vite 6.0.11 → 6.3.6
- ✅ Tailwind 4.1.11 → 4.1.14
- ✅ TypeScript 5.9.2 → 5.9.3
- ✅ Framer Motion 12.23.22 → 12.23.24
- ✅ @vitejs/plugin-react 4.3.4 → 4.7.0

**Security:** Zero vulnerabilities found ✅

## 🎉 What's Next

The chat UI is now fully functional with:
- ✅ Complete frontend UI
- ✅ WebSocket backend
- ✅ Ollama integration
- ✅ Streaming support
- ✅ All dependencies updated

**To use it:**
1. Start Ollama: `ollama serve`
2. Pull a model: `ollama pull llama3.2`
3. Run chat-man: `bun run dev:full`
4. Chat with local AI! 🤖

---

**Made with ❤️ using Bun, React, and Ollama**
