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

import React, { useState } from 'react';
import { MessageCircle, FileText, Zap, Mic } from 'lucide-react';

interface ModeOption {
  id: 'general' | 'rag' | 'spark' | 'voice';
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}

const MODES: ModeOption[] = [
  {
    id: 'general',
    name: 'General',
    description: 'Conversational AI assistant',
    icon: <MessageCircle className="size-4" />,
    gradient: 'linear-gradient(90deg, #A8FAC7 0%, #DAFFEE 25%, #ffffff 50%, #DAFFEE 75%, #A8FAC7 100%)',
  },
  {
    id: 'rag',
    name: 'RAG',
    description: 'Analyze documents privately',
    icon: <FileText className="size-4" />,
    gradient: 'linear-gradient(90deg, #C7A8FA 0%, #DAAEEE 25%, #ffffff 50%, #DAAEEE 75%, #C7A8FA 100%)',
  },
  {
    id: 'spark',
    name: 'Spark',
    description: 'Creative brainstorming',
    icon: <Zap className="size-4" />,
    gradient: 'linear-gradient(90deg, #FAE9A8 0%, #FFF4DA 25%, #ffffff 50%, #FFF4DA 75%, #FAE9A8 100%)',
  },
  {
    id: 'voice',
    name: 'Voice AI',
    description: 'Voice conversations',
    icon: <Mic className="size-4" />,
    gradient: 'linear-gradient(90deg, #A8DCFA 0%, #DAF2FF 25%, #ffffff 50%, #DAF2FF 75%, #A8DCFA 100%)',
  },
];

interface ModeSelectorProps {
  selectedMode: 'general' | 'rag' | 'spark' | 'voice';
  onSelectMode: (mode: 'general' | 'rag' | 'spark' | 'voice') => void;
}

export function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (modeId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 8, // 8px above button
    });
    setHoveredMode(modeId);
  };

  return (
    <>
      <div className="w-full overflow-auto scrollbar-none flex flex-row items-center justify-center gap-2 flex-wrap text-base">
        {MODES.map((mode, index) => {
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              onMouseEnter={(e) => handleMouseEnter(mode.id, e)}
              onMouseLeave={() => setHoveredMode(null)}
              className={`promptCard waterfall flex flex-col shrink-0 px-4 py-2 rounded-lg group items-center justify-center text-center ${
                isSelected
                  ? 'border-none'
                  : 'border-b-2 border-white/10 hover:border-white/20 text-white/90 hover:text-white transition'
              }`}
              style={{
              animationDelay: `${index * 60}ms`,
              ...(isSelected ? {
                background: mode.gradient,
                backgroundSize: '200% auto',
                animation: 'shimmer 3s linear infinite',
                opacity: 1,
              } : {
                backgroundColor: 'rgb(38, 40, 42)', // #26282A
              }),
            }}
          >
            <div className="flex gap-3 justify-between items-center w-full h-7"
                 style={isSelected ? { color: '#000000' } : {}}>
              <div className="flex flex-row flex-1 gap-3 items-center min-w-0 transition">
                <div className="flex justify-center items-center">
                  {mode.icon}
                </div>
                <div className="truncate font-medium">{mode.name}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>

    {/* Tooltip portal (positioned fixed to viewport, not clipped by parent) */}
    {hoveredMode && (
      <div
        className="fixed px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md border border-gray-200 shadow-lg whitespace-nowrap z-[9999] pointer-events-none"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: 'translate(-50%, -100%)',
          animation: 'fadeIn 100ms ease-out',
        }}
      >
        {MODES.find(m => m.id === hoveredMode)?.description}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45" />
      </div>
    )}
    </>
  );
}
