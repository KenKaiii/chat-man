/**
 * Chat Man - Generic chat interface component library
 * Copyright (C) 2025 KenKai
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { NewChatWelcome } from "./components/chat/NewChatWelcome";
import { ChatContainer } from "./components/chat/ChatContainer";
import { RAGButton } from "./components/header/RAGButton";
import { RAGModal } from "./components/rag/RAGModal";
import { Toaster } from "sonner";
import { Menu, Edit3 } from "lucide-react";

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRAGModalOpen, setIsRAGModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    files?: any[];
    mode?: 'general' | 'rag' | 'spark' | 'voice';
  } | null>(null);

  // Mock chat sessions for demonstration
  const [chats] = useState([
    {
      id: '1',
      title: 'Example Chat 1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      isActive: false,
    },
    {
      id: '2',
      title: 'Example Chat 2',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      isActive: false,
    },
  ]);

  const handleNewChat = () => {
    setShowWelcome(true);
    setInputValue('');
    setPendingMessage(null);
  };

  const handleWelcomeSubmit = (files?: any[], mode?: 'general' | 'rag' | 'spark' | 'voice') => {
    if (inputValue.trim()) {
      // Store the message to be sent after transition
      setPendingMessage({
        content: inputValue,
        files,
        mode,
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
          onChatSelect={(id) => console.log('Selected chat:', id)}
          onChatDelete={(id) => console.log('Delete chat:', id)}
          onChatRename={(id, name) => console.log('Rename chat:', id, name)}
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

                {/* Right side - RAG Documents button */}
                <div className="header-right">
                  <RAGButton onClick={() => setIsRAGModalOpen(true)} />
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
          ) : (
            <ChatContainer
              websocketUrl="ws://localhost:3001/ws"
              initialMessages={[]}
              onMessageSent={(msg) => console.log('Sent:', msg)}
              placeholder="Type a message..."
              initialInputValue={pendingMessage?.content}
              initialFiles={pendingMessage?.files}
            />
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
