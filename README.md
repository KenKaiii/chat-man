# Chat Man

A beautiful, reusable chat UI component library for React with real-time streaming, markdown rendering, code highlighting, and mermaid diagram support.

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
