/**
 * Settings Modal
 * GDPR/HIPAA Compliance Settings Management
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { X, Database, Clock, Shield, FileText, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupInfo {
  id: string;
  timestamp: string;
  size: number;
}

interface SettingsData {
  retention: {
    enabled: boolean;
    maxSessionAgeDays: number;
    autoCleanupEnabled: boolean;
    cleanupSchedule: string;
  };
  backup: {
    enabled: boolean;
    autoBackupEnabled: boolean;
    autoBackupSchedule: string;
    keepLastN: number;
  };
  audit: {
    enabled: boolean;
    logToFile: boolean;
    logRetentionDays: number;
  };
}

type TabType = 'data-rights' | 'backup' | 'retention' | 'audit';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('data-rights');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadBackups();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/backup/list');
      const data = await response.json();
      setBackups(data.backups || []);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const createBackup = async () => {
    try {
      setCreating(true);
      const response = await fetch('http://localhost:3001/api/backup/create', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Backup created successfully');
        await loadBackups();
      } else {
        toast.error('Failed to create backup');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/backup/${backupId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Backup deleted successfully');
        await loadBackups();
      } else {
        toast.error('Failed to delete backup');
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
      toast.error('Failed to delete backup');
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? Current data will be replaced.')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/backup/restore/${backupId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Backup restored successfully. Please reload the application.');
      } else {
        toast.error('Failed to restore backup');
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      toast.error('Failed to restore backup');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const exportAllData = async () => {
    try {
      setExporting(true);
      const response = await fetch('http://localhost:3001/api/data/export');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-man-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const deleteAllData = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch('http://localhost:3001/api/data/delete-all', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');

      toast.success('All data deleted. Reloading application...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete data');
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4 pointer-events-none">
        <div
          className="bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-full max-w-3xl max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h1 className="header-title text-gradient">
            Compliance Settings
          </h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 gap-4 flex-shrink-0">
          <TabButton
            active={activeTab === 'data-rights'}
            onClick={() => setActiveTab('data-rights')}
            icon={<Shield size={16} />}
            label="Data Rights"
          />
          <TabButton
            active={activeTab === 'backup'}
            onClick={() => setActiveTab('backup')}
            icon={<Database size={16} />}
            label="Backup"
          />
          <TabButton
            active={activeTab === 'retention'}
            onClick={() => setActiveTab('retention')}
            icon={<Clock size={16} />}
            label="Retention"
          />
          <TabButton
            active={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            icon={<FileText size={16} />}
            label="Audit"
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center p-8 text-gray-400">
              Loading settings...
            </div>
          ) : !settings ? (
            <div className="text-center p-8 text-gray-400">
              Failed to load settings
            </div>
          ) : (
            <>
              {/* Data Rights Tab */}
              {activeTab === 'data-rights' && (
                <div className="flex flex-col gap-6">
                  <Section title="GDPR Data Rights" icon={<Shield size={18} className="text-blue-200" />}>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm leading-relaxed text-gray-400 mb-4">
                      As the data subject, you have the right to access, export, and delete your personal data
                      under GDPR Articles 15 (Right to Access) and 17 (Right to Erasure).
                    </div>

                    {/* Export Data */}
                    <button
                      onClick={exportAllData}
                      disabled={exporting}
                      className={`w-full flex items-center gap-3 p-4 mb-4 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/15 transition-all ${exporting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <Download size={20} className="text-green-500" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">
                          {exporting ? 'Exporting...' : 'Export All Data'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Download JSON file with all sessions and messages (GDPR Article 15)
                        </div>
                      </div>
                    </button>

                    {/* Delete Data */}
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/8 hover:bg-red-500/12 cursor-pointer transition-all"
                      >
                        <Trash2 size={20} className="text-red-500" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">
                            Delete All Data
                          </div>
                          <div className="text-xs text-gray-400">
                            Permanently erase all sessions and messages (GDPR Article 17)
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/8">
                        <div className="text-sm font-semibold text-red-500 mb-2">
                          ⚠️ Warning: This action cannot be undone
                        </div>
                        <div className="text-xs text-gray-400 mb-3 leading-relaxed">
                          Type <strong className="text-red-500">DELETE</strong> to confirm permanent deletion of all data
                        </div>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Type DELETE"
                          className="w-full p-2 mb-2 bg-gray-950 border border-red-500/30 rounded-md text-sm font-mono"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={deleteAllData}
                            disabled={deleting || deleteConfirmText !== 'DELETE'}
                            className={`flex-1 p-2 rounded-md text-sm font-medium ${
                              deleteConfirmText === 'DELETE'
                                ? 'bg-red-500 text-white cursor-pointer'
                                : 'bg-red-500/30 text-white/50 cursor-not-allowed'
                            }`}
                          >
                            {deleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setDeleteConfirmText('');
                            }}
                            disabled={deleting}
                            className={`flex-1 p-2 rounded-md border border-white/10 bg-transparent text-gray-400 text-sm font-medium ${
                              deleting ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </Section>
                </div>
              )}

              {/* Backup Tab */}
              {activeTab === 'backup' && (
                <div className="flex flex-col gap-6">
                  <Section title="Backup System" icon={<Shield size={18} className="text-blue-200" />}>
                    <InfoItem
                      label="Backup Enabled"
                      value={settings.backup.enabled ? 'Yes' : 'No'}
                      status={settings.backup.enabled}
                    />
                    <InfoItem
                      label="Auto-Backup"
                      value={settings.backup.autoBackupEnabled ? `Yes (${settings.backup.autoBackupSchedule})` : 'No'}
                      status={settings.backup.autoBackupEnabled}
                    />
                    <InfoItem
                      label="Keep Last N Backups"
                      value={settings.backup.keepLastN.toString()}
                    />
                    <InfoItem
                      label="Current Backups"
                      value={backups.length.toString()}
                    />
                  </Section>

                  <Section title="Manage Backups" icon={<Database size={18} className="text-blue-200" />}>
                    <button
                      onClick={createBackup}
                      disabled={creating}
                      className={`w-full p-3 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/15 text-sm font-medium transition-all mb-4 ${creating ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {creating ? 'Creating Backup...' : 'Create Backup Now'}
                    </button>

                    {backups.length === 0 ? (
                      <div className="text-center p-8 text-gray-400">
                        No backups found. Create your first backup above.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {backups.map((backup) => (
                          <BackupItem
                            key={backup.id}
                            backup={backup}
                            onRestore={() => restoreBackup(backup.id)}
                            onDelete={() => deleteBackup(backup.id)}
                            formatBytes={formatBytes}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    )}
                  </Section>
                </div>
              )}

              {/* Retention Tab */}
              {activeTab === 'retention' && (
                <div className="flex flex-col gap-6">
                  <Section title="Data Retention Policy" icon={<Shield size={18} className="text-blue-200" />}>
                    <InfoItem
                      label="Retention Enabled"
                      value={settings.retention.enabled ? 'Yes' : 'No'}
                      status={settings.retention.enabled}
                    />
                    <InfoItem
                      label="Max Session Age"
                      value={`${settings.retention.maxSessionAgeDays} days`}
                    />
                    <InfoItem
                      label="Auto-Cleanup"
                      value={settings.retention.autoCleanupEnabled ? `Yes (${settings.retention.cleanupSchedule})` : 'No'}
                      status={settings.retention.autoCleanupEnabled}
                    />
                  </Section>

                  <Section title="GDPR Compliance" icon={<Shield size={18} className="text-blue-200" />}>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm leading-relaxed text-gray-400">
                      <strong className="text-white">GDPR Article 5.1.e - Storage Limitation</strong>
                      <p className="mt-2 mb-0">
                        Data retention policies ensure personal data is kept only as long as necessary.
                        Sessions older than {settings.retention.maxSessionAgeDays} days are automatically deleted.
                      </p>
                    </div>
                  </Section>
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === 'audit' && (
                <div className="flex flex-col gap-6">
                  <Section title="Audit Logging" icon={<Shield size={18} className="text-blue-200" />}>
                    <InfoItem
                      label="Audit Logging"
                      value={settings.audit.enabled ? 'Enabled' : 'Disabled'}
                      status={settings.audit.enabled}
                    />
                    <InfoItem
                      label="Log to File"
                      value={settings.audit.logToFile ? 'Yes' : 'No'}
                      status={settings.audit.logToFile}
                    />
                    <InfoItem
                      label="Log Retention"
                      value={`${settings.audit.logRetentionDays} days`}
                    />
                  </Section>

                  <Section title="HIPAA Compliance" icon={<Shield size={18} className="text-blue-200" />}>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm leading-relaxed text-gray-400">
                      <strong className="text-white">HIPAA §164.312(b) - Audit Controls</strong>
                      <p className="mt-2 mb-0">
                        Audit logs record all critical operations including authentication, data access,
                        modifications, and system events. Logs are retained for {settings.audit.logRetentionDays} days.
                      </p>
                    </div>
                  </Section>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-3 px-4 bg-transparent border-none border-b-2 cursor-pointer text-sm transition-all ${
        active
          ? 'border-blue-200 text-white font-semibold'
          : 'border-transparent text-gray-400 font-normal'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-base font-semibold m-0">
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

function InfoItem({ label, value, status }: { label: string; value: string; status?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-white/[0.03] rounded-md text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">
        {status !== undefined && (
          <span className="mr-2">
            {status ? '✓' : '✗'}
          </span>
        )}
        {value}
      </span>
    </div>
  );
}

function BackupItem({
  backup,
  onRestore,
  onDelete,
  formatBytes,
  formatDate,
}: {
  backup: BackupInfo;
  onRestore: () => void;
  onDelete: () => void;
  formatBytes: (bytes: number) => string;
  formatDate: (isoString: string) => string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg text-sm border border-white/10">
      <div className="flex-1">
        <div className="font-medium">
          {formatDate(backup.timestamp)}
        </div>
        <div className="text-gray-400 text-xs mt-1">
          {formatBytes(backup.size)} • ID: {backup.id.substring(0, 8)}...
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRestore}
          className="py-2 px-3 rounded-md border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 text-xs font-medium cursor-pointer transition-all"
        >
          Restore
        </button>
        <button
          onClick={onDelete}
          className="py-2 px-3 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 text-xs font-medium cursor-pointer transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
