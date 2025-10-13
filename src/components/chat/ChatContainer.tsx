/**
 * Chat Man - Generic chat interface component library
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

import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { Message } from '../message/types';
import { toast } from '../../utils/toast';

export interface ChatContainerProps {
  /**
   * WebSocket URL for real-time communication
   */
  websocketUrl: string;

  /**
   * Session ID for this chat (required for persistence)
   */
  sessionId: string;

  /**
   * Initial messages to display (optional)
   */
  initialMessages?: Message[];

  /**
   * Callback when a message is sent
   */
  onMessageSent?: (content: string) => void;

  /**
   * Callback when a message is received
   */
  onMessageReceived?: (message: Message) => void;

  /**
   * Custom placeholder text for input
   */
  placeholder?: string;

  /**
   * Disable input
   */
  disabled?: boolean;

  /**
   * Custom header component (optional)
   */
  header?: React.ReactNode;

  /**
   * Show welcome screen when no messages
   */
  showWelcome?: boolean;

  /**
   * Welcome message for empty state
   */
  welcomeMessage?: string;

  /**
   * Initial input value to auto-send on mount
   */
  initialInputValue?: string;

  /**
   * Files to attach to initial message
   */
  initialFiles?: import('../message/types').FileAttachment[];

  /**
   * Chat mode (general, rag, spark, voice)
   */
  mode?: 'general' | 'rag' | 'spark' | 'voice';
}

