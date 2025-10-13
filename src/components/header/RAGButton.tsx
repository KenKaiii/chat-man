/**
 * RAG Documents Button for Header
 */
import React from 'react';
import { FileText } from 'lucide-react';

interface RAGButtonProps {
  onClick: () => void;
}

export function RAGButton({ onClick }: RAGButtonProps) {
  return (
    <button
      className="header-btn"
      aria-label="RAG Documents"
      onClick={onClick}
      title="Manage RAG Documents"
    >
      <FileText />
    </button>
  );
}
