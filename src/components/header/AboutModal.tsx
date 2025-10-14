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
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4 pointer-events-none">
        <div
          className="bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-full max-w-md flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h1 className="header-title text-gradient">About Chat Man</h1>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Creator Info */}
            <div>
              <h3 className="text-base font-semibold mb-2">Created by Ken Kai</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Chat Man is a modern AI chat interface powered by the Claude Agent SDK,
                designed to provide seamless conversations with advanced AI capabilities.
              </p>
            </div>

            {/* Links */}
            <div className="space-y-3">
              <a
                href="https://www.youtube.com/@kenkaidoesai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.08] transition-all no-underline"
              >
                <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">YouTube Channel</div>
                  <div className="text-xs text-gray-400">@kenkaidoesai</div>
                </div>
              </a>

              <a
                href="https://www.skool.com/kenkai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.08] transition-all no-underline"
              >
                <GraduationCap className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Skool Community</div>
                  <div className="text-xs text-gray-400">skool.com/kenkai</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
