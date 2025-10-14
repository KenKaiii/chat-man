/**
 * Settings Button
 * Opens the Settings modal for compliance configuration
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';
import SettingsModal from './SettingsModal';

export function SettingsButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Settings"
        title="Compliance Settings"
      >
        <Settings className="w-4 h-4" style={{ color: 'rgb(var(--text-secondary))' }} />
      </button>
      <SettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
