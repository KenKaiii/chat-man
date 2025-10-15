/**
 * Chat Man - Modern chat interface with local AI models
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

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Download, CheckCircle2, X } from 'lucide-react';
import { AVAILABLE_MODELS, type ModelStatus } from '../../config/models';
import { toast } from 'sonner';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  hasMessages?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled = false, hasMessages = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentModel = modelStatuses.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // Fetch model availability status
  useEffect(() => {
    fetchModelStatus();
  }, []);

  // Poll for download progress when models are downloading
  useEffect(() => {
    if (downloadingModels.size === 0) return;

    const pollProgress = async () => {
      for (const modelId of downloadingModels) {
        try {
          const response = await fetch(`/api/models/download/progress/${encodeURIComponent(modelId)}`);
          if (!response.ok) continue;

          const data = await response.json();

          if (data.downloading && data.progress !== undefined) {
            setDownloadProgress(prev => ({
              ...prev,
              [modelId]: Math.round(data.progress),
            }));
          } else if (!data.downloading) {
            // Download complete - immediately stop polling this model
            setDownloadingModels(prev => {
              const updated = new Set(prev);
              updated.delete(modelId);
              return updated;
            });
            setDownloadProgress(prev => {
              const updated = { ...prev };
              delete updated[modelId];
              return updated;
            });
            // Refresh model status to show checkmark
            fetchModelStatus();
          }
        } catch (error) {
          console.error(`Failed to fetch progress for ${modelId}:`, error);
        }
      }
    };

    // Poll immediately and then every second
    pollProgress();
    const interval = setInterval(pollProgress, 1000);

    return () => clearInterval(interval);
  }, [downloadingModels]);

  const fetchModelStatus = async () => {
    try {
      const response = await fetch('/api/models/status');
      if (!response.ok) throw new Error('Failed to fetch model status');

      const data = await response.json();
      setModelStatuses(data.models);

      // Remove models from downloading set if they're now downloaded
      setDownloadingModels(prev => {
        const updated = new Set(prev);
        data.models.forEach((model: ModelStatus) => {
          if (model.downloaded && updated.has(model.apiModelId)) {
            updated.delete(model.apiModelId);
            toast.success(`${model.name} downloaded successfully!`);
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch model status:', error);
      // Fallback to showing all models as unknown status
      setModelStatuses(AVAILABLE_MODELS.map(m => ({ ...m, downloaded: false })));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (modelId: string, modelName: string) => {
    try {
      setDownloadingModels(prev => new Set(prev).add(modelId));
      toast.loading(`Downloading ${modelName}...`, { id: `download-${modelId}` });

      const response = await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start download');
      }

      toast.success(`Started downloading ${modelName}`, { id: `download-${modelId}` });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Failed to download ${modelName}`, { id: `download-${modelId}` });
      setDownloadingModels(prev => {
        const updated = new Set(prev);
        updated.delete(modelId);
        return updated;
      });
    }
  };

  const handleCancelDownload = async (modelId: string, modelName: string) => {
    try {
      const response = await fetch(`/api/models/download/cancel/${encodeURIComponent(modelId)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel download');
      }

      setDownloadingModels(prev => {
        const updated = new Set(prev);
        updated.delete(modelId);
        return updated;
      });
      setDownloadProgress(prev => {
        const updated = { ...prev };
        delete updated[modelId];
        return updated;
      });

      toast.success(`Cancelled download of ${modelName}`);
    } catch (error) {
      console.error('Cancel failed:', error);
      toast.error(`Failed to cancel download`);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{
          color: disabled ? 'rgb(var(--text-secondary))' : 'rgb(var(--text-primary))',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        title={hasMessages ? 'Model locked for this conversation. Start a new chat to change models.' : undefined}
      >
        <span className="font-heading text-sm">{currentModel.name}</span>
        <ChevronDown
          size={16}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: '0.5rem',
            background: 'rgb(var(--bg-input))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.75rem',
            width: '32rem',
            maxWidth: 'calc(100vw - 1rem)',
            zIndex: 9999,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ padding: '1rem 1.75rem 0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
            Model
          </div>
          <div style={{ padding: '0 1rem 1rem', maxHeight: '20rem', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(var(--text-secondary))' }}>
                Loading models...
              </div>
            ) : (
              modelStatuses.map((model) => {
                const isDownloading = downloadingModels.has(model.apiModelId);
                const canSelect = model.downloaded && !disabled;

                return (
                  <div
                    key={model.id}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      marginBottom: '0.25rem',
                      background: selectedModel === model.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      borderRadius: '0.5rem',
                      transition: 'background 0.075s',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem',
                        cursor: canSelect ? 'pointer' : 'default',
                        opacity: model.downloaded ? 1 : 0.6,
                      }}
                      onClick={() => canSelect && handleModelSelect(model.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          className="font-medium"
                          style={{
                            color: 'rgb(var(--text-primary))',
                            fontSize: '0.875rem',
                            lineHeight: 1.2,
                          }}
                        >
                          {model.name}
                        </div>
                        {model.downloaded && (
                          <CheckCircle2
                            size={14}
                            style={{ color: 'rgb(34, 197, 94)' }}
                            aria-label="Downloaded"
                          />
                        )}
                      </div>
                      <div
                        style={{
                          color: 'rgb(var(--text-secondary))',
                          fontSize: '0.75rem',
                          lineHeight: 1.3,
                        }}
                      >
                        {model.description}
                      </div>
                    </div>

                    {/* Download button for models not yet downloaded */}
                    {!model.downloaded && !isDownloading && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(model.apiModelId, model.name);
                        }}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        }}
                        title={`Download ${model.name}`}
                      >
                        <Download size={14} style={{ color: 'rgb(59, 130, 246)' }} />
                      </button>
                    )}

                    {/* Progress percentage for downloading models */}
                    {isDownloading && (
                      <div
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: hoveredModel === model.apiModelId ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          border: `1px solid ${hoveredModel === model.apiModelId ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          color: hoveredModel === model.apiModelId ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)',
                          fontWeight: 500,
                          minWidth: '50px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={() => setHoveredModel(model.apiModelId)}
                        onMouseLeave={() => setHoveredModel(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelDownload(model.apiModelId, model.name);
                        }}
                        title="Cancel download"
                      >
                        {hoveredModel === model.apiModelId ? (
                          <X size={14} />
                        ) : (
                          `${downloadProgress[model.apiModelId] || 0}%`
                        )}
                      </div>
                    )}

                    {/* Checkmark for selected model */}
                    {selectedModel === model.id && model.downloaded && (
                      <div style={{ paddingRight: '0.5rem' }}>
                        <Check size={16} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
