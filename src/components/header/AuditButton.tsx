/**
 * Audit Button Component
 * GDPR Article 15 - Right to Access
 * HIPAA §164.312(b) - Audit Controls
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import AuditLogViewer from '../audit/AuditLogViewer';

export function AuditButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="header-btn"
        aria-label="Audit Logs"
        title="View Audit Logs (GDPR/HIPAA)"
      >
        <ScrollText className="w-4 h-4" />
      </button>
      <AuditLogViewer isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
