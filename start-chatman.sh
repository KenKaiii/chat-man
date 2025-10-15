#!/bin/bash

# Chat Man - Production Startup Script
# =====================================
# This script runs Chat Man in production mode with all security checks enabled.
#
# IMPORTANT: Before first run, you must:
# 1. Enable disk encryption on your computer (FileVault/BitLocker/LUKS)
# 2. Change the CHAT_MAN_PASSWORD below to a strong password
#

# ===== CONFIGURATION =====
# Change this to your own secure password!
export CHAT_MAN_PASSWORD='CHANGE_ME_TO_SECURE_PASSWORD'

# Run in production mode (enforces security checks)
export NODE_ENV=production

# ===== STARTUP =====
echo "🚀 Starting Chat Man..."
echo ""

# Check if password was changed
if [ "$CHAT_MAN_PASSWORD" = "CHANGE_ME_TO_SECURE_PASSWORD" ]; then
    echo "❌ ERROR: You must change CHAT_MAN_PASSWORD in this script!"
    echo "   Edit start-chatman.sh and set a strong password."
    echo ""
    exit 1
fi

# Show system info
echo "System: $(uname -s)"
echo "Mode: PRODUCTION (security checks enabled)"
echo ""

# Check disk encryption (informational only - app will verify)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Checking FileVault status..."
    fdesetup status 2>/dev/null || echo "⚠️  Could not check FileVault status"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Checking LUKS encryption..."
    lsblk -o NAME,FSTYPE 2>/dev/null | grep -q crypto_LUKS && echo "✅ LUKS encryption detected" || echo "⚠️  LUKS encryption not detected"
fi

echo ""
echo "Starting application..."
echo "Access at: http://localhost:3010"
echo ""
echo "Press Ctrl+C to stop"
echo "================================"
echo ""

# Start the application
bun run dev:server
