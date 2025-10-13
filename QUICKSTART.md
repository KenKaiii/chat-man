# Chat Man - Quick Start Guide

Get up and running with local AI chat in 3 commands!

## 🚀 Super Quick Start (Recommended)

```bash
# 1. Clone or navigate to chat-man
cd chat-man

# 2. Install dependencies
bun install

# 3. Run automated setup (installs Ollama + model)
bun run setup

# 4. Start the app
bun run dev:full
```

That's it! Open http://localhost:5173 and start chatting with your local AI.

## 📋 What `bun run setup` Does

The setup script automatically:
1. ✅ Checks if Ollama is installed (installs if needed on Mac/Linux)
2. ✅ Starts the Ollama service
3. ✅ Downloads Llama 3.2 3B model (~2GB, best for most machines)
4. ✅ Verifies everything works

**No manual steps required!**

## 💻 System Requirements

### Minimum (Most Offices)
- **RAM:** 8GB
- **Storage:** 3GB free
- **OS:** macOS, Linux, or Windows

### Recommended
- **RAM:** 12GB+
- **Storage:** 5GB+ free (for multiple models)

## 🎯 The Model We Install

**Llama 3.2 3B-Instruct**
- ✅ Size: ~2GB download
- ✅ RAM: 4-5GB when running
- ✅ Features: Tool calling, RAG, fast responses
- ✅ Works on: 99% of computers (8GB RAM+)

This model was chosen for:
- **Accessibility** - Runs on most machines
- **Speed** - Sub-second responses
- **Capability** - Native tool calling for complex tasks
- **Quality** - Maintained by Meta

## 🔧 Manual Setup (If Script Fails)

### macOS
```bash
# Install Ollama
brew install ollama

# Start Ollama
ollama serve  # Keep this running in a separate terminal

# Download model
ollama pull llama3.2:3b

# Start Chat Man
bun run dev:full
```

### Linux
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve  # Keep this running

# Download model
ollama pull llama3.2:3b

# Start Chat Man
bun run dev:full
```

### Windows
1. Download Ollama from https://ollama.ai/download
2. Install and run Ollama
3. Open PowerShell:
   ```powershell
   ollama pull llama3.2:3b
   cd chat-man
   bun run dev:full
   ```

## 🎨 Available Commands

```bash
bun run setup       # Automated setup (first time)
bun run dev:full    # Start everything (server + UI)
bun run dev         # UI only (if server already running)
bun run dev:server  # Server only
bun run start       # Production mode
```

## 🤔 Troubleshooting

### "Ollama is not running"
```bash
# Start Ollama in a separate terminal
ollama serve
```

### "Port 3001 already in use"
```bash
# Kill the process
lsof -ti:3001 | xargs kill -9

# Restart
bun run dev:full
```

### "No models found"
```bash
# Download the model manually
ollama pull llama3.2:3b
```

### Model is slow / System freezing
Your machine may not have enough RAM. Try a smaller model:
```bash
ollama pull llama3.2:1b  # Only 1GB RAM needed
```

Then update `server/ollama.ts` to use `llama3.2:1b` as default.

## 🔄 Updating Models

Want to try different models?

```bash
# List available models
ollama list

# Pull a new model
ollama pull <model-name>

# Examples:
ollama pull qwen2.5:7b        # Better coding
ollama pull mistral:7b        # Fast general purpose
ollama pull codellama:7b      # Code specialist
```

The app will automatically detect and use available models.

## 📊 Model Comparison

| Model | Size | RAM | Speed | Best For |
|-------|------|-----|-------|----------|
| llama3.2:1b | 1GB | 2-3GB | ⚡⚡⚡ | Ultra-fast, basic tasks |
| llama3.2:3b | 2GB | 4-5GB | ⚡⚡ | **Recommended** - balanced |
| qwen2.5:7b | 4GB | 6-7GB | ⚡ | Coding, complex tasks |
| mistral:7b | 4GB | 6-7GB | ⚡ | General purpose |

## 🎉 What's Next?

Once running:
1. Type messages in the chat interface
2. Get real-time streaming responses
3. All data stays on your machine (private!)
4. No internet needed after model download

**Your local AI assistant is ready!** 🤖

---

Need help? Check [SETUP.md](./SETUP.md) for detailed documentation.
