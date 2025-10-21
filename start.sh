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

    # Fresh installation - give Ollama extra time to initialize
    echo "Fresh Ollama installation detected - allowing initialization time..."
    sleep 3
fi

# Start Ollama if not running
# Use pgrep if available, otherwise check with ps (for systems without pgrep)
OLLAMA_STARTED=false
if command -v pgrep > /dev/null 2>&1; then
    if ! pgrep -x "ollama" > /dev/null 2>&1; then
        echo "Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        OLLAMA_STARTED=true
    fi
else
    # Fallback for systems without pgrep (rare, but defensive)
    if ! ps aux | grep -v grep | grep -q "ollama serve"; then
        echo "Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        OLLAMA_STARTED=true
    fi
fi

# Wait for Ollama API to be ready (with timeout)
if [ "$OLLAMA_STARTED" = true ]; then
    echo "Waiting for Ollama API to be ready..."
    MAX_RETRIES=30  # Increased from 15 for fresh installations
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "✅ Ollama API is ready"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo ""
            echo "❌ ERROR: Ollama API did not respond after 30 seconds"
            echo ""
            echo "Troubleshooting:"
            echo "1. Check if Ollama is running: ps aux | grep ollama"
            echo "2. Try manually: killall ollama && ollama serve"
            echo "3. Check logs for errors"
            echo ""
            echo "Cannot continue without Ollama. Exiting..."
            exit 1
        fi
        sleep 1
    done
else
    # Ollama was already running, but still verify it's responding
    echo "Verifying Ollama API..."
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "⚠️  Warning: Ollama is running but API is not responding"
        echo "Try restarting Ollama manually: killall ollama && ollama serve"
        echo ""
        echo "Attempting to continue, but uploads may fail..."
        sleep 2
    else
        echo "✅ Ollama API is responding"
    fi
fi

# Download embedding model if not present (required for RAG)
echo ""
echo "Checking for embedding model (required for RAG)..."
if ollama list 2>&1 | grep -q "nomic-embed-text"; then
    echo "✅ Embedding model (nomic-embed-text) already installed"
else
    echo "⬇️  Downloading nomic-embed-text model (274MB, required for document uploads)..."
    echo "This is a one-time download and may take a few minutes..."

    # Try to pull the model and capture output
    if PULL_OUTPUT=$(ollama pull nomic-embed-text 2>&1); then
        # Verify the model actually downloaded by checking ollama list again
        if ollama list 2>&1 | grep -q "nomic-embed-text"; then
            echo "✅ Embedding model downloaded successfully"

            # Give model time to fully register after download
            echo "Allowing model to fully initialize..."
            sleep 2

            # Test the model to confirm it actually works (not just warm-up)
            echo "⏳ Testing embedding model (confirming functionality)..."

            # Try functional test with retries (critical for preventing EOF errors)
            TEST_SUCCESS=false
            for i in 1 2 3; do
                if TEST_OUTPUT=$(curl -s http://localhost:11434/api/embeddings \
                    -H "Content-Type: application/json" \
                    -d '{"model":"nomic-embed-text","prompt":"test"}' \
                    --max-time 45 2>&1); then

                    # Verify response contains "embedding" field AND validate it's an array
                    if echo "$TEST_OUTPUT" | grep -q '"embedding":\['; then
                        # Extract first few values to verify it's actual numbers
                        EMBEDDING_SAMPLE=$(echo "$TEST_OUTPUT" | grep -o '"embedding":\[[^]]*' | head -c 100)

                        # Check if we got numeric values (basic sanity check)
                        if echo "$EMBEDDING_SAMPLE" | grep -qE '[0-9]+\.[0-9]+'; then
                            echo "✅ Embedding model test PASSED - generating valid embeddings"
                            TEST_SUCCESS=true
                            break
                        else
                            echo "⚠️  Test attempt $i/3 failed: Response missing numeric embeddings"
                            if [ $i -lt 3 ]; then
                                echo "   Retrying in 3 seconds..."
                                sleep 3
                            fi
                        fi
                    else
                        echo "⚠️  Test attempt $i/3 failed: Invalid response (no embedding array)"
                        if [ $i -lt 3 ]; then
                            echo "   Retrying in 3 seconds..."
                            sleep 3
                        fi
                    fi
                else
                    echo "⚠️  Test attempt $i/3 failed (timeout or connection error)"
                    if [ $i -lt 3 ]; then
                        echo "   Retrying in 3 seconds..."
                        sleep 3
                    fi
                fi
            done

            if [ "$TEST_SUCCESS" = false ]; then
                echo ""
                echo "❌ ERROR: Embedding model test FAILED after 3 attempts"
                echo "The model is not generating valid embeddings."
                echo "This will cause 'EOF' errors when uploading documents."
                echo ""
                echo "Troubleshooting:"
                echo "1. Check if Ollama is running: curl http://localhost:11434/api/tags"
                echo "2. Manually test embeddings: curl -X POST http://localhost:11434/api/embeddings \\"
                echo "      -H 'Content-Type: application/json' \\"
                echo "      -d '{\"model\":\"nomic-embed-text\",\"prompt\":\"test\"}'"
                echo "3. Try restarting Ollama: killall ollama && ollama serve"
                echo "4. Re-download model: ollama rm nomic-embed-text && ollama pull nomic-embed-text"
                echo ""
                echo "Press Enter to continue anyway (uploads WILL fail)..."
                read -r
            fi
        else
            echo ""
            echo "⚠️  Warning: Download appeared to succeed but model not found"
            echo "This may indicate a problem with Ollama."
            echo "Try manually: ollama pull nomic-embed-text"
            echo ""
            echo "Continuing with server startup..."
            sleep 2
        fi
    else
        echo ""
        echo "⚠️  Warning: Failed to download embedding model"
        echo "Error output:"
        echo "$PULL_OUTPUT"
        echo ""
        echo "RAG/document upload functionality will NOT work."
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
