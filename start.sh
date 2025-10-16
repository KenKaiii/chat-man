#!/bin/bash

# Agent Man - Production Startup Script

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

# Check if password is set
if [ -z "$CHAT_MAN_PASSWORD" ]; then
    echo "Error: CHAT_MAN_PASSWORD not set"
    echo "Run: cp .env.example .env"
    echo "Then edit .env and set your password"
    exit 1
fi

# Start Ollama if not running
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi

# Start the server
echo "Agent Man running at http://localhost:3010"
exec bun run server/server.ts
