#!/bin/bash

echo "=========================================="
echo "  Ollama Installation Diagnostic"
echo "=========================================="
echo ""

# 1. Check if ollama command exists
echo "1. Checking if ollama command exists..."
if command -v ollama &> /dev/null; then
    echo "   ✅ ollama command found at: $(which ollama)"

    # Check if it's a symlink and where it points
    if [ -L "$(which ollama)" ]; then
        echo "   → Symlink points to: $(readlink $(which ollama))"
    fi
else
    echo "   ❌ ollama command NOT found"
    echo "   You need to install Ollama"
    exit 1
fi

echo ""

# 2. Check OS and installation type
echo "2. Checking installation type..."
echo "   OS: $OSTYPE"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - check for app
    if [ -d "/Applications/Ollama.app" ]; then
        echo "   ✅ Ollama.app found in /Applications"

        # Check if installed via brew cask
        if brew list --cask 2>/dev/null | grep -q "^ollama$"; then
            echo "   ✅ Installed via: brew --cask"
        else
            echo "   ℹ️  Installed via: Manual .dmg"
        fi
    else
        echo "   ⚠️  Ollama.app NOT found in /Applications"

        # Check if brew formula (wrong way)
        if brew list 2>/dev/null | grep -q "^ollama$"; then
            echo "   ❌ PROBLEM: Installed via 'brew install ollama' (formula)"
            echo "   This is the wrong version! Need 'brew install --cask ollama'"
        fi
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   ℹ️  Linux installation (CLI version expected)"
fi

echo ""

# 3. Check if Ollama is running
echo "3. Checking if Ollama service is running..."
if pgrep -x "ollama" > /dev/null 2>&1; then
    echo "   ✅ Ollama process is running (PID: $(pgrep -x ollama))"
else
    echo "   ❌ Ollama is NOT running"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Ollama.app" ]; then
        echo "   FIX: Launch Ollama.app from Applications or run:"
        echo "        open -a Ollama"
    else
        echo "   FIX: Start Ollama with:"
        echo "        ollama serve &"
    fi
fi

echo ""

# 4. Check if API is responding
echo "4. Checking if Ollama API is responding..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "   ✅ Ollama API is responding on port 11434"
else
    echo "   ❌ Ollama API is NOT responding on port 11434"
    echo "   This means ollama commands will fail"
fi

echo ""

# 5. Check Ollama version
echo "5. Checking Ollama version..."
if OLLAMA_VERSION=$(ollama --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1); then
    echo "   Version: $OLLAMA_VERSION"

    # Parse version (compare as decimal)
    VERSION_NUM=$(echo "$OLLAMA_VERSION" | awk -F. '{printf "%d%02d%02d", $1, $2, $3}')
    MIN_VERSION_NUM=400  # 0.4.0

    if [ "$VERSION_NUM" -lt "$MIN_VERSION_NUM" ]; then
        echo "   ⚠️  Version is outdated (< 0.4.0)"
        echo "   Embeddings may not work. Recommended: 0.4.0+"
    else
        echo "   ✅ Version is acceptable (>= 0.4.0)"
    fi
else
    echo "   ⚠️  Could not determine version"
fi

echo ""

# 6. Check for embedding model
echo "6. Checking for nomic-embed-text model..."
if ollama list 2>&1 | grep -q "nomic-embed-text"; then
    echo "   ✅ nomic-embed-text model is installed"

    # Show model size
    MODEL_SIZE=$(ollama list 2>&1 | grep "nomic-embed-text" | awk '{print $2}')
    echo "   Size: $MODEL_SIZE"
else
    echo "   ❌ nomic-embed-text model NOT installed"
    echo "   This is required for RAG embeddings"
    echo ""
    echo "   FIX: Install with:"
    echo "        ollama pull nomic-embed-text"
fi

echo ""

# 7. Test embedding generation
echo "7. Testing embedding generation..."
if EMBED_RESPONSE=$(curl -s http://localhost:11434/api/embeddings \
    -H "Content-Type: application/json" \
    -d '{"model":"nomic-embed-text","prompt":"test"}' \
    --max-time 10 2>&1); then

    # Check if response contains embedding array
    if echo "$EMBED_RESPONSE" | grep -q '"embedding":\['; then
        # Extract sample
        SAMPLE=$(echo "$EMBED_RESPONSE" | grep -o '"embedding":\[[^]]*' | head -c 100)

        # Check for numeric values
        if echo "$SAMPLE" | grep -qE '[0-9]+\.[0-9]+'; then
            echo "   ✅ Embedding generation WORKS!"
            echo "   Sample output: ${SAMPLE}..."
        else
            echo "   ⚠️  Response received but no numeric embeddings"
            echo "   Response: $EMBED_RESPONSE"
        fi
    else
        echo "   ❌ Embedding generation FAILED"
        echo "   Response: $EMBED_RESPONSE"

        # Check for specific errors
        if echo "$EMBED_RESPONSE" | grep -q "runner process no longer running"; then
            echo ""
            echo "   🔴 CRITICAL: Ollama worker process is CRASHING"
            echo "   This is the root cause of upload failures!"
            echo ""
            echo "   Try these fixes in order:"
            echo "   1. Re-download model: ollama rm nomic-embed-text && ollama pull nomic-embed-text"
            echo "   2. Restart Ollama: killall ollama && open -a Ollama (macOS)"
            echo "   3. Update Ollama from: https://ollama.com/download"
        fi
    fi
else
    echo "   ❌ Could not connect to Ollama API"
    echo "   Make sure Ollama is running first"
fi

echo ""
echo "=========================================="
echo "  Diagnostic Complete"
echo "=========================================="
echo ""
echo "Share the output above when reporting issues."
