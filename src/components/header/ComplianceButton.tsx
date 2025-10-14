/**
 * Compliance Button - Opens Compliance Status Modal
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import ComplianceModal from './ComplianceModal';

export function ComplianceButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Compliance Status"
        title="GDPR/HIPAA Compliance"
      >
        <Shield className="w-4 h-4" style={{ color: 'rgb(var(--text-secondary))' }} />
      </button>

      <ComplianceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
