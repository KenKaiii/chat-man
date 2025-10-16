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
    echo "Error: Ollama is not installed"
    echo ""

    # Detect OS and provide platform-specific instructions
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo "macOS Installation:"
        echo "1. Download Ollama.app from: https://ollama.ai/download/mac"
        echo "2. Open the downloaded .app file"
        echo "3. Ollama will install and run in the menu bar"
        echo "4. Then run 'bun start' again"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - offer to auto-install
        echo "Linux Installation:"
        echo "Run this command to install:"
        echo "  curl -fsSL https://ollama.ai/install.sh | sh"
        echo ""
        read -p "Auto-install now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if curl -fsSL https://ollama.ai/install.sh | sh; then
                export PATH="$HOME/.ollama/bin:/usr/local/bin:$PATH"
                echo "✅ Ollama installed successfully"
            else
                echo "❌ Installation failed. Install manually from: https://ollama.ai"
                exit 1
            fi
        else
            exit 1
        fi
    else
        # Windows or other
        echo "Download Ollama from: https://ollama.ai"
        exit 1
    fi

    # Re-check if ollama is available after installation
    if ! command -v ollama &> /dev/null; then
        echo ""
        echo "Please install Ollama and run 'bun start' again"
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
