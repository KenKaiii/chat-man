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
import { SyntaxHighlighter, vscDarkPlus } from '../../utils/syntaxHighlighter';
import { showError } from '../../utils/errorMessages';

interface CodeBlockWithCopyProps {
  code: string;
  language: string;
  customStyle?: React.CSSProperties;
  wrapperClassName?: string;
}

export function CodeBlockWithCopy({ code, language, customStyle, wrapperClassName }: CodeBlockWithCopyProps) {
  const [copied, setCopied] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      showError('COPY_FAILED', errorMsg);
    }
  };

  // Always use dark mode
  const buttonStyle = (buttonName: string) => ({
    cursor: 'pointer',
    backgroundColor: hoveredButton === buttonName
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
  });

  const codeStyle: { [key: string]: React.CSSProperties } = vscDarkPlus as unknown as { [key: string]: React.CSSProperties };

  return (
    <div className={`flex flex-col bg-[#0C0E10] border border-white/10 rounded-xl overflow-hidden my-3 ${wrapperClassName || ''}`} dir="ltr">
      {/* Title bar - matching tool display style */}
      <div className="flex justify-between items-center px-4 py-2 w-full text-xs border-b border-white/10">
        {/* Left side: icon + language label */}
        <div className="flex gap-2 items-center">
          {/* Code icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-4 text-white/80"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          <div className="text-sm font-medium leading-6 text-white">{language}</div>
        </div>

        {/* Right side: copy button */}
        <button
          onClick={handleCopy}
          className="px-1.5 py-0.5 rounded-md border-none transition copy-code-button text-xs"
          style={buttonStyle('copy')}
          onMouseEnter={() => setHoveredButton('copy')}
          onMouseLeave={() => setHoveredButton(null)}
          aria-label={copied ? "Copied!" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code content */}
      <SyntaxHighlighter
        style={codeStyle}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          ...customStyle,
          margin: 0,
          marginTop: 0,
          paddingTop: '1rem',
          borderRadius: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
