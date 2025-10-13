/**
 * CommandTextRenderer - Parses text and renders slash commands as gradient pills
 */

import React from 'react';
import { CommandPill } from './CommandPill';

interface CommandTextRendererProps {
  content: string;
}

/**
 * Parse text and replace /commandname with CommandPill components
 * Handles /command at start of line or after space
 */
export function CommandTextRenderer({ content }: CommandTextRendererProps) {
  // Regex: Match /word at start of line or after whitespace
  // Captures command name without the slash
  const commandRegex = /(^|\s)(\/([a-z-]+))(?=\s|$)/gm;

  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  commandRegex.lastIndex = 0;

  while ((match = commandRegex.exec(content)) !== null) {
    const fullMatch = match[0]; // Includes leading space if any
    const leadingSpace = match[1]; // Space before command (or empty string)
    const commandName = match[3]; // "help"
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Add text before command
    if (matchStart > lastIndex) {
      parts.push(content.slice(lastIndex, matchStart));
    }

    // Add leading space if exists
    if (leadingSpace) {
      parts.push(leadingSpace);
    }

    // Add command pill (strip the /)
    parts.push(
      <CommandPill key={`cmd-${matchStart}`} commandName={commandName} />
    );

    lastIndex = matchEnd;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  // If no commands found, return original text
  if (parts.length === 0) {
    return <>{content}</>;
  }

  return <>{parts}</>;
}
