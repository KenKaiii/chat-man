/**
 * Chat Man - Modern chat interface for Claude Agent SDK
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

import React, { useEffect, useRef, useState } from 'react';
import { X, Youtube, GraduationCap, Download, Trash2, Shield, Clock, Database, RefreshCw } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [retentionStatus, setRetentionStatus] = useState<{
    enabled: boolean;
    maxSessionAgeDays: number;
    autoCleanupEnabled: boolean;
    cleanupSchedule: string;
    expiredCount: number;
  } | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [backupList, setBackupList] = useState<Array<{
    id: string;
    filename: string;
    timestamp: string;
    size: number;
    compressed: boolean;
    encrypted: boolean;
  }>>([]);
  const [backupSettings, setBackupSettings] = useState<{
    enabled: boolean;
    autoBackupEnabled: boolean;
    autoBackupSchedule: string;
    keepLastN: number;
  } | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  useEffect(() => {
    // Create and play audio when modal opens
    const audio = new Audio('/credits.mp3');
    audio.loop = true;
    audio.volume = 0.5;

    // Try to play audio
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          audioRef.current = audio;
        })
        .catch(() => {
          // Try playing with user interaction
          const handleInteraction = () => {
            audio.play()
              .then(() => {
                audioRef.current = audio;
              })
              .catch(() => {});
            document.removeEventListener('click', handleInteraction);
          };
          document.addEventListener('click', handleInteraction, { once: true });
        });
    }

    // Fetch retention status
    fetch('http://localhost:3001/api/retention/status')
      .then(res => res.json())
      .then(data => setRetentionStatus(data))
      .catch(err => console.error('Failed to fetch retention status:', err));

    // Fetch backup list
    fetch('http://localhost:3001/api/backup/list')
      .then(res => res.json())
      .then(data => setBackupList(data.backups || []))
      .catch(err => console.error('Failed to fetch backup list:', err));

    // Fetch backup settings
    fetch('http://localhost:3001/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.backup) {
          setBackupSettings(data.backup);
        }
      })
      .catch(err => console.error('Failed to fetch backup settings:', err));

    // Stop audio when modal closes
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const response = await fetch('http://localhost:3001/api/data/export');

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-man-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch('http://localhost:3001/api/data/delete-all', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete data');
      }

      alert('All data has been permanently deleted. The page will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete data. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleRunCleanup = async () => {
    if (!retentionStatus?.enabled) {
      alert('Retention policy is not enabled');
      return;
    }

    try {
      setIsCleaningUp(true);
      const response = await fetch('http://localhost:3001/api/retention/cleanup', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to run cleanup');
      }

      const result = await response.json();
      alert(result.message);

      // Refresh retention status
      const statusResponse = await fetch('http://localhost:3001/api/retention/status');
      const statusData = await statusResponse.json();
      setRetentionStatus(statusData);
    } catch (error) {
      console.error('Cleanup failed:', error);
      alert('Failed to run cleanup. Please try again.');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsCreatingBackup(true);
      const response = await fetch('http://localhost:3001/api/backup/create', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create backup');
      }

      await response.json();
      alert('Backup created successfully!');

      // Refresh backup list
      const listResponse = await fetch('http://localhost:3001/api/backup/list');
      const listData = await listResponse.json();
      setBackupList(listData.backups || []);
    } catch (error) {
      console.error('Backup creation failed:', error);
      alert('Failed to create backup. Please try again.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    const confirmed = confirm('Are you sure you want to restore this backup? Current data will be replaced.');
    if (!confirmed) return;

    try {
      setIsRestoringBackup(true);
      const response = await fetch(`http://localhost:3001/api/backup/restore/${backupId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to restore backup');
      }

      alert('Backup restored successfully! The page will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('Backup restore failed:', error);
      alert('Failed to restore backup. Please try again.');
      setIsRestoringBackup(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    const confirmed = confirm('Are you sure you want to delete this backup?');
    if (!confirmed) return;

    try {
      const response = await fetch(`http://localhost:3001/api/backup/${backupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete backup');
      }

      alert('Backup deleted successfully!');

      // Refresh backup list
      const listResponse = await fetch('http://localhost:3001/api/backup/list');
      const listData = await listResponse.json();
      setBackupList(listData.backups || []);
    } catch (error) {
      console.error('Backup deletion failed:', error);
      alert('Failed to delete backup. Please try again.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: 'rgb(var(--bg-input))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '32rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            className="text-gradient"
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: 'var(--font-heading)',
              margin: 0,
            }}
          >
            About Chat Man
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Close"
          >
            <X size={20} style={{ color: 'rgb(var(--text-secondary))' }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Creator Info */}
          <div>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'rgb(var(--text-primary))',
                margin: '0 0 0.5rem 0',
              }}
            >
              Created by Ken Kai
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgb(var(--text-secondary))',
                margin: 0,
                lineHeight: '1.5',
              }}
            >
              Chat Man is a modern AI chat interface powered by the Claude Agent SDK,
              designed to provide seamless conversations with advanced AI capabilities.
            </p>
          </div>

          {/* Links */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <a
              href="https://www.youtube.com/@kenkaidoesai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <Youtube size={20} style={{ color: '#FF0000' }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgb(var(--text-primary))',
                  }}
                >
                  YouTube Channel
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                  }}
                >
                  @kenkaidoesai
                </div>
              </div>
            </a>

            <a
              href="https://www.skool.com/kenkai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <GraduationCap size={20} style={{ color: 'rgb(var(--blue-accent))' }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgb(var(--text-primary))',
                  }}
                >
                  Skool Community
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                  }}
                >
                  skool.com/kenkai
                </div>
              </div>
            </a>
          </div>

          {/* Data Management (GDPR Compliance) */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <Shield size={18} style={{ color: 'rgb(var(--blue-accent))' }} />
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'rgb(var(--text-primary))',
                  margin: 0,
                }}
              >
                Data Management
              </h3>
            </div>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'rgb(var(--text-secondary))',
                margin: '0 0 0.75rem 0',
                lineHeight: '1.5',
              }}
            >
              GDPR Rights: Export or permanently delete all your data
            </p>

            {/* Export Data Button */}
            <button
              onClick={handleExportData}
              disabled={isExporting}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.1)',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isExporting) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
              }}
            >
              <Download size={18} style={{ color: '#60A5FA' }} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgb(var(--text-primary))',
                  }}
                >
                  {isExporting ? 'Exporting...' : 'Export All Data'}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                  }}
                >
                  Download JSON file with all sessions and messages
                </div>
              </div>
            </button>

            {/* Delete All Data Section */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
              >
                <Trash2 size={18} style={{ color: '#F87171' }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'rgb(var(--text-primary))',
                    }}
                  >
                    Delete All Data
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgb(var(--text-secondary))',
                    }}
                  >
                    Permanently erase all sessions and messages
                  </div>
                </div>
              </button>
            ) : (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#F87171',
                    marginBottom: '0.5rem',
                  }}
                >
                  ⚠️ Warning: This action cannot be undone
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                    marginBottom: '0.75rem',
                    lineHeight: '1.5',
                  }}
                >
                  Type <strong style={{ color: '#F87171' }}>DELETE</strong> to confirm permanent deletion of all data
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    backgroundColor: 'rgb(var(--bg-primary))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '0.375rem',
                    color: 'rgb(var(--text-primary))',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                  }}
                  autoFocus
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                  }}
                >
                  <button
                    onClick={handleDeleteAllData}
                    disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      background: deleteConfirmText === 'DELETE' ? '#EF4444' : 'rgba(239, 68, 68, 0.3)',
                      color: deleteConfirmText === 'DELETE' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: isDeleting || deleteConfirmText !== 'DELETE' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'transparent',
                      color: 'rgb(var(--text-secondary))',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Data Retention Policy (GDPR Storage Limitation) */}
          {retentionStatus && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <Clock size={18} style={{ color: 'rgb(var(--blue-accent))' }} />
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'rgb(var(--text-primary))',
                    margin: 0,
                  }}
                >
                  Data Retention
                </h3>
              </div>

              {retentionStatus.enabled ? (
                <>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgb(var(--text-secondary))',
                      margin: '0 0 0.75rem 0',
                      lineHeight: '1.5',
                    }}
                  >
                    Sessions older than {retentionStatus.maxSessionAgeDays} days are automatically deleted
                    {retentionStatus.autoCleanupEnabled && ` ${retentionStatus.cleanupSchedule}`}.
                  </p>

                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'rgb(var(--text-primary))',
                        marginBottom: '0.25rem',
                      }}
                    >
                      Expired Sessions: {retentionStatus.expiredCount}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'rgb(var(--text-secondary))',
                      }}
                    >
                      {retentionStatus.expiredCount > 0
                        ? 'Sessions ready to be deleted'
                        : 'No expired sessions'}
                    </div>
                  </div>

                  {retentionStatus.expiredCount > 0 && (
                    <button
                      onClick={handleRunCleanup}
                      disabled={isCleaningUp}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        background: 'rgba(59, 130, 246, 0.1)',
                        cursor: isCleaningUp ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCleaningUp) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                      }}
                    >
                      <Trash2 size={18} style={{ color: '#60A5FA' }} />
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'rgb(var(--text-primary))',
                          }}
                        >
                          {isCleaningUp ? 'Running Cleanup...' : 'Run Cleanup Now'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'rgb(var(--text-secondary))',
                          }}
                        >
                          Delete {retentionStatus.expiredCount} expired session(s)
                        </div>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                    margin: 0,
                    lineHeight: '1.5',
                  }}
                >
                  Data retention policy is currently disabled. Sessions are kept indefinitely.
                </p>
              )}
            </div>
          )}

          {/* Encrypted Backup System (HIPAA Backup Controls) */}
          {backupSettings && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <Database size={18} style={{ color: 'rgb(var(--blue-accent))' }} />
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'rgb(var(--text-primary))',
                    margin: 0,
                  }}
                >
                  Encrypted Backups
                </h3>
              </div>

              {backupSettings.enabled ? (
                <>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgb(var(--text-secondary))',
                      margin: '0 0 0.75rem 0',
                      lineHeight: '1.5',
                    }}
                  >
                    Backups are encrypted with AES-256-GCM and compressed.
                    {backupSettings.autoBackupEnabled && ` Auto-backup runs ${backupSettings.autoBackupSchedule}, keeping last ${backupSettings.keepLastN} backups.`}
                  </p>

                  {/* Create Backup Button */}
                  <button
                    onClick={handleCreateBackup}
                    disabled={isCreatingBackup}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      marginBottom: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'rgba(59, 130, 246, 0.1)',
                      cursor: isCreatingBackup ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCreatingBackup) {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <Database size={18} style={{ color: '#60A5FA' }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'rgb(var(--text-primary))',
                        }}
                      >
                        {isCreatingBackup ? 'Creating Backup...' : 'Create Backup Now'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'rgb(var(--text-secondary))',
                        }}
                      >
                        Encrypted snapshot of all sessions and messages
                      </div>
                    </div>
                  </button>

                  {/* Backup List */}
                  {backupList.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'rgb(var(--text-primary))',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Available Backups ({backupList.length})
                      </div>
                      <div
                        style={{
                          maxHeight: '200px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        {backupList.map((backup) => (
                          <div
                            key={backup.id}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              background: 'rgba(255, 255, 255, 0.03)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'rgb(var(--text-primary))',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {new Date(backup.timestamp).toLocaleString()}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'rgb(var(--text-secondary))',
                                }}
                              >
                                {(backup.size / 1024).toFixed(2)} KB
                              </div>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: '0.5rem',
                              }}
                            >
                              <button
                                onClick={() => handleRestoreBackup(backup.id)}
                                disabled={isRestoringBackup}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  borderRadius: '0.375rem',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  background: 'rgba(34, 197, 94, 0.1)',
                                  color: '#4ADE80',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  cursor: isRestoringBackup ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <RefreshCw size={12} />
                                Restore
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(backup.id)}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  borderRadius: '0.375rem',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  color: '#F87171',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {backupList.length === 0 && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'rgb(var(--text-secondary))',
                        margin: 0,
                        textAlign: 'center',
                      }}
                    >
                      No backups available. Create one to get started.
                    </p>
                  )}
                </>
              ) : (
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-secondary))',
                    margin: 0,
                    lineHeight: '1.5',
                  }}
                >
                  Backup system is currently disabled.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
