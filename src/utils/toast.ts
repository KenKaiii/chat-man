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

import { toast as sonnerToast } from 'sonner';

/**
 * Custom toast utilities with styled variants
 */

export const toast = {
  /**
   * Success toast with blue shimmer gradient (matches send button)
   */
  success: (message: string, options?: { description?: string; duration?: number }) => {
    return sonnerToast.success(message, {
      ...options,
      className: 'toast-success',
    });
  },

  /**
   * Error toast with red shimmer gradient (matches stop button)
   */
  error: (message: string, options?: { description?: string; duration?: number }) => {
    return sonnerToast.error(message, {
      ...options,
      className: 'toast-error',
    });
  },

  /**
   * Info toast with default styling
   */
  info: (message: string, options?: { description?: string; duration?: number }) => {
    return sonnerToast.info(message, {
      ...options,
    });
  },

  /**
   * Warning toast with amber shimmer gradient
   */
  warning: (message: string, options?: { description?: string; duration?: number }) => {
    return sonnerToast.warning(message, {
      ...options,
      className: 'toast-warning',
    });
  },
};
