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

/**
 * Formats a URL for display in a badge.
 * Always shows full domain, fills remaining chars (up to 20 total) with path.
 *
 * @param url - The full URL to format
 * @returns Formatted string for badge display
 *
 * @example
 * formatUrlForBadge('https://github.com/anthropics/claude-code')
 * // Returns: 'github.com/anthrop...'
 *
 * @example
 * formatUrlForBadge('https://api.openai.com/docs')
 * // Returns: 'api.openai.com/docs'
 */
export function formatUrlForBadge(url: string): string {
  const MAX_LENGTH = 20;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname + urlObj.search + urlObj.hash;

    // If domain alone exceeds max length, truncate domain itself
    if (domain.length >= MAX_LENGTH) {
      return domain.slice(0, MAX_LENGTH - 3) + '...';
    }

    // Calculate remaining space for path
    const remainingSpace = MAX_LENGTH - domain.length;

    // If path is empty or just '/', return domain only
    if (!path || path === '/') {
      return domain;
    }

    // If domain + path fits within limit, return full string
    const fullString = domain + path;
    if (fullString.length <= MAX_LENGTH) {
      return fullString;
    }

    // Truncate path to fit remaining space
    const truncatedPath = path.slice(0, remainingSpace - 3) + '...';
    return domain + truncatedPath;
  } catch {
    // If URL parsing fails, truncate the raw string
    return url.length > MAX_LENGTH ? url.slice(0, MAX_LENGTH - 3) + '...' : url;
  }
}
