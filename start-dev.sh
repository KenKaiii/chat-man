#!/bin/bash

# Agent Man - Development Server (Frontend + Backend)

# Load .env file if it exists (cross-platform compatible)
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

PIDFILE=".dev-pids"
rm -f "$PIDFILE"

# Cleanup on exit
cleanup() {
    echo "Stopping servers..."
    if [ -f "$PIDFILE" ]; then
        while read -r pid name; do
            kill "$pid" 2>/dev/null
        done < "$PIDFILE"
        rm -f "$PIDFILE"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo "Error: Ollama is not installed"
    echo ""

    # Detect OS and provide platform-specific instructions
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - try homebrew first
        if command -v brew &> /dev/null; then
            echo "macOS: Installing Ollama via Homebrew..."
            if brew install ollama; then
                echo "✅ Ollama installed"
            else
                echo "❌ Failed. Manual install: https://ollama.ai/download/mac"
                exit 1
            fi
        else
            echo "macOS: Install with 'brew install ollama' or download from https://ollama.ai/download/mac"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Linux: Installing Ollama..."
        if curl -fsSL https://ollama.ai/install.sh | sh; then
            export PATH="$HOME/.ollama/bin:/usr/local/bin:$PATH"
            echo "✅ Ollama installed"
        else
            echo "❌ Failed. Manual install: https://ollama.ai"
            exit 1
        fi
    else
        echo "Download from: https://ollama.ai"
        exit 1
    fi

    # Re-check if ollama is available after installation
    if ! command -v ollama &> /dev/null; then
        echo "Please install Ollama and try again"
        exit 1
    fi
fi

# Start Ollama
# Use pgrep if available, otherwise check with ps (for systems without pgrep)
if command -v pgrep > /dev/null 2>&1; then
    if ! pgrep -x "ollama" > /dev/null 2>&1; then
        ollama serve > /dev/null 2>&1 &
        echo "$! Ollama" >> "$PIDFILE"
        sleep 2
    fi
else
    # Fallback for systems without pgrep (rare, but defensive)
    if ! ps aux | grep -v grep | grep -q "ollama serve"; then
        ollama serve > /dev/null 2>&1 &
        echo "$! Ollama" >> "$PIDFILE"
        sleep 2
    fi
fi

# Start Backend
CHAT_MAN_PASSWORD="$CHAT_MAN_PASSWORD" bun run dev:server > /tmp/chat-man-backend.log 2>&1 &
echo "$! Backend" >> "$PIDFILE"
sleep 2

# Start Frontend
bun run dev > /tmp/chat-man-frontend.log 2>&1 &
echo "$! Frontend" >> "$PIDFILE"
sleep 2

echo "Agent Man Dev Server:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3010"
echo ""
echo "Logs: tail -f /tmp/chat-man-{backend,frontend}.log"
echo ""

# Tail logs
tail -f /tmp/chat-man-backend.log /tmp/chat-man-frontend.log &
echo "$! Tail" >> "$PIDFILE"

wait
