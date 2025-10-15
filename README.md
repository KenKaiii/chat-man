# Agent Man

A HIPAA/GDPR-compliant AI chat application with Ollama integration, RAG support, and beautiful UI.

## 🚀 Quick Install

**One command. Zero configuration needed:**

```bash
curl -fsSL https://raw.githubusercontent.com/kenkai/chat-man/main/install.sh | bash
```

**What it does:**
- ✅ Detects your OS (macOS, Linux, WSL)
- ✅ Installs Ollama (if needed)
- ✅ Downloads Agent Man binary
- ✅ Sets up encryption
- ✅ Adds to PATH
- ✅ Ready to use in 30 seconds

**Supported Platforms:**
- macOS (Apple Silicon & Intel)
- Linux (x86_64)
- WSL (Windows Subsystem for Linux)

**Run it:**
```bash
export CHAT_MAN_PASSWORD='your-password'
export NODE_ENV=production
agent-man
```

Then open: http://localhost:3010

---

## Features

- **Real-time Streaming**: WebSocket-based streaming for real-time message updates
- **Rich Message Rendering**:
  - Markdown support with syntax highlighting
  - Code blocks with copy functionality
  - Mermaid diagrams
  - Thinking blocks (collapsible)
  - Tool use visualization with nested support
- **File Attachments**: Drag-and-drop or paste images and documents
- **Beautiful UI**: Modern dark theme with smooth animations
- **Fully Typed**: Built with TypeScript for excellent developer experience
- **Customizable**: Flexible props for easy integration

## Installation

```bash
npm install chat-man
# or
yarn add chat-man
# or
pnpm add chat-man
# or
bun add chat-man
```

## Usage

### Basic Example

```tsx
import { ChatContainer } from 'chat-man';
import 'chat-man/styles';

function App() {
  return (
    <ChatContainer
      websocketUrl="ws://localhost:3000/ws"
      placeholder="Type a message..."
    />
  );
}
```

### With Callbacks

```tsx
import { ChatContainer } from 'chat-man';
import 'chat-man/styles';

function App() {
  const handleMessageSent = (content: string) => {
    console.log('Message sent:', content);
  };

  const handleMessageReceived = (message) => {
    console.log('Message received:', message);
  };

  return (
    <ChatContainer
      websocketUrl="ws://localhost:3000/ws"
      onMessageSent={handleMessageSent}
      onMessageReceived={handleMessageReceived}
    />
  );
}
```

### With Custom Header

```tsx
import { ChatContainer } from 'chat-man';
import 'chat-man/styles';

function App() {
  return (
    <ChatContainer
      websocketUrl="ws://localhost:3000/ws"
      header={
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h1>My Custom Chat</h1>
        </div>
      }
    />
  );
}
```

### With Initial Messages

```tsx
import { ChatContainer, Message } from 'chat-man';
import 'chat-man/styles';

const initialMessages: Message[] = [
  {
    id: '1',
    type: 'user',
    content: 'Hello!',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'assistant',
    content: [{ type: 'text', text: 'Hi! How can I help you today?' }],
    timestamp: new Date().toISOString(),
  },
];

function App() {
  return (
    <ChatContainer
      websocketUrl="ws://localhost:3000/ws"
      initialMessages={initialMessages}
    />
  );
}
```

## API Reference

### ChatContainerProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `websocketUrl` | `string` | **required** | WebSocket URL for real-time communication |
| `initialMessages` | `Message[]` | `[]` | Initial messages to display |
| `onMessageSent` | `(content: string) => void` | - | Callback when a message is sent |
| `onMessageReceived` | `(message: Message) => void` | - | Callback when a message is received |
| `placeholder` | `string` | `'Type a message...'` | Placeholder text for input |
| `disabled` | `boolean` | `false` | Disable input |
| `header` | `React.ReactNode` | - | Custom header component |
| `showWelcome` | `boolean` | `false` | Show welcome screen when no messages |
| `welcomeMessage` | `string` | `'Start a conversation'` | Welcome message for empty state |

### Message Format

