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

import React, { useRef, useEffect } from 'react';
import { MessageCircle, FileText, Zap, Mic } from 'lucide-react';

interface ModeIndicatorProps {
  mode: 'general' | 'rag' | 'spark' | 'voice';
  onWidthChange?: (width: number) => void;
}

const MODE_CONFIGS = {
  general: {
    name: 'General',
    icon: MessageCircle,
    gradient: 'linear-gradient(90deg, #A8FAC7 0%, #DAFFEE 25%, #ffffff 50%, #DAFFEE 75%, #A8FAC7 100%)',
    textColor: '#000000',
  },
  'rag': {
    name: 'RAG',
    icon: FileText,
    gradient: 'linear-gradient(90deg, #C7A8FA 0%, #DAAEEE 25%, #ffffff 50%, #DAAEEE 75%, #C7A8FA 100%)',
    textColor: '#000000',
  },
  'spark': {
    name: 'Spark',
    icon: Zap,
    gradient: 'linear-gradient(90deg, #FAE9A8 0%, #FFF4DA 25%, #ffffff 50%, #FFF4DA 75%, #FAE9A8 100%)',
    textColor: '#000000',
  },
  'voice': {
    name: 'Voice AI',
    icon: Mic,
    gradient: 'linear-gradient(90deg, #A8DCFA 0%, #DAF2FF 25%, #ffffff 50%, #DAF2FF 75%, #A8DCFA 100%)',
    textColor: '#000000',
  },
};

export function ModeIndicator({ mode, onWidthChange }: ModeIndicatorProps) {
  const config = MODE_CONFIGS[mode];
  const Icon = config.icon;
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (buttonRef.current && onWidthChange) {
      const width = buttonRef.current.offsetWidth;
      onWidthChange(width + 8);
    }
  }, [mode, onWidthChange]);

  return (
    <div className="absolute py-2 select-none z-10" style={{ transform: 'translateY(0px)' }}>
      <div className="flex">
        <button
          ref={buttonRef}
          className="flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-lg"
          style={{
            background: config.gradient,
            backgroundSize: '200% auto',
            animation: 'shimmer 3s linear infinite',
            color: config.textColor,
            border: 'none',
            cursor: 'default',
          }}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span>
            <Icon className="size-4" strokeWidth={1.5} />
          </span>
          <span className="font-medium">{config.name}</span>
        </button>
      </div>
    </div>
  );
}
