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
        # macOS - try homebrew first
        if command -v brew &> /dev/null; then
            echo "macOS: Installing Ollama via Homebrew..."
            if brew install ollama; then
                echo "✅ Ollama installed successfully"
            else
                echo "❌ Homebrew installation failed"
                echo "Manual install: Download from https://ollama.ai/download/mac"
                exit 1
            fi
        else
            echo "macOS Installation:"
            echo "Option 1 (Recommended): Install with Homebrew"
            echo "  brew install ollama"
            echo ""
            echo "Option 2: Manual Download"
            echo "  1. Download Ollama.app from: https://ollama.ai/download/mac"
            echo "  2. Open the downloaded .app file"
            echo "  3. Ollama will run in the menu bar"
            echo ""
            echo "Then run 'bun start' again"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - auto-install
        echo "Linux: Installing Ollama..."
        if curl -fsSL https://ollama.ai/install.sh | sh; then
            export PATH="$HOME/.ollama/bin:/usr/local/bin:$PATH"
            echo "✅ Ollama installed successfully"
        else
            echo "❌ Installation failed. Install manually from: https://ollama.ai"
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

# Download embedding model if not present (required for RAG)
echo ""
echo "Checking for embedding model (required for RAG)..."
if ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
    echo "✅ Embedding model (nomic-embed-text) already installed"
else
    echo "⬇️  Downloading nomic-embed-text model (274MB, required for document uploads)..."
    echo "This is a one-time download and may take a few minutes..."
    if ollama pull nomic-embed-text 2>&1; then
        echo "✅ Embedding model downloaded successfully"
    else
        echo ""
        echo "⚠️  Warning: Failed to download embedding model"
        echo "RAG/document upload functionality may not work."
        echo "You can install it manually later with:"
        echo "  ollama pull nomic-embed-text"
        echo ""
        echo "Continuing with server startup..."
        sleep 2
    fi
fi

# Start the server
echo ""
echo "🚀 Agent Man running at http://localhost:3010"
exec bun run server/server.ts
