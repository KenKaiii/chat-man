# Configuration Guide

Chat Man uses file-based configuration for easy customization. All configuration files are in this directory.

## Configuration Files

### 1. `system-prompt.txt`
The system prompt that defines the AI's behavior and personality.

**Example:**
```
You are a helpful AI assistant specialized in [your domain].

Key traits:
- Professional and friendly
- Focus on accuracy
- Provide examples
```

### 2. `knowledge.md`
Your custom knowledge base. Add any context, documentation, or information you want the AI to have access to.

**Use cases:**
- Company-specific information
- Product documentation
- FAQs and common questions
- Domain expertise

**Format:** Use markdown for best readability.

### 3. `settings.json`
Advanced configuration for model parameters and UI settings.

```json
{
  "model": {
    "name": "llama3.2:3b",      // Ollama model name
    "temperature": 0.7,           // Creativity (0.0-2.0)
    "top_p": 0.9,                 // Nucleus sampling
    "top_k": 40,                  // Top-K sampling
    "max_tokens": 2048            // Max response length
  },
  "system": {
    "enableKnowledgeBase": true,  // Include knowledge.md
    "enableSystemPrompt": true,   // Include system-prompt.txt
    "streamingEnabled": true      // Enable streaming responses
  },
  "ui": {
    "appName": "Chat Man",
    "welcomeMessage": "Welcome! How can I help?",
    "placeholder": "Type a message...",
    "theme": "dark"
  }
}
```

## Model Parameters

### Temperature (0.0 - 2.0)
- **0.0-0.3:** Focused, deterministic (good for facts)
- **0.7:** Balanced (recommended)
- **1.0+:** Creative, varied responses

### Top P (0.0 - 1.0)
Controls diversity via nucleus sampling.
- **0.9:** Recommended default
- Lower = more focused, higher = more diverse

### Top K (1 - 100)
Limits vocabulary to top K tokens.
- **40:** Recommended default
- Lower = more focused, higher = more diverse

## Hot Reload

After editing configuration files, reload without restarting:

```bash
curl -X POST http://localhost:3010/api/reload-config
```

Or restart the server:
```bash
bun run dev:server
```

## Tips

1. **System Prompt:** Keep it concise but clear. Focus on behavior, not implementation details.
2. **Knowledge Base:** Organize with markdown headers. The AI can navigate structured content better.
3. **Temperature:** Start with 0.7, adjust based on your use case.
4. **Testing:** Make small changes and test to find what works best.

## Examples

### Technical Support Bot
**system-prompt.txt:**
```
You are a technical support specialist for [Product Name].

Your role:
- Diagnose technical issues accurately
- Provide step-by-step solutions
- Be patient and clear
- Ask clarifying questions when needed

Always verify the user's system before suggesting solutions.
```

**knowledge.md:**
```markdown
# Product Documentation

## Common Issues

### Issue: Login fails
**Cause:** Usually cached credentials
**Solution:** Clear browser cache and cookies

### Issue: Slow performance
**Cause:** Too many background processes
**Solution:** Check Task Manager, close unnecessary apps
```

### Creative Writing Assistant
**system-prompt.txt:**
```
You are a creative writing assistant helping authors craft compelling stories.

Your strengths:
- Character development
- Plot structure
- Dialogue improvement
- Genre-specific conventions

Be encouraging and constructive with feedback.
```

**settings.json:**
```json
{
  "model": {
    "temperature": 1.2,  // Higher for creativity
    "top_p": 0.95,
    "top_k": 50
  }
}
```

---

**Need help?** Check [QUICKSTART.md](../QUICKSTART.md) for general setup or [SETUP.md](../SETUP.md) for detailed documentation.
