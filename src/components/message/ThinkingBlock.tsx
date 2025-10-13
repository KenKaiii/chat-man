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
import { ChevronDown } from 'lucide-react';

interface ThinkingBlockProps {
  title: string;
  content: string;
  defaultExpanded?: boolean;
}

export function ThinkingBlock({ title, content, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="thinking-block">
      <button
        className="thinking-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="thinking-header-left">
          <div className="thinking-indicator">
            <div className="thinking-dot" />
          </div>
          <div className="thinking-title">{title}</div>
        </div>
        <div className="thinking-chevron">
          <ChevronDown
            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            size={12}
            strokeWidth={3}
          />
        </div>
      </button>

      <div className="thinking-content-wrapper">
        <div className="thinking-gradient-top" style={{ opacity: isExpanded ? 1 : 0 }} />
        <div
          className="thinking-content"
          style={{
            height: isExpanded ? 'auto' : '0',
            maxHeight: isExpanded ? '10rem' : '0',
          }}
        >
          <div className="thinking-content-text">
            <blockquote className="thinking-blockquote">{content}</blockquote>
          </div>
        </div>
        <div className="thinking-gradient-bottom" style={{ opacity: isExpanded ? 0 : 0 }} />
      </div>
    </div>
  );
}