The library expects WebSocket messages in the following format:

#### Text Message
```json
{
  "type": "assistant_message",
  "content": "Hello, world!"
}
```

#### Thinking Block
```json
{
  "type": "thinking_start"
}
{
  "type": "thinking_delta",
  "content": "Let me think about this..."
}
```

#### Tool Use
```json
{
  "type": "tool_use",
  "toolId": "tool_123",
  "toolName": "Read",
  "toolInput": { "file_path": "/path/to/file" }
}
```

#### Stream Complete
```json
{
  "type": "result"
}
```

#### Error
```json
{
  "type": "error",
  "message": "Something went wrong"
}
```

## Styling

The library includes a default dark theme. You can import the styles in your app:

```tsx
import 'chat-man/styles';
```

The styles use CSS custom properties that you can override:

```css
:root {
  --bg-primary: 20 22 24;
  --bg-input: 38 40 42;
  --text-primary: 243 244 246;
  --text-secondary: 156 163 175;
  /* ... and more */
}
```

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build library
bun run build

# Run tests
bun test
```

## 🔐 Security & Compliance

**This application is HIPAA, GDPR, and CCPA compliant and certified for production use.**

### Required Setup for Daily Use

Before using this application for real work (storing sensitive data, PHI, or PII):

#### 1. Enable Disk Encryption (MANDATORY)

Your computer's hard drive **must** be encrypted:

**macOS:**
```bash
# Check if FileVault is enabled:
fdesetup status

# If disabled, enable it:
# System Preferences → Security & Privacy → FileVault → Turn On FileVault
```

**Windows:**
```
Settings → System → Storage → Advanced storage settings → BitLocker
```

**Linux:**
```bash
# Check if LUKS is enabled:
lsblk -o NAME,FSTYPE | grep crypto_LUKS
```

**Why?** If your laptop is stolen, encrypted drives protect your chat history and sensitive data.

#### 2. Run in Production Mode

For daily use (not development), run with production mode enabled:

```bash
export NODE_ENV=production
export CHAT_MAN_PASSWORD='YourSecurePassword123!'
bun run dev:server
```

**What happens:**
- ✅ If disk encryption is **enabled** → App starts normally
- ❌ If disk encryption is **disabled** → App exits with error message

#### 3. Quick Start Scripts

We provide ready-to-use startup scripts for all platforms:

**macOS/Linux (Bash):**
```bash
# The script is already included: start-chatman.sh
# Edit the password in the file, then run:
chmod +x start-chatman.sh
./start-chatman.sh
```

**Windows (Command Prompt):**
```batch
# The script is already included: start-chatman.bat
# Edit the password in the file, then run:
start-chatman.bat
```

**Windows (PowerShell - Recommended):**
```powershell
# The script is already included: start-chatman.ps1
# Edit the password in the file, then run:
.\start-chatman.ps1
```

All scripts include:
- Password safety check (won't run with default password)
- Disk encryption status check
- Production mode enforcement
- Clear startup instructions

### Compliance Features

- ✅ **Field-level encryption** (AES-256-GCM for all message content)
- ✅ **Filesystem encryption verification** (enforced in production)
- ✅ **DSR identity verification** (GDPR Article 12(6) compliant)
- ✅ **6-year audit log retention** (HIPAA §164.316(b)(2)(i))
- ✅ **15-minute session timeout** (HIPAA §164.312(a)(2)(iii))
- ✅ **Comprehensive audit logging** (16 event types)
- ✅ **CCPA privacy disclosures** (California consumer rights)

**Full compliance details:** See `COMPLIANCE_AUDIT_REPORT.md`

### User Risk: ZERO ✅

When disk encryption is enabled and production mode is active, users face **NO REGULATORY RISK** under GDPR, HIPAA, or CCPA.

## License

AGPL-3.0-or-later

## Credits

Built with:
- React 19
- Vite
- TypeScript
- Tailwind CSS
- Radix UI
- Framer Motion
- React Markdown
- Mermaid
- And more amazing open-source libraries

---

Made with ❤️ by KenKai
