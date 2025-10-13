/**
 * Chat Man - Generic chat interface component library
 * Copyright (C) 2025 KenKai
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Main components
export { ChatContainer } from './components/chat/ChatContainer';
export type { ChatContainerProps } from './components/chat/ChatContainer';

export { ChatInput } from './components/chat/ChatInput';
export { MessageList } from './components/chat/MessageList';

// Message components
export { AssistantMessage } from './components/message/AssistantMessage';
export { UserMessage } from './components/message/UserMessage';
export { MessageRenderer } from './components/message/MessageRenderer';

// Types
export type { Message, FileAttachment, TextBlock, ThinkingBlock, ToolUseBlock } from './components/message/types';

// Hooks
export { useWebSocket } from './hooks/useWebSocket';

// Utilities
export { toast } from './utils/toast';

// Styles
import './globals.css';
