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

import React, { useEffect, useRef } from 'react';
import { X, Youtube, GraduationCap } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create and play audio when modal opens
    const audio = new Audio('/credits.mp3');
    audio.loop = true;
    audio.volume = 0.5;

    // Try to play audio
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          audioRef.current = audio;
        })
        .catch(() => {
          // Try playing with user interaction
          const handleInteraction = () => {
            audio.play()
              .then(() => {
                audioRef.current = audio;
              })
              .catch(() => {});
            document.removeEventListener('click', handleInteraction);
          };
          document.addEventListener('click', handleInteraction, { once: true });
        });
    }

    // Stop audio when modal closes
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: 'rgb(var(--bg-input))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '32rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            className="text-gradient"
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: 'var(--font-heading)',
              margin: 0,
            }}
          >
            About Chat Man
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Close"
          >
            <X size={20} style={{ color: 'rgb(var(--text-secondary))' }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Creator Info */}
          <div>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'rgb(var(--text-primary))',
                margin: '0 0 0.5rem 0',
              }}
            >
              Created by Ken Kai
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgb(var(--text-secondary))',
                margin: 0,
                lineHeight: '1.5',
              }}
            >
              Chat Man is a modern AI chat interface powered by the Claude Agent SDK,
              designed to provide seamless conversations with advanced AI capabilities.
            </p>
          </div>

          {/* Links */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <a
              href="https://www.youtube.com/@kenkaidoesai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <Youtube size={20} style={{ color: '#FF0000' }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgb(var(--text-primary))',
                  }}
                >
                  YouTube Channel
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                  }}
                >
                  @kenkaidoesai
                </div>
              </div>
            </a>

            <a
              href="https://www.skool.com/kenkai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <GraduationCap size={20} style={{ color: 'rgb(var(--blue-accent))' }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgb(var(--text-primary))',
                  }}
                >
                  Skool Community
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                  }}
                >
                  skool.com/kenkai
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
