#!/bin/bash

# Agent Man - Development Server (Frontend + Backend)

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
    echo "Error: Ollama not installed"
    echo "Install from: https://ollama.ai"
    exit 1
fi

# Set default password if not set
if [ -z "$CHAT_MAN_PASSWORD" ]; then
    export CHAT_MAN_PASSWORD="TestPassword123!"
fi

# Start Ollama
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve > /dev/null 2>&1 &
    echo "$! Ollama" >> "$PIDFILE"
    sleep 2
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
