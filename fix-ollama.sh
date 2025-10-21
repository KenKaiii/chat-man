#!/bin/bash

echo "🔧 Fixing Ollama setup..."
echo ""

# Kill any running Ollama
killall ollama 2>/dev/null

# On macOS, use the app if it exists
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Ollama.app" ]; then
    echo "Launching Ollama.app..."
    open -a Ollama
    sleep 3
else
    echo "Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
fi

# Wait for API
echo "Waiting for Ollama to start..."
for i in {1..15}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is running"
        break
    fi
    sleep 1
done

# Re-download model
echo ""
echo "Re-downloading embedding model..."
ollama rm nomic-embed-text 2>/dev/null
ollama pull nomic-embed-text

echo ""
echo "✅ Done! Try your upload again."
