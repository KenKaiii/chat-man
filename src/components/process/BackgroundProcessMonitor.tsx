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

import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, X } from 'lucide-react';

export interface BackgroundProcess {
  bashId: string;
  command: string;
  description?: string;
  startedAt: number;
}

interface BackgroundProcessMonitorProps {
  processes: BackgroundProcess[];
  onKillProcess: (bashId: string) => void;
}

export function BackgroundProcessMonitor({ processes, onKillProcess }: BackgroundProcessMonitorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const count = processes.length;

  if (count === 0) {
    return null; // Don't show button when no processes
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon rounded-lg"
        title={`${count} background ${count === 1 ? 'server' : 'servers'} running`}
        type="button"
        style={{
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '0.375rem 0.75rem',
        }}
      >
        {count} background {count === 1 ? 'server' : 'servers'} running
        <ChevronUp
          size={16}
          style={{
            marginLeft: '0.25rem',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: '100%',
            marginBottom: '0.5rem',
            background: 'rgb(var(--bg-input))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.75rem',
            width: '32rem',
            maxWidth: 'calc(100vw - 1rem)',
            zIndex: 9999,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ padding: '1rem 1.75rem 0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
            Background Processes
          </div>
          <div style={{ padding: '0 1rem 1rem', maxHeight: '20rem', overflowY: 'auto' }}>
            {processes.map((process) => (
              <div
                key={process.bashId}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  marginBottom: '0.25rem',
                  background: 'transparent',
                  borderRadius: '0.5rem',
                  transition: 'background 0.075s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(244, 246, 248, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div
                    style={{
                      color: 'rgb(var(--text-primary))',
                      fontSize: '0.875rem',
                      lineHeight: 1.2,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {process.description || process.command}
                  </div>
                  {process.description && (
                    <div
                      style={{
                        color: 'rgb(var(--text-secondary))',
                        fontSize: '0.75rem',
                        lineHeight: 1.3,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {process.command}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onKillProcess(process.bashId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    transition: 'background 0.075s',
                    color: 'rgb(var(--text-primary))',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  title="Kill process"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
