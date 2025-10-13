/**
 * Agent Girl - Modern chat interface for Claude Agent SDK
 * Copyright (C) 2025 KenKai
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, test, expect, beforeEach } from 'bun:test';

/**
 * Session Isolation Tests
 *
 * These tests verify that WebSocket messages are properly filtered by session ID,
 * preventing messages from one chat session from appearing in another.
 */

interface WebSocketMessage {
  type: string;
  sessionId?: string;
  content?: string;
  toolId?: string;
  toolName?: string;
  toolInput?: unknown;
  plan?: string;
  [key: string]: unknown;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  timestamp: string;
}

/**
 * Simulates the message filtering logic from ChatContainer.tsx
 * This is the core logic we're testing - extracted for unit testing
 */
function simulateMessageHandling(
  currentSessionId: string | null,
  incomingMessage: WebSocketMessage,
  existingMessages: Message[]
): { shouldProcess: boolean; filtered: boolean; messages: Message[] } {
  // Session isolation: Ignore messages from other sessions
  if (incomingMessage.sessionId && incomingMessage.sessionId !== currentSessionId) {
    console.log(`[Test] Ignoring message from session ${incomingMessage.sessionId} (current: ${currentSessionId})`);
    return { shouldProcess: false, filtered: true, messages: existingMessages };
  }

  // Process the message
  let messages = [...existingMessages];

  if (incomingMessage.type === 'assistant_message' && incomingMessage.content) {
    const lastMessage = messages[messages.length - 1];

    // If last message is from assistant, append to it
    if (lastMessage && lastMessage.type === 'assistant') {
      const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
      const lastBlock = content[content.length - 1];

      if (lastBlock && lastBlock.type === 'text') {
        const updatedContent = [
          ...content.slice(0, -1),
          { type: 'text', text: lastBlock.text + incomingMessage.content }
        ];
        messages = [
          ...messages.slice(0, -1),
          { ...lastMessage, content: updatedContent }
        ];
      } else {
        messages = [
          ...messages.slice(0, -1),
          { ...lastMessage, content: [...content, { type: 'text', text: incomingMessage.content }] }
        ];
      }
    } else {
      // Create new assistant message
      messages.push({
        id: Date.now().toString(),
        type: 'assistant',
        content: [{ type: 'text', text: incomingMessage.content }],
        timestamp: new Date().toISOString(),
      });
    }
  } else if (incomingMessage.type === 'tool_use') {
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.type === 'assistant') {
      const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
      messages = [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          content: [
            ...content,
            {
              type: 'tool_use',
              id: incomingMessage.toolId as string,
              name: incomingMessage.toolName as string,
              input: incomingMessage.toolInput,
            }
          ]
        }
      ];
    }
  }

  return { shouldProcess: true, filtered: false, messages };
}