export function ChatContainer({
  websocketUrl,
  sessionId,
  initialMessages = [],
  onMessageSent,
  onMessageReceived,
  placeholder = 'Type a message...',
  disabled = false,
  header,
  showWelcome = false,
  welcomeMessage = 'Start a conversation',
  initialInputValue,
  initialFiles,
  mode = 'general',
}: ChatContainerProps) {
  // Initialize messages with user message if initialInputValue is provided
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialInputValue) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: initialInputValue,
        timestamp: new Date().toISOString(),
        attachments: initialFiles,
      };
      return [...initialMessages, userMessage];
    }
    return initialMessages;
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(!!initialInputValue); // Set loading true if we have initial message
  const [liveTokenCount, setLiveTokenCount] = useState(0);
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);

  // Sync with initialMessages prop changes
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const { isConnected, sendMessage, stopGeneration } = useWebSocket({
    url: websocketUrl,
    onMessage: (message) => {
      // Handle incoming WebSocket messages
      if (message.type === 'assistant_message' && 'content' in message) {
        const assistantContent = message.content as string;

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];

          // Reset token count on first assistant message
          if (!lastMessage || lastMessage.type !== 'assistant') {
            setLiveTokenCount(0);
          }

          // If last message is from assistant, append to the last text block
          if (lastMessage && lastMessage.type === 'assistant') {
            const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
            const lastBlock = content[content.length - 1];

            // If last block is text, append to it for smooth streaming
            if (lastBlock && lastBlock.type === 'text') {
              const newText = lastBlock.text + assistantContent;

              const updatedContent = [
                ...content.slice(0, -1),
                { type: 'text' as const, text: newText }
              ];
              const updatedMessage = {
                ...lastMessage,
                content: updatedContent
              };
              return [...prev.slice(0, -1), updatedMessage];
            } else {
              // Otherwise add new text block
              const updatedMessage = {
                ...lastMessage,
                content: [...content, { type: 'text' as const, text: assistantContent }]
              };
              return [...prev.slice(0, -1), updatedMessage];
            }
          }

          // Otherwise create new assistant message
          const newMessage: Message = {
            id: Date.now().toString(),
            type: 'assistant' as const,
            content: [{ type: 'text' as const, text: assistantContent }],
            timestamp: new Date().toISOString(),
          };

          if (onMessageReceived) {
            onMessageReceived(newMessage);
          }

          return [...prev, newMessage];
        });
      } else if (message.type === 'thinking_start') {
        // Create a new thinking block when thinking starts
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];

          if (lastMessage && lastMessage.type === 'assistant') {
            const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
            const updatedMessage = {
              ...lastMessage,
              content: [...content, { type: 'thinking' as const, thinking: '' }]
            };
            return [...prev.slice(0, -1), updatedMessage];
          }

          // Create new assistant message with thinking block
          return [
            ...prev,
            {
              id: Date.now().toString(),
              type: 'assistant' as const,
              content: [{ type: 'thinking' as const, thinking: '' }],
              timestamp: new Date().toISOString(),
            },
          ];
        });
      } else if (message.type === 'thinking_delta' && 'content' in message) {
        const thinkingContent = message.content as string;

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];

          if (lastMessage && lastMessage.type === 'assistant') {
            const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];
            const lastBlock = content[content.length - 1];

            // If last block is thinking, append to it
            if (lastBlock && lastBlock.type === 'thinking') {
              const updatedContent = [
                ...content.slice(0, -1),
                { type: 'thinking' as const, thinking: lastBlock.thinking + thinkingContent }
              ];
              const updatedMessage = {
                ...lastMessage,
                content: updatedContent
              };
              return [...prev.slice(0, -1), updatedMessage];
            }
          }

          return prev;
        });
      } else if (message.type === 'tool_use' && 'toolId' in message && 'toolName' in message && 'toolInput' in message) {
        // Handle tool use messages
        const toolUseMsg = message as { type: 'tool_use'; toolId: string; toolName: string; toolInput: Record<string, unknown> };

        // Use flushSync to prevent React batching from causing tools to be lost
        flushSync(() => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];

            const toolUseBlock = {
              type: 'tool_use' as const,
              id: toolUseMsg.toolId,
              name: toolUseMsg.toolName,
              input: toolUseMsg.toolInput,
              // Initialize nestedTools array for Task tools
              ...(toolUseMsg.toolName === 'Task' ? { nestedTools: [] } : {}),
            };

            // If last message is assistant, check for Task tool nesting
            if (lastMessage && lastMessage.type === 'assistant') {
              const content = Array.isArray(lastMessage.content) ? lastMessage.content : [];

              // Check for duplicate tool_use blocks
              const isDuplicate = content.some(block =>
                block.type === 'tool_use' && block.id === toolUseMsg.toolId
              );

              if (isDuplicate) {
                return prev;
              }

              // Find all active Task tools (Tasks without a text block after them)
              const activeTaskIndices: number[] = [];
              let foundTextBlockAfterLastTask = false;

              for (let i = content.length - 1; i >= 0; i--) {
                const block = content[i];
                if (block.type === 'text') {
                  foundTextBlockAfterLastTask = true;
                }
                if (block.type === 'tool_use' && block.name === 'Task') {
                  if (!foundTextBlockAfterLastTask) {
                    activeTaskIndices.unshift(i);
                  } else {
                    break;
                  }
                }
              }

              // If this is a Task tool OR we found no active Tasks to nest under, add normally
              if (toolUseMsg.toolName === 'Task' || activeTaskIndices.length === 0) {
                const updatedMessage = {
                  ...lastMessage,
                  content: [...content, toolUseBlock]
                };
                return [...prev.slice(0, -1), updatedMessage];
              }

              // Distribute tools across active Tasks using round-robin
              const totalNestedTools = activeTaskIndices.reduce((sum, idx) => {
                const block = content[idx];
                return sum + (block.type === 'tool_use' ? (block.nestedTools?.length || 0) : 0);
              }, 0);

              const targetTaskIndex = activeTaskIndices[totalNestedTools % activeTaskIndices.length];

              // Nest this tool under the selected Task
              const updatedContent = content.map((block, index) => {
                if (index === targetTaskIndex && block.type === 'tool_use') {
                  const isNestedDuplicate = (block.nestedTools || []).some(
                    nested => nested.id === toolUseMsg.toolId
                  );

                  if (isNestedDuplicate) {
                    return block;
                  }

                  return {
                    ...block,
                    nestedTools: [...(block.nestedTools || []), toolUseBlock]
                  };
                }
                return block;
              });

              const updatedMessage = {
                ...lastMessage,
                content: updatedContent
              };
              return [...prev.slice(0, -1), updatedMessage];
            }

            // Otherwise create new assistant message with tool
            return [
              ...prev,
              {
                id: Date.now().toString(),
                type: 'assistant' as const,
                content: [toolUseBlock],
                timestamp: new Date().toISOString(),
              },
            ];
          });
        });
      } else if (message.type === 'token_update' && 'outputTokens' in message) {
        // Update live token count during streaming
        const tokenUpdate = message as { type: 'token_update'; outputTokens: number };
        setLiveTokenCount(tokenUpdate.outputTokens);
      } else if (message.type === 'result') {
        setIsLoading(false);
        setLiveTokenCount(0);
      } else if (message.type === 'timeout_warning') {
        const warningMsg = message as { type: 'timeout_warning'; message: string; elapsedSeconds: number };
        toast.warning('Still thinking...', {
          description: warningMsg.message || 'The AI is taking longer than usual',
          duration: 5000,
        });
      } else if (message.type === 'retry_attempt') {
        const retryMsg = message as { type: 'retry_attempt'; attempt: number; maxAttempts: number; message: string; errorType: string };
        toast.info(`Retrying (${retryMsg.attempt}/${retryMsg.maxAttempts})`, {
          description: retryMsg.message || `Attempting to recover from ${retryMsg.errorType}...`,
          duration: 3000,
        });
      } else if (message.type === 'error') {
        setIsLoading(false);
        setLiveTokenCount(0);

        const errorMsg = 'message' in message ? message.message : ('error' in message ? message.error : undefined);
        const errorMessage = errorMsg || 'An error occurred';

        toast.error('Error', {
          description: errorMessage
        });

        // Display error as assistant message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: 'assistant' as const,
            content: [{
              type: 'text' as const,
              text: `❌ Error: ${errorMessage}`
            }],
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
  });

  const handleSubmit = async (files?: import('../message/types').FileAttachment[]) => {
    if (!inputValue.trim()) return;

    if (!isConnected) {
      toast.error('Not connected', {
        description: 'WebSocket connection is not established'
      });
      return;
    }

    if (isLoading) {
      toast.info('Please wait', {
        description: 'A message is being processed'
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
      attachments: files,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Build content
    let messageContent: string | Array<Record<string, unknown>> = inputValue;

    if (files && files.length > 0) {
      const contentBlocks: Array<Record<string, unknown>> = [];

      if (inputValue.trim()) {
        contentBlocks.push({
          type: 'text',
          text: inputValue
        });
      }

      for (const file of files) {
        if (file.preview && file.type.startsWith('image/')) {
          const base64Match = file.preview.match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: base64Match[1],
                data: base64Match[2]
              }
            });
          }
        } else if (file.preview) {
          contentBlocks.push({
            type: 'document',
            name: file.name,
            data: file.preview
          });
        }
      }

      messageContent = contentBlocks;
    }

    sendMessage({
      type: 'chat',
      content: messageContent,
      mode: mode,
      sessionId: sessionId,
    });

    if (onMessageSent) {
      onMessageSent(inputValue);
    }

    setInputValue('');
  };

  const handleStop = () => {
    stopGeneration('');
    setIsLoading(false);
  };

  // Auto-send initial message when connected
  useEffect(() => {
    if (initialInputValue && !hasSentInitialMessage && isConnected) {
      setHasSentInitialMessage(true);

      // Build content
      let messageContent: string | Array<Record<string, unknown>> = initialInputValue;

      if (initialFiles && initialFiles.length > 0) {
        const contentBlocks: Array<Record<string, unknown>> = [];

        if (initialInputValue.trim()) {
          contentBlocks.push({
            type: 'text',
            text: initialInputValue
          });
        }

        for (const file of initialFiles) {
          if (file.preview && file.type.startsWith('image/')) {
            const base64Match = file.preview.match(/^data:([^;]+);base64,(.+)$/);
            if (base64Match) {
              contentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: base64Match[1],
                  data: base64Match[2]
                }
              });
            }
          } else if (file.preview) {
            contentBlocks.push({
              type: 'document',
              name: file.name,
              data: file.preview
            });
          }
        }

        messageContent = contentBlocks;
      }

      sendMessage({
        type: 'chat',
        content: messageContent,
        mode: mode,
        sessionId: sessionId,
      });

      if (onMessageSent) {
        onMessageSent(initialInputValue);
      }
    }
  }, [initialInputValue, initialFiles, hasSentInitialMessage, isConnected, sendMessage, onMessageSent]);

  return (
    <div className="flex flex-col h-screen">
      {/* Optional custom header */}
      {header && <div className="flex-shrink-0">{header}</div>}

      {/* Messages or welcome screen */}
      {messages.length === 0 && showWelcome ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-gray-400">{welcomeMessage}</p>
          </div>
        </div>
      ) : (
        <MessageList messages={messages} isLoading={isLoading} liveTokenCount={liveTokenCount} />
      )}

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        onStop={handleStop}
        disabled={!isConnected || disabled}
        isGenerating={isLoading}
        placeholder={placeholder}
        mode={mode}
      />
    </div>
  );
}
