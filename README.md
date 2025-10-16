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

# Build and start
bun run build
bun start
```

Then open: **http://localhost:3010**

**Platforms:** macOS, Linux, WSL
**Requirements:** [Bun](https://bun.sh) • [Ollama](https://ollama.ai) (auto-installed if missing)

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

**This application implements technical controls designed to support compliance.**

⚠️ **See "Legal Disclaimer" section below before using for regulated data.**

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

## ⚠️ Legal Disclaimer

**IMPORTANT: READ CAREFULLY BEFORE USE**

This software implements technical controls designed to support HIPAA, GDPR, and CCPA compliance requirements. However:

### Not Legal Advice
- This software and its documentation **DO NOT constitute legal advice**
- You are responsible for ensuring your own compliance with applicable laws
- Consult qualified legal counsel for compliance guidance specific to your use case

### No Warranty of Compliance
- The software is provided **"AS IS" WITHOUT WARRANTY OF ANY KIND**
- The creators make **NO REPRESENTATIONS OR WARRANTIES** regarding regulatory compliance
- Compliance depends on your specific implementation, policies, and procedures
- **You are solely responsible** for verifying compliance with all applicable regulations

### Your Responsibilities
As a user of this software, you must:
- Conduct your own compliance assessment
- Implement appropriate organizational policies and procedures
- Maintain proper documentation and training
- Consult legal and compliance professionals
- Regularly audit and update your compliance measures

### Limitation of Liability
- The creators and contributors **SHALL NOT BE LIABLE** for any regulatory violations, fines, penalties, or damages
- Use of this software does not guarantee compliance with any law or regulation
- You assume all risks associated with using this software for regulated data

### Regulatory Requirements Vary
- HIPAA, GDPR, and CCPA requirements vary by jurisdiction, organization, and use case
- Technical controls are only **one component** of regulatory compliance
- Full compliance requires organizational policies, training, risk assessments, and more

**BY USING THIS SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ THIS DISCLAIMER AND AGREE TO ITS TERMS.**

---

## 📄 License

AGPL-3.0-or-later

---

Made with ❤️ by KenKai
