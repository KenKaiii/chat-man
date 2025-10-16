/**
 * RAG Documents Management Modal
 */
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Document {
  id: string;
  chunkCount: number;
  totalTokens: number;
  documentName?: string;
}

interface RAGModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RAGModal({ isOpen, onClose }: RAGModalProps) {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 5;

  // Load documents on mount
  useEffect(() => {
    if (isOpen) {
      loadDocuments(true); // Show loading spinner on initial load
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const loadDocuments = async (showLoading: boolean = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/rag/documents');
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleFileSelect = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        await loadDocuments();
        setCurrentPage(1);
      } else {
        alert(`Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/rag/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadDocuments();
        // Adjust page if needed
        const totalPages = Math.ceil((documents.length - 1) / itemsPerPage);
        if (currentPage > totalPages) {
          setCurrentPage(Math.max(1, totalPages));
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Truncate filename to 30 characters
  const truncateFilename = (filename: string, maxLength: number = 30): string => {
    if (filename.length <= maxLength) return filename;

    // Try to keep file extension
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex > 0 && filename.length - lastDotIndex <= 5) {
      const extension = filename.substring(lastDotIndex);
      const nameWithoutExt = filename.substring(0, lastDotIndex);
      const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3);
      return `${truncatedName}...${extension}`;
    }

    // No extension or extension too long, just truncate
    return filename.substring(0, maxLength - 3) + '...';
  };

  // Pagination
  const totalPages = Math.ceil(documents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDocuments = documents.slice(startIndex, endIndex);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <div
          className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <h1 className="header-title text-gradient">RAG Documents</h1>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleInputChange}
                accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                className="hidden"
                disabled={uploading}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center gap-4 mx-auto"
              >
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-gray-400" />
                )}

                <div className="space-y-2">
                  <div className="text-lg font-medium">
                    {uploading ? 'Processing...' : 'Upload Document'}
                  </div>
                  <div className="text-sm text-gray-400">
                    Click or drag files here (PDF, DOCX, TXT, MD, HTML, Images)
                  </div>
                </div>
              </button>
            </div>

            {/* Document List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">
                  Uploaded Documents ({documents.length})
                </h3>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No documents uploaded yet
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {currentDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate" title={doc.documentName || doc.id}>
                              {truncateFilename(doc.documentName || doc.id)}
                            </div>
                            <div className="text-sm text-gray-400">
                              {doc.chunkCount} chunks • {doc.totalTokens.toLocaleString()} tokens
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-colors flex-shrink-0"
                          aria-label="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                      <div className="text-sm text-gray-400">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
