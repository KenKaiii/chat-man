/**
 * Chat Man - Modern chat interface for Claude Agent SDK
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

import React, { useState, useRef, useEffect } from 'react';
import { Menu, Edit3, Search, Trash2, Edit } from 'lucide-react';
import { toast } from '../../utils/toast';
import type { Session } from '../../hooks/useSessionAPI';

interface Chat extends Session {
  isActive?: boolean;
  isLoading?: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chats?: Chat[];
  onNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  onChatDelete?: (chatId: string) => void;
  onChatRename?: (chatId: string, newTitle: string) => void;
}

export function Sidebar({ isOpen, onToggle, chats = [], onNewChat, onChatSelect, onChatDelete, onChatRename }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAllChatsExpanded, setIsAllChatsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Group chats by date
  const groupChatsByDate = (chats: Chat[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: Chat[] } = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      'Previous 30 Days': [],
      Older: []
    };

    chats.forEach(chat => {
      const chatDate = new Date(chat.updated_at);
      const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());

      const diffTime = today.getTime() - chatDay.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        groups.Today.push(chat);
      } else if (diffDays === 1) {
        groups.Yesterday.push(chat);
      } else if (diffDays <= 7) {
        groups['Previous 7 Days'].push(chat);
      } else if (diffDays <= 30) {
        groups['Previous 30 Days'].push(chat);
      } else {
        groups.Older.push(chat);
      }
    });

    return groups;
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedChats = groupChatsByDate(filteredChats);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleRenameClick = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleRenameSubmit = (chatId: string) => {
    const currentChat = chats.find(c => c.id === chatId);
    const newName = editingTitle.trim();

    // Validate folder name: max 15 chars, lowercase + dashes + numbers only
    if (!newName) {
      setEditingId(null);
      setEditingTitle('');
      return;
    }

    if (newName.length > 15) {
      toast.error('Invalid folder name', {
        description: 'Folder name must be 15 characters or less'
      });
      return;
    }

    if (!/^[a-z0-9-]+$/.test(newName)) {
      toast.error('Invalid folder name', {
        description: 'Only lowercase letters, numbers, and dashes allowed'
      });
      return;
    }

    if (newName !== currentChat?.title) {
      onChatRename?.(chatId, newName);
    }

    setEditingId(null);
    setEditingTitle('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDeleteClick = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChatDelete?.(chatId);
  };

  return (
    <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="sidebar-container">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.svg" alt="Chat Man" className="sidebar-logo-icon" />
          </div>
          <button className="sidebar-toggle-btn" onClick={onToggle} aria-label="Toggle Sidebar">
            <Menu size={24} opacity={0.8} className={isOpen ? '' : 'rotate-180'} />
          </button>
        </div>

        {/* New Chat Button */}
        <button className="sidebar-new-chat-btn" onClick={onNewChat}>
          <Edit3 size={20} opacity={0.8} />
          <span>New Chat</span>
        </button>

        {/* Search */}
        <div className="sidebar-search-container">
          <div className="sidebar-search">
            <div className="sidebar-search-icon">
              <Search size={16} />
            </div>
            <input
              className="sidebar-search-input"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="sidebar-chat-list">
          {/* All Chats Dropdown */}
          <div className="sidebar-section-header">
            <button
              className="sidebar-section-toggle"
              onClick={() => setIsAllChatsExpanded(!isAllChatsExpanded)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
                className="sidebar-chevron"
                style={{ transform: isAllChatsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
              <span>All Chats</span>
            </button>
          </div>

          {/* Chat Groups */}
          {isAllChatsExpanded && (
            <div className="sidebar-chat-groups">
              {Object.entries(groupedChats).map(([groupName, groupChats]) => {
                if (groupChats.length === 0) return null;

                return (
                  <div key={groupName} className="sidebar-chat-group">
                    <div className="sidebar-group-label">{groupName}</div>
                    {groupChats.map((chat) => (
                      <div key={chat.id} className="sidebar-chat-item-wrapper group" style={{ position: 'relative' }}>
                        {editingId === chat.id ? (
                          <div style={{ padding: '0.5rem' }}>
                            <input
                              ref={inputRef}
                              type="text"
                              value={editingTitle}
                              maxLength={15}
                              onChange={(e) => {
                                // Convert to lowercase and filter out invalid chars
                                const filtered = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                setEditingTitle(filtered);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameSubmit(chat.id);
                                } else if (e.key === 'Escape') {
                                  handleRenameCancel();
                                }
                              }}
                              onBlur={() => handleRenameSubmit(chat.id)}
                              placeholder="folder-name"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '0.375rem',
                                color: 'rgb(var(--text-primary))',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <button
                              className={`sidebar-chat-item ${chat.isActive ? 'sidebar-chat-item-active' : ''}`}
                              onClick={() => onChatSelect?.(chat.id)}
                            >
                              <div className="sidebar-chat-title">
                                {chat.title}
                                {chat.isLoading && (
                                  <span style={{
                                    marginLeft: '0.5rem',
                                    display: 'inline-flex',
                                    gap: '2px',
                                    alignItems: 'center',
                                  }}>
                                    <span style={{
                                      width: '3px',
                                      height: '3px',
                                      backgroundColor: 'rgb(var(--text-secondary))',
                                      borderRadius: '50%',
                                      animation: 'pulse 1.4s ease-in-out infinite',
                                      animationDelay: '0s',
                                      opacity: 0.6,
                                    }}></span>
                                    <span style={{
                                      width: '3px',
                                      height: '3px',
                                      backgroundColor: 'rgb(var(--text-secondary))',
                                      borderRadius: '50%',
                                      animation: 'pulse 1.4s ease-in-out infinite',
                                      animationDelay: '0.2s',
                                      opacity: 0.6,
                                    }}></span>
                                    <span style={{
                                      width: '3px',
                                      height: '3px',
                                      backgroundColor: 'rgb(var(--text-secondary))',
                                      borderRadius: '50%',
                                      animation: 'pulse 1.4s ease-in-out infinite',
                                      animationDelay: '0.4s',
                                      opacity: 0.6,
                                    }}></span>
                                  </span>
                                )}
                              </div>
                            </button>
                            <div className={`sidebar-chat-menu ${chat.isActive ? '' : 'sidebar-chat-menu-hidden'}`} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                className="sidebar-chat-menu-btn"
                                aria-label="Rename Chat"
                                onClick={(e) => handleRenameClick(chat, e)}
                                style={{
                                  padding: '0.25rem',
                                  background: chat.isActive ? 'rgb(var(--bg-tertiary))' : 'rgb(var(--bg-secondary))',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'rgb(var(--text-secondary))',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                  e.currentTarget.style.color = 'rgb(var(--text-primary))';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = chat.isActive ? 'rgb(var(--bg-tertiary))' : 'rgb(var(--bg-secondary))';
                                  e.currentTarget.style.color = 'rgb(var(--text-secondary))';
                                }}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                className="sidebar-chat-menu-btn"
                                aria-label="Delete Chat"
                                onClick={(e) => handleDeleteClick(chat.id, e)}
                                style={{
                                  padding: '0.25rem',
                                  background: chat.isActive ? 'rgb(var(--bg-tertiary))' : 'rgb(var(--bg-secondary))',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'rgb(var(--text-secondary))',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                  e.currentTarget.style.color = '#ef4444';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = chat.isActive ? 'rgb(var(--bg-tertiary))' : 'rgb(var(--bg-secondary))';
                                  e.currentTarget.style.color = 'rgb(var(--text-secondary))';
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
