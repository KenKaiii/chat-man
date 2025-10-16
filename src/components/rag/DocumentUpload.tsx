/**
 * Document upload component
 */
import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

export function DocumentUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress('Reading file...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress('Processing document...');
      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      await response.json();
      setProgress('✓ Document processed successfully!');

      setTimeout(() => {
        setUploading(false);
        setProgress('');
        onUploadSuccess?.();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg,.gif,.bmp,.webp"
        className="hidden"
        disabled={uploading}
      />

      <button
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
            {uploading ? progress : 'Upload Document'}
          </div>
          <div className="text-sm text-gray-400">
            Supports PDF, DOCX, TXT, MD, HTML, Images (PNG, JPG, GIF, BMP, WEBP)
          </div>
        </div>
      </button>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
