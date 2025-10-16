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
        echo "macOS: Download from https://ollama.ai/download/mac"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    else
        echo "Download from: https://ollama.ai"
    fi

    exit 1
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
