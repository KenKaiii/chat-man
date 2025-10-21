#!/bin/bash

# Agent Man - Production Startup Script

# Immediate output to confirm script is running
echo "========================================="
echo "  Agent Man - Starting up..."
echo "========================================="
echo ""

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
        # macOS - MUST use official .app (can be installed via brew cask OR .dmg)
        echo ""
        echo "macOS: Ollama installation required"
        echo ""
        echo "Installation options:"
        echo ""
        echo "Option 1 (Easiest): Homebrew Cask"
        echo "  brew install --cask ollama"
        echo "  open -a Ollama  # Launch the app"
        echo ""
        echo "Option 2: Manual Download"
        echo "  1. Download from: https://ollama.com/download/Ollama.dmg"
        echo "  2. Open the .dmg and drag Ollama.app to Applications"
        echo "  3. Launch Ollama.app from Applications"
        echo ""
        echo "⚠️  Do NOT use 'brew install ollama' (formula version)"
        echo "    Must use 'brew install --cask ollama' (app version)"
        echo ""
        echo "Then run 'bun start' again"
        echo ""
        exit 1
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
# Check if Ollama is already running
OLLAMA_STARTED=false
if command -v pgrep > /dev/null 2>&1; then
    OLLAMA_RUNNING=$(pgrep -x "ollama" > /dev/null 2>&1 && echo "true" || echo "false")
else
    OLLAMA_RUNNING=$(ps aux | grep -v grep | grep -q "ollama serve" && echo "true" || echo "false")
fi

if [ "$OLLAMA_RUNNING" = "false" ]; then
    echo "Ollama is not running. Starting it..."

    # On macOS, prefer launching the app if it exists
    if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Ollama.app" ]; then
        echo "Launching Ollama.app..."
        open -a Ollama
        OLLAMA_STARTED=true
    else
        # Fallback to ollama serve (Linux or if app not found)
        echo "Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        OLLAMA_STARTED=true
    fi
else
    echo "Ollama is already running"
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
            if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Ollama.app" ]; then
                echo "2. Launch Ollama.app from Applications folder (or Spotlight)"
                echo "3. Or restart it: killall ollama && open -a Ollama"
            else
                echo "2. Try manually: killall ollama && ollama serve"
            fi
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
        if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Ollama.app" ]; then
            echo "Try restarting: killall ollama && open -a Ollama"
        else
            echo "Try restarting: killall ollama && ollama serve"
        fi
        echo ""
        echo "Attempting to continue, but uploads may fail..."
        sleep 2
    else
        echo "✅ Ollama API is responding"
    fi
fi

# Check Ollama version (warn if too old)
echo ""
echo "Checking Ollama version..."
if OLLAMA_VERSION=$(ollama --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1); then
    echo "Ollama version: $OLLAMA_VERSION"

    # Parse version as integer for comparison (0.12.6 -> 1206)
    VERSION_NUM=$(echo "$OLLAMA_VERSION" | awk -F. '{printf "%d%02d%02d", $1, $2, $3}')
    MIN_VERSION=400  # 0.4.0

    # Warn if version is older than 0.4 (when embeddings API stabilized)
    if [ "$VERSION_NUM" -lt "$MIN_VERSION" ]; then
        echo "⚠️  WARNING: Ollama version $OLLAMA_VERSION is outdated"
        echo "Embeddings may not work correctly. Recommended: 0.4.0+"
        echo "Update from: https://ollama.ai"
        echo ""
    fi
else
    echo "⚠️  Could not determine Ollama version"
fi

# Fix: Ollama requires SSH key for model downloads (missing on fresh installs)
if [ ! -f ~/.ollama/id_ed25519 ]; then
    echo "Creating Ollama SSH key (required for model downloads)..."
    mkdir -p ~/.ollama
    ssh-keygen -t ed25519 -f ~/.ollama/id_ed25519 -N "" > /dev/null 2>&1
    echo "✅ SSH key created"
fi

# Download embedding model if not present (required for RAG)
echo ""
echo "Checking for embedding model (required for RAG)..."
MODEL_INSTALLED=false
if ollama list 2>&1 | grep -q "all-minilm"; then
    echo "✅ Embedding model (all-minilm) already installed"
    MODEL_INSTALLED=true
else
    echo "⬇️  Downloading all-minilm model (45MB, required for document uploads)..."
    echo "This is a one-time download and should complete in seconds..."

    # Try to pull the model and capture output
    if PULL_OUTPUT=$(ollama pull all-minilm 2>&1); then
        # Verify the model actually downloaded by checking ollama list again
        if ollama list 2>&1 | grep -q "all-minilm"; then
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
                    -d '{"model":"all-minilm","prompt":"test"}' \
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
                echo "      -d '{\"model\":\"all-minilm\",\"prompt\":\"test\"}'"
                echo "3. Try restarting Ollama: killall ollama && ollama serve"
                echo "4. Re-download model: ollama rm all-minilm && ollama pull all-minilm"
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
        echo "  ollama pull all-minilm"
        echo ""
        echo "Continuing with server startup..."
        sleep 2
    fi
fi

# ALWAYS test embeddings - even if model was already installed
# This catches corrupted models that pass the "ollama list" check
if [ "$MODEL_INSTALLED" = true ]; then
    echo ""
    echo "⏳ Testing embedding generation..."

    if TEST_OUTPUT=$(curl -s http://localhost:11434/api/embeddings \
        -H "Content-Type: application/json" \
        -d '{"model":"all-minilm","prompt":"test"}' \
        --max-time 10 2>&1); then

        if echo "$TEST_OUTPUT" | grep -q '"embedding":\[' && echo "$TEST_OUTPUT" | grep -qE '[0-9]+\.[0-9]+'; then
            echo "✅ Embeddings working correctly"
        else
            echo "❌ Embedding test failed - model may be corrupted"
            echo "🔧 Auto-fixing: Re-downloading model..."
            ollama rm all-minilm 2>/dev/null
            ollama pull all-minilm
            echo "✅ Model re-downloaded"
        fi
    else
        echo "⚠️  Could not test embeddings (Ollama may still be starting)"
    fi
fi

# Start the server
echo ""
echo "🚀 Agent Man running at http://localhost:3010"
exec bun run server/server.ts
