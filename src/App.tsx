/**
 * Chat Man - Generic chat interface component library
 * Copyright (C) 2025 KenKai
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { NewChatWelcome } from "./components/chat/NewChatWelcome";
import { ChatContainer } from "./components/chat/ChatContainer";
import { RAGButton } from "./components/header/RAGButton";
import { RAGModal } from "./components/rag/RAGModal";
import { AboutButton } from "./components/header/AboutButton";
import { Toaster } from "sonner";
import { Menu, Edit3 } from "lucide-react";
import { useSessionAPI, type Session } from "./hooks/useSessionAPI";

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRAGModalOpen, setIsRAGModalOpen] = useState(false);

  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    files?: import('./components/message/types').FileAttachment[];
    mode?: 'general' | 'rag' | 'spark' | 'voice';
  } | null>(null);

  // Session management
  const [chats, setChats] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionMode, setCurrentSessionMode] = useState<'general' | 'rag' | 'spark' | 'voice'>('general');
  const [currentMessages, setCurrentMessages] = useState<import('./components/message/types').Message[]>([]);
  const sessionAPI = useSessionAPI();

  // Load sessions on mount and create a refresh function
  const loadSessions = async () => {
    const sessions = await sessionAPI.fetchSessions();
    setChats(sessions);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Load messages and mode when switching sessions
  useEffect(() => {
    const loadMessages = async () => {
      if (currentSessionId && !pendingMessage) {
        // Only load from DB if we don't have a pending message (existing chat)
        const messages = await sessionAPI.fetchSessionMessages(currentSessionId);
        setCurrentMessages(messages);

        // Load session mode from the session object
        const session = chats.find(c => c.id === currentSessionId);
        if (session) {
          setCurrentSessionMode(session.mode);
        }
      } else {
        // New chat with pending message - start with empty
        setCurrentMessages([]);
        // Set mode from pending message if available
        if (pendingMessage?.mode) {
          setCurrentSessionMode(pendingMessage.mode);
        }
      }
    };
    loadMessages();
  }, [currentSessionId, pendingMessage]);

  const handleNewChat = async () => {
    // Don't create session yet - wait until user submits with mode selection
    setCurrentSessionId(null); // Clear current session
    setCurrentSessionMode('general'); // Reset mode to general (default)
    setShowWelcome(true);
    setInputValue('');
    setPendingMessage(null);
    setCurrentMessages([]); // Clear messages
  };

  const handleChatSelect = async (id: string) => {
    setCurrentSessionId(id);
    setShowWelcome(false);
    setPendingMessage(null); // Clear pending message when switching to existing chat
  };

  const handleChatDelete = async (id: string) => {
    const success = await sessionAPI.deleteSession(id);
    if (success) {
      setChats(chats.filter(c => c.id !== id));
      if (currentSessionId === id) {
        await handleNewChat();
      }
    }
  };

  const handleChatRename = async (id: string, newTitle: string) => {
    const success = await sessionAPI.renameSession(id, newTitle);
    if (success) {
      setChats(chats.map(c => c.id === id ? { ...c, title: newTitle } : c));
    }
  };

  const handleWelcomeSubmit = async (files?: import('./components/message/types').FileAttachment[], mode?: 'general' | 'rag' | 'spark' | 'voice') => {
    if (inputValue.trim()) {
      const selectedMode = mode || 'general';

      // Always create a new session with the selected mode
      const newSession = await sessionAPI.createSession(selectedMode);
      if (newSession) {
        setChats([newSession, ...chats]);
        setCurrentSessionId(newSession.id);
        setCurrentSessionMode(selectedMode); // Set the session mode immediately
      }

      // Store the message to be sent after transition
      setPendingMessage({
        content: inputValue,
        files,
        mode: selectedMode,
      });
      setShowWelcome(false);
      setInputValue(''); // Clear the input
    }
  };

  const handleStop = () => {
    setIsGenerating(false);
  };

  return (
    <>
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          chats={chats}
          onNewChat={handleNewChat}
          onChatSelect={handleChatSelect}
          onChatDelete={handleChatDelete}
          onChatRename={handleChatRename}
        />

        {/* Main Chat Area */}
        <div
          className="flex flex-col flex-1 h-screen"
          style={{
            marginLeft: isSidebarOpen ? '260px' : '0',
            transition: 'margin-left 0.2s ease-in-out'
          }}
        >
          {/* Header - Always visible */}
          <nav className="header">
            <div className="header-content">
              <div className="header-inner">
                {/* Left side */}
                <div className="header-left">
                  {!isSidebarOpen && (
                    <>
                      {/* Sidebar toggle */}
                      <button
                        className="header-btn"
                        aria-label="Toggle Sidebar"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      >
                        <Menu />
                      </button>

                      {/* New chat */}
                      <button
                        className="header-btn"
                        aria-label="New Chat"
                        onClick={handleNewChat}
                      >
                        <Edit3 />
                      </button>
                    </>
                  )}
                </div>

                {/* Center - Logo and Title */}
                <div className="header-center">
                  <div className="flex flex-col items-start w-full">
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-3">
                        {!isSidebarOpen && (
                          <img
                            src="/logo.svg"
                            alt="Chat Man"
                            className="header-icon"
                            loading="eager"
                          />
                        )}
                        <div className="header-title text-gradient">
                          Chat Man
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side - RAG Documents & About buttons */}
                <div className="header-right">
                  <RAGButton onClick={() => setIsRAGModalOpen(true)} />
                  <AboutButton />
                </div>
              </div>
            </div>
          </nav>

          {/* Show welcome screen or chat container */}
          {showWelcome ? (
            <NewChatWelcome
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSubmit={handleWelcomeSubmit}
              onStop={handleStop}
              disabled={false}
              isGenerating={isGenerating}
            />
          ) : currentSessionId ? (
            <ChatContainer
              key={currentSessionId}
              websocketUrl="ws://localhost:3001/ws"
              sessionId={currentSessionId}
              initialMessages={currentMessages}
              onMessageSent={async (_msg) => {
                // Clear pending message after first send
                if (pendingMessage) {
                  setPendingMessage(null);
                }
                // Refresh session list after a short delay to pick up title changes
                setTimeout(async () => {
                  await loadSessions();
                }, 1000);
              }}
              placeholder="Type a message..."
              initialInputValue={pendingMessage?.content}
              initialFiles={pendingMessage?.files}
              mode={currentSessionMode}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400">Creating chat session...</p>
            </div>
          )}
        </div>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'sonner-toast',
          style: {
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />

      {/* RAG Documents Modal */}
      <RAGModal
        isOpen={isRAGModalOpen}
        onClose={() => setIsRAGModalOpen(false)}
      />
    </>
  );
};

export default App;
