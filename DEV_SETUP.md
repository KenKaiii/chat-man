# Development Setup

## Quick Start

Start all services with a single command:

```bash
bun run start
```

This will start:
- **Ollama** (AI model server) on `http://localhost:11434`
- **Backend** (WebSocket + API server) on `http://localhost:3010`
- **Frontend** (React app) on `http://localhost:5173`

Press `Ctrl+C` to stop all servers.

## Environment Variables

Set your password before starting:

```bash
export CHAT_MAN_PASSWORD="YourSecurePassword123!"
bun run start
```

If not set, defaults to `TestPassword123!`

## Individual Services

Start services separately for debugging:

```bash
# Frontend only
bun run dev

# Backend only
CHAT_MAN_PASSWORD="YourPassword" bun run dev:server

# Ollama only
ollama serve
```

## Logs

Server logs are written to:
- Backend: `/tmp/chat-man-backend.log`
- Frontend: `/tmp/chat-man-frontend.log`

View logs in real-time:

```bash
# Backend logs
tail -f /tmp/chat-man-backend.log

# Frontend logs
tail -f /tmp/chat-man-frontend.log

# Both logs
tail -f /tmp/chat-man-backend.log /tmp/chat-man-frontend.log
```

## First Time Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Install Ollama:**
   ```bash
   # macOS
   brew install ollama

   # Or download from https://ollama.ai
   ```

3. **Pull a model:**
   ```bash
   ollama pull llama3.2:3b
   ```

4. **Start the app:**
   ```bash
   bun run start
   ```

5. **Open browser:**
   Navigate to `http://localhost:5173`

## Authentication

On first launch, you'll set up your master password:
- Must be at least 12 characters
- Must include uppercase, lowercase, number, and special character
- **Cannot be recovered if lost** - use a password manager!

After setup, use this password to login.

## Features

- ✅ **HIPAA/GDPR Compliant** - End-to-end encryption
- ✅ **Secure Authentication** - Argon2id password hashing
- ✅ **JWT Sessions** - 24-hour token expiry
- ✅ **WebSocket Authentication** - Secure real-time chat
- ✅ **PII/PHI Redaction** - Automatic log sanitization
- ✅ **Local-first** - All data stays on your machine

## Troubleshooting

### Port already in use

Kill existing processes:

```bash
# Kill backend (port 3010)
lsof -ti:3010 | xargs kill -9

# Kill frontend (port 5173)
lsof -ti:5173 | xargs kill -9

# Kill Ollama (port 11434)
lsof -ti:11434 | xargs kill -9
```

### Ollama not starting

Check if it's already running:

```bash
pgrep ollama
```

If running, restart it:

```bash
pkill ollama
ollama serve
```

### Database errors

Reset the database:

```bash
rm data/sessions.db
rm -rf data/rag-vectors/
bun run start
```

### Authentication issues

Clear auth data and restart:

```bash
rm data/encryption.json
bun run start
```

## Production Deployment

For production, use filesystem encryption:

**macOS:**
```bash
# FileVault (System Settings > Privacy & Security)
```

**Linux:**
```bash
# LUKS encryption
cryptsetup luksFormat /dev/sdX
```

**Windows:**
```bash
# BitLocker (Settings > Privacy & Security)
```

## Development

Run tests:

```bash
bun test
```

Type checking:

```bash
bun run typecheck
```

Linting:

```bash
bun run lint
```

Build for production:

```bash
bun run build
```
