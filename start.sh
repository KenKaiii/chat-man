#!/bin/bash

# Agent Man - Production Startup Script

# Load .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
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
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi

# Start the server
echo "Agent Man running at http://localhost:3010"
exec bun run server/server.ts
