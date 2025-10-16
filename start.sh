#!/bin/bash

# Agent Man - Production Startup Script
# Starts Ollama (if needed) and the server

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                      ║${NC}"
echo -e "${BLUE}║         ${GREEN}Agent Man${BLUE}                   ║${NC}"
echo -e "${BLUE}║                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama is not installed${NC}"
    echo -e "${BLUE}   Installing Ollama automatically...${NC}"
    echo ""

    # Auto-install Ollama
    if curl -fsSL https://ollama.ai/install.sh | sh; then
        echo ""
        echo -e "${GREEN}✓ Ollama installed successfully${NC}"

        # Add to PATH for current session
        export PATH="$HOME/.ollama/bin:/usr/local/bin:$PATH"
    else
        echo -e "${RED}❌ Failed to install Ollama${NC}"
        echo -e "${YELLOW}   Please install manually from: https://ollama.ai${NC}"
        exit 1
    fi
    echo ""
fi

# Check if password is set (from .env file)
if [ -z "$CHAT_MAN_PASSWORD" ]; then
    echo -e "${RED}❌ CHAT_MAN_PASSWORD not set${NC}"
    echo -e "${YELLOW}   Make sure you created .env file with your password${NC}"
    echo -e "${YELLOW}   Run: cp .env.example .env${NC}"
    echo -e "${YELLOW}   Then edit .env and set CHAT_MAN_PASSWORD${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Starting services...${NC}"
echo ""

# Start Ollama if not running
if pgrep -x "ollama" > /dev/null; then
    echo -e "${GREEN}✓ Ollama already running${NC}"
else
    echo -e "${BLUE}Starting Ollama...${NC}"
    ollama serve > /dev/null 2>&1 &
    sleep 2
    if pgrep -x "ollama" > /dev/null; then
        echo -e "${GREEN}✓ Ollama started${NC}"
    else
        echo -e "${RED}✗ Failed to start Ollama${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║        🎉 Starting Server 🎉        ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Server:${NC}  http://localhost:3010"
echo -e "${BLUE}Ollama:${NC}  http://localhost:11434"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Start the server
exec bun run server/server.ts
