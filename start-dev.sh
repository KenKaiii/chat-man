#!/bin/bash

# Chat Man - Development Server Startup Script
# Starts Ollama, Backend, and Frontend servers

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                      ║${NC}"
echo -e "${BLUE}║         ${GREEN}Chat Man${BLUE} Dev Server        ║${NC}"
echo -e "${BLUE}║                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# PID file to track processes
PIDFILE=".dev-pids"
rm -f "$PIDFILE"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}⏳ Shutting down servers...${NC}"

    if [ -f "$PIDFILE" ]; then
        while read -r pid name; do
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}   Stopping $name (PID: $pid)${NC}"
                kill "$pid" 2>/dev/null
            fi
        done < "$PIDFILE"
        rm -f "$PIDFILE"
    fi

    echo -e "${GREEN}✅ All servers stopped${NC}"
    exit 0
}

# Register cleanup on exit
trap cleanup SIGINT SIGTERM EXIT

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama is not installed${NC}"
    echo -e "${YELLOW}   Install from: https://ollama.ai${NC}"
    exit 1
fi

# Check if password is set
if [ -z "$CHAT_MAN_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  CHAT_MAN_PASSWORD not set${NC}"
    echo -e "${YELLOW}   Using default: TestPassword123!${NC}"
    export CHAT_MAN_PASSWORD="TestPassword123!"
fi

echo -e "${GREEN}🚀 Starting services...${NC}"
echo ""

# 1. Start Ollama
echo -e "${BLUE}[1/3]${NC} Starting Ollama server..."
if pgrep -x "ollama" > /dev/null; then
    echo -e "${GREEN}   ✓ Ollama already running${NC}"
else
    ollama serve > /dev/null 2>&1 &
    OLLAMA_PID=$!
    echo "$OLLAMA_PID Ollama" >> "$PIDFILE"
    sleep 2
    if kill -0 "$OLLAMA_PID" 2>/dev/null; then
        echo -e "${GREEN}   ✓ Ollama started (PID: $OLLAMA_PID)${NC}"
    else
        echo -e "${RED}   ✗ Failed to start Ollama${NC}"
        exit 1
    fi
fi

# 2. Start Backend
echo -e "${BLUE}[2/3]${NC} Starting backend server..."
CHAT_MAN_PASSWORD="$CHAT_MAN_PASSWORD" bun run dev:server > /tmp/chat-man-backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID Backend" >> "$PIDFILE"
sleep 2
if kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${GREEN}   ✓ Backend started (PID: $BACKEND_PID)${NC}"
    echo -e "${GREEN}   → http://localhost:3001${NC}"
else
    echo -e "${RED}   ✗ Failed to start backend${NC}"
    echo -e "${YELLOW}   Check logs: tail -f /tmp/chat-man-backend.log${NC}"
    exit 1
fi

# 3. Start Frontend
echo -e "${BLUE}[3/3]${NC} Starting frontend server..."
bun run dev > /tmp/chat-man-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID Frontend" >> "$PIDFILE"
sleep 3
if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -e "${GREEN}   ✓ Frontend started (PID: $FRONTEND_PID)${NC}"
    echo -e "${GREEN}   → http://localhost:5173${NC}"
else
    echo -e "${RED}   ✗ Failed to start frontend${NC}"
    echo -e "${YELLOW}   Check logs: tail -f /tmp/chat-man-frontend.log${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║     🎉 All servers running! 🎉      ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  ${GREEN}Frontend:${NC}  http://localhost:5173"
echo -e "  ${GREEN}Backend:${NC}   http://localhost:3001"
echo -e "  ${GREEN}Ollama:${NC}    http://localhost:11434"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  ${YELLOW}Backend:${NC}   tail -f /tmp/chat-man-backend.log"
echo -e "  ${YELLOW}Frontend:${NC}  tail -f /tmp/chat-man-frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Keep script running and tail logs
tail -f /tmp/chat-man-backend.log /tmp/chat-man-frontend.log &
TAIL_PID=$!
echo "$TAIL_PID Tail" >> "$PIDFILE"

# Wait for any process to exit
wait
