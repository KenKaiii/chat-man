/**
 * Compliance Status Modal
 * GDPR/HIPAA Compliance Checker
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { X, Check, AlertCircle, Shield, FileText, Database, Eye, Clock, Lock } from 'lucide-react';

interface ComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ComplianceStatus {
  files: {
    securityDocs: boolean;
    privacyNotice: boolean;
    backupManager: boolean;
    auditLogger: boolean;
    auditEvents: boolean;
  };
  encryption: {
    enabled: boolean;
    status: string;
  };
  backup: {
    enabled: boolean;
    directoryExists: boolean;
    backupCount: number;
    hasBackups: boolean;
    autoBackupEnabled: boolean;
    schedule: string;
  };
  audit: {
    directoryExists: boolean;
    logFileCount: number;
    hasLogs: boolean;
  };
  retention: {
    enabled: boolean;
    maxSessionAgeDays: number;
    autoCleanupEnabled: boolean;
    schedule: string;
  };
  gdpr: {
    rightToAccess: boolean;
    rightToErasure: boolean;
    rightToPortability: boolean;
    storageLimitation: boolean;
    privacyNotice: boolean;
  };
  hipaa: {
    encryption: boolean;
    backupControls: boolean;
    auditControls: boolean;
  };
  overallCompliance: {
    filesComplete: boolean;
    encryptionActive: boolean;
    backupActive: boolean;
    auditActive: boolean;
    retentionConfigured: boolean;
    gdprCompliant: boolean;
    hipaaCompliant: boolean;
  };
}

const StatusIcon = ({ status }: { status: boolean }) => {
  return status ? (
    <Check size={20} className="text-green-500 flex-shrink-0" />
  ) : (
    <X size={20} className="text-red-500 flex-shrink-0" />
  );
};

export default function ComplianceModal({ isOpen, onClose }: ComplianceModalProps) {
  const [complianceData, setComplianceData] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchComplianceStatus();
    }
  }, [isOpen]);

  const fetchComplianceStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/compliance/status');
      const data = await response.json();
      setComplianceData(data);
    } catch (error) {
      console.error('Failed to fetch compliance status:', error);
    } finally {
      setLoading(false);
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
          className="bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-full max-w-2xl flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h1 className="header-title text-gradient">
            Compliance Status
          </h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center p-8 text-gray-400">
              Loading compliance status...
            </div>
          ) : !complianceData ? (
            <div className="text-center p-8">
              <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load compliance status</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Disclaimer */}
              <div className="flex gap-3 p-4 bg-orange-500/10 border border-orange-500 rounded-lg text-sm leading-relaxed">
                <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-orange-500 block mb-2">Important Notice:</strong>
                  <p className="text-gray-400 m-0">
                    This compliance checker provides an automated status of implemented controls.
                    It is your responsibility to verify that all requirements are met, properly
                    configured, and align with current GDPR and HIPAA regulations. Please consult
                    with legal and compliance professionals to ensure full regulatory compliance.
                  </p>
                </div>
              </div>

              {/* Overall Status */}
              <Section title="Overall Compliance" icon={<Shield size={18} className="text-blue-200" />}>
                <Item status={complianceData.overallCompliance.filesComplete} label="Required Files Implemented" />
                <Item status={complianceData.overallCompliance.encryptionActive} label="Encryption System Active" />
                <Item status={complianceData.overallCompliance.backupActive} label="Backup System Active" />
                <Item status={complianceData.overallCompliance.auditActive} label="Audit Logging Active" />
                <Item status={complianceData.overallCompliance.retentionConfigured} label="Retention Policy Configured" />
                <Item status={complianceData.overallCompliance.gdprCompliant} label="GDPR Requirements Met" />
                <Item status={complianceData.overallCompliance.hipaaCompliant} label="HIPAA Requirements Met" />
              </Section>

              {/* Required Files */}
              <Section title="Required Files" icon={<FileText size={18} className="text-blue-200" />}>
                <Item status={complianceData.files.securityDocs} label="SECURITY_REQUIREMENTS.md" />
                <Item status={complianceData.files.privacyNotice} label="Privacy Notice Component" />
                <Item status={complianceData.files.backupManager} label="Backup Manager Module" />
                <Item status={complianceData.files.auditLogger} label="Audit Logger Module" />
                <Item status={complianceData.files.auditEvents} label="Audit Events Definition" />
              </Section>

              {/* Encryption */}
              <Section title="Encryption (HIPAA §164.312(a)(2)(iv))" icon={<Lock size={18} className="text-blue-200" />}>
                <Item status={complianceData.encryption.enabled} label={`AES-256-GCM Encryption: ${complianceData.encryption.status}`} />
              </Section>

              {/* Backup System */}
              <Section title="Backup Controls (HIPAA §164.308(a)(7)(ii)(A))" icon={<Database size={18} className="text-blue-200" />}>
                <Item status={complianceData.backup.enabled} label="Backup System Enabled" />
                <Item status={complianceData.backup.directoryExists} label="Backup Directory Exists" />
                <Item status={complianceData.backup.hasBackups} label={`Has Backups (${complianceData.backup.backupCount} total)`} />
                <Item status={complianceData.backup.autoBackupEnabled} label={`Auto-Backup: ${complianceData.backup.autoBackupEnabled ? complianceData.backup.schedule : 'disabled'}`} />
              </Section>

              {/* Audit Logging */}
              <Section title="Audit Controls (HIPAA §164.312(b))" icon={<Eye size={18} className="text-blue-200" />}>
                <Item status={complianceData.audit.directoryExists} label="Audit Log Directory Exists" />
                <Item status={complianceData.audit.hasLogs} label={`Active Audit Logs (${complianceData.audit.logFileCount} files)`} />
              </Section>

              {/* Retention Policy */}
              <Section title="Data Retention (GDPR Article 5.1.e)" icon={<Clock size={18} className="text-blue-200" />}>
                <Item status={complianceData.retention.enabled} label={`Retention Policy: ${complianceData.retention.enabled ? `${complianceData.retention.maxSessionAgeDays} days` : 'disabled'}`} />
                <Item status={complianceData.retention.autoCleanupEnabled} label={`Auto-Cleanup: ${complianceData.retention.autoCleanupEnabled ? complianceData.retention.schedule : 'disabled'}`} />
              </Section>

              {/* GDPR Rights */}
              <Section title="GDPR Rights Implementation" icon={<Shield size={18} className="text-blue-200" />}>
                <Item status={complianceData.gdpr.rightToAccess} label="Right to Access (Article 15)" />
                <Item status={complianceData.gdpr.rightToErasure} label="Right to Erasure (Article 17)" />
                <Item status={complianceData.gdpr.rightToPortability} label="Right to Data Portability (Article 20)" />
                <Item status={complianceData.gdpr.storageLimitation} label="Storage Limitation (Article 5.1.e)" />
                <Item status={complianceData.gdpr.privacyNotice} label="Privacy Notice (Article 13)" />
              </Section>

              {/* HIPAA Controls */}
              <Section title="HIPAA Security Controls" icon={<Shield size={18} className="text-blue-200" />}>
                <Item status={complianceData.hipaa.encryption} label="Encryption & Decryption (§164.312(a)(2)(iv))" />
                <Item status={complianceData.hipaa.backupControls} label="Data Backup & Recovery (§164.308(a)(7)(ii)(A))" />
                <Item status={complianceData.hipaa.auditControls} label="Audit Controls (§164.312(b))" />
              </Section>

              {/* Refresh Button */}
              <button
                onClick={fetchComplianceStatus}
                className="w-full p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 text-sm font-medium transition-all cursor-pointer"
              >
                Refresh Status
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
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

function Item({ status, label }: { status: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-md text-sm transition-colors">
      <StatusIcon status={status} />
      <span className="flex-1">{label}</span>
    </div>
  );
}
