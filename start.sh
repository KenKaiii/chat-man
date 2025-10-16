#!/bin/bash

# Agent Man - Production Startup Script

# Load .env file if it exists (cross-platform compatible)
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama..."
    if curl -fsSL https://ollama.ai/install.sh | sh; then
        export PATH="$HOME/.ollama/bin:/usr/local/bin:$PATH"
    else
        echo "Error: Failed to install Ollama"
        echo "Install manually from: https://ollama.ai"
        exit 1
    fi
fi

# Start Ollama if not running
# Use pgrep if available, otherwise check with ps (for systems without pgrep)
if command -v pgrep > /dev/null 2>&1; then
    if ! pgrep -x "ollama" > /dev/null 2>&1; then
        ollama serve > /dev/null 2>&1 &
        sleep 2
    fi
else
    # Fallback for systems without pgrep (rare, but defensive)
    if ! ps aux | grep -v grep | grep -q "ollama serve"; then
        ollama serve > /dev/null 2>&1 &
        sleep 2
    fi
fi

# Start the server
echo "Agent Man running at http://localhost:3010"
exec bun run server/server.ts