describe('Session Isolation', () => {
  let sessionA: string;
  let sessionB: string;
  let messagesA: Message[];
  let messagesB: Message[];

  beforeEach(() => {
    sessionA = 'session-a-123';
    sessionB = 'session-b-456';
    messagesA = [];
    messagesB = [];
  });

  test('should accept message when sessionId matches current session', () => {
    const message: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Hello from Session A',
      sessionId: sessionA
    };

    const result = simulateMessageHandling(sessionA, message, messagesA);

    expect(result.shouldProcess).toBe(true);
    expect(result.filtered).toBe(false);
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].type).toBe('assistant');
  });

  test('should reject message when sessionId does not match current session', () => {
    const message: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Hello from Session A',
      sessionId: sessionA
    };

    const result = simulateMessageHandling(sessionB, message, messagesB);

    expect(result.shouldProcess).toBe(false);
    expect(result.filtered).toBe(true);
    expect(result.messages.length).toBe(0);
  });

  test('should handle concurrent sessions independently', () => {
    // Session A receives its own message
    const messageA1: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Message 1 for A',
      sessionId: sessionA
    };
    const resultA1 = simulateMessageHandling(sessionA, messageA1, messagesA);
    messagesA = resultA1.messages;

    // Session B receives its own message
    const messageB1: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Message 1 for B',
      sessionId: sessionB
    };
    const resultB1 = simulateMessageHandling(sessionB, messageB1, messagesB);
    messagesB = resultB1.messages;

    // Verify Session A has 1 message
    expect(messagesA.length).toBe(1);
    const contentA = Array.isArray(messagesA[0].content) ? messagesA[0].content : [];
    expect(contentA[0].type).toBe('text');
    expect(contentA[0].text).toBe('Message 1 for A');

    // Verify Session B has 1 message
    expect(messagesB.length).toBe(1);
    const contentB = Array.isArray(messagesB[0].content) ? messagesB[0].content : [];
    expect(contentB[0].type).toBe('text');
    expect(contentB[0].text).toBe('Message 1 for B');
  });

  test('should filter cross-session messages during concurrent responses', () => {
    // Session A starts receiving response
    const messageA1: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Response for A...',
      sessionId: sessionA
    };
    const resultA1 = simulateMessageHandling(sessionA, messageA1, messagesA);
    messagesA = resultA1.messages;
    expect(messagesA.length).toBe(1);

    // User switches to Session B while A is still responding
    // Session A continues sending messages, but B should filter them
    const messageA2: WebSocketMessage = {
      type: 'assistant_message',
      content: ' more text',
      sessionId: sessionA
    };
    const resultB = simulateMessageHandling(sessionB, messageA2, messagesB);

    // Message should be filtered
    expect(resultB.shouldProcess).toBe(false);
    expect(resultB.filtered).toBe(true);
    expect(messagesB.length).toBe(0);

    // Session A should still be able to receive its own messages
    const resultA2 = simulateMessageHandling(sessionA, messageA2, messagesA);
    messagesA = resultA2.messages;
    expect(resultA2.shouldProcess).toBe(true);
    expect(messagesA.length).toBe(1);
    const contentA = Array.isArray(messagesA[0].content) ? messagesA[0].content : [];
    expect(contentA[0].text).toBe('Response for A... more text');
  });

  test('should filter tool_use messages from other sessions', () => {
    const toolMessage: WebSocketMessage = {
      type: 'tool_use',
      toolId: 'tool-123',
      toolName: 'Read',
      toolInput: { file_path: '/some/file.txt' },
      sessionId: sessionA
    };

    // Try to process in Session B
    const result = simulateMessageHandling(sessionB, toolMessage, messagesB);

    expect(result.shouldProcess).toBe(false);
    expect(result.filtered).toBe(true);
    expect(result.messages.length).toBe(0);
  });

  test('should filter exit_plan_mode messages from other sessions', () => {
    const planMessage: WebSocketMessage = {
      type: 'exit_plan_mode',
      plan: 'My implementation plan',
      sessionId: sessionA
    };

    // Try to process in Session B
    const result = simulateMessageHandling(sessionB, planMessage, messagesB);

    expect(result.shouldProcess).toBe(false);
    expect(result.filtered).toBe(true);
  });

  test('should process messages without sessionId (backward compatibility)', () => {
    const message: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Message without sessionId',
      // No sessionId field
    };

    const result = simulateMessageHandling(sessionA, message, messagesA);

    // Should process since there's no sessionId to check
    expect(result.shouldProcess).toBe(true);
    expect(result.filtered).toBe(false);
    expect(result.messages.length).toBe(1);
  });

  test('should handle rapid session switching', () => {
    // Start with Session A
    const messageA1: WebSocketMessage = {
      type: 'assistant_message',
      content: 'A1',
      sessionId: sessionA
    };
    const resultA1 = simulateMessageHandling(sessionA, messageA1, messagesA);
    messagesA = resultA1.messages;

    // Switch to Session B
    const messageB1: WebSocketMessage = {
      type: 'assistant_message',
      content: 'B1',
      sessionId: sessionB
    };
    const resultB1 = simulateMessageHandling(sessionB, messageB1, messagesB);
    messagesB = resultB1.messages;

    // More messages for A (should be filtered when viewing B)
    const messageA2: WebSocketMessage = {
      type: 'assistant_message',
      content: 'A2',
      sessionId: sessionA
    };
    const resultBFilterA = simulateMessageHandling(sessionB, messageA2, messagesB);
    expect(resultBFilterA.filtered).toBe(true);
    expect(messagesB.length).toBe(1); // Still only B1

    // Switch back to Session A
    const resultA2 = simulateMessageHandling(sessionA, messageA2, messagesA);
    messagesA = resultA2.messages;
    expect(messagesA.length).toBe(1);
    const contentA = Array.isArray(messagesA[0].content) ? messagesA[0].content : [];
    expect(contentA[0].text).toBe('A1A2');
  });

  test('should handle null currentSessionId gracefully', () => {
    const message: WebSocketMessage = {
      type: 'assistant_message',
      content: 'Test message',
      sessionId: sessionA
    };

    const result = simulateMessageHandling(null, message, []);

    // Should filter since null !== sessionA
    expect(result.shouldProcess).toBe(false);
    expect(result.filtered).toBe(true);
  });
});

console.log('✅ Session Isolation tests defined. Run with: bun test');
