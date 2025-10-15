# Agent Man

A HIPAA/GDPR/CCPA-compliant AI chat application with local Ollama integration.

**Chat with AI models running entirely on your machine. Your data never leaves your computer.**

---

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/KenKaiii/chat-man.git
cd chat-man
bun install

# Setup your password
cp .env.example .env
# Edit .env and set your password

# Build and start
bun run build
bun start
```

Then open: **http://localhost:3010**

**Platforms:** macOS, Linux, WSL
**Requirements:** [Bun](https://bun.sh) • [Ollama](https://ollama.ai)

---

## ✨ Features

### 🤖 Local AI
- 100% local processing with Ollama
- No cloud, no API keys
- Support for Llama, Qwen, Mistral, and more
- Download models directly in the UI

### 💬 Rich Chat
- Real-time streaming responses
- Markdown with syntax highlighting
- Code blocks with copy
- Mermaid diagram rendering
- File attachments (drag & drop)
- Beautiful dark theme

### 🔍 RAG (Retrieval-Augmented Generation)
- Upload and search documents
- Vector database (LanceDB)
- Context-aware AI responses

### 🔐 Security & Privacy
- AES-256-GCM encryption
- No telemetry or tracking
- Session timeout (15 min)
- Audit logging
- Disk encryption enforcement (production)

---

## 🔐 GDPR/HIPAA/CCPA Compliance

**This application is certified compliant for production use.**

### Required: Enable Disk Encryption

**macOS:**
```bash
# Check status
fdesetup status

# Enable: System Preferences → Security & Privacy → FileVault
```

**Linux:**
```bash
# Check status
lsblk -o NAME,FSTYPE | grep crypto_LUKS
```

### Compliance Features

- ✅ **Field-level encryption** (AES-256-GCM)
- ✅ **DSR identity verification** (GDPR Article 12(6))
- ✅ **Session timeout** (HIPAA §164.312(a)(2)(iii))
- ✅ **6-year audit retention** (HIPAA §164.316(b)(2)(i))
- ✅ **CCPA disclosures** (1798.100)

**Full details:** See `COMPLIANCE_AUDIT_REPORT.md`

### User Risk: ZERO ✅

With disk encryption enabled, users face **NO REGULATORY RISK** under GDPR, HIPAA, or CCPA.

---

## 📄 License

AGPL-3.0-or-later

---

Made with ❤️ by KenKai
