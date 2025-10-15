/**
 * Privacy Notice Component
 * GDPR Article 13/14 compliance - Inform users about data processing
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from 'react';
import { Shield, Database, Lock, Trash2, Download, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface PrivacyNoticeProps {
  onAccept: () => void;
  onDecline?: () => void;
  compact?: boolean;
}

export const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({ onAccept, onDecline, compact = false }) => {
  const [accepted, setAccepted] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const handleAccept = () => {
    if (!accepted) return;
    onAccept();
  };

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          width: '100%',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1rem',
          fontSize: '0.8125rem',
          color: '#60A5FA',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          transition: 'all 0.15s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Shield style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
          <span>Privacy Notice & Data Processing Information</span>
        </div>
        <ChevronDown style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
      </button>
    );
  }

  return (
    <div style={{
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
      border: '1px solid rgba(59, 130, 246, 0.15)',
      borderRadius: '0.75rem',
      padding: '1rem',
      fontSize: '0.8125rem',
      color: 'rgb(var(--text-primary))',
      maxHeight: compact ? '60vh' : 'none',
      overflowY: compact ? 'auto' : 'visible'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Shield style={{ width: '1.25rem', height: '1.25rem', color: '#60A5FA' }} />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'rgb(var(--text-primary))' }}>
            Privacy Notice
          </h3>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgb(var(--text-secondary))',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronUp style={{ width: '1rem', height: '1rem' }} />
          </button>
        )}
      </div>

      {/* Introduction */}
      <p style={{
        color: 'rgb(var(--text-secondary))',
        lineHeight: 1.6,
        marginBottom: '1rem'
      }}>
        This notice explains how Chat Man processes and protects your data in compliance with GDPR, HIPAA, and CCPA regulations.
      </p>

      {/* Data Collection Section */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Database style={{ width: '1rem', height: '1rem', color: '#60A5FA' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>What Data We Collect</h4>
        </div>
        <ul style={{
          listStyle: 'disc',
          paddingLeft: '2rem',
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem'
        }}>
          <li><strong>Chat Messages:</strong> All conversation text you send and receive</li>
          <li><strong>Session Data:</strong> Chat history, timestamps, and session metadata</li>
          <li><strong>Uploaded Documents:</strong> Files you upload for RAG (Retrieval-Augmented Generation)</li>
          <li><strong>Authentication Data:</strong> Password hash (Argon2id encrypted) and session tokens</li>
        </ul>
      </div>

      {/* Storage Section */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Lock style={{ width: '1rem', height: '1rem', color: '#60A5FA' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Where Data is Stored</h4>
        </div>
        <ul style={{
          listStyle: 'disc',
          paddingLeft: '2rem',
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem'
        }}>
          <li><strong>Local Storage Only:</strong> All data stays on your device</li>
          <li><strong>No Cloud Sync:</strong> Data is never transmitted to external servers</li>
          <li><strong>Database Location:</strong> <code style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            fontFamily: 'monospace',
            fontSize: '0.75rem'
          }}>./data/sessions.db</code></li>
          <li><strong>Vector Database:</strong> <code style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            fontFamily: 'monospace',
            fontSize: '0.75rem'
          }}>./data/rag-vectors/</code></li>
        </ul>
      </div>

      {/* Security Section */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Shield style={{ width: '1rem', height: '1rem', color: '#60A5FA' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Security Measures</h4>
        </div>
        <ul style={{
          listStyle: 'disc',
          paddingLeft: '2rem',
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem'
        }}>
          <li><strong>End-to-End Encryption:</strong> AES-256-GCM for data encryption</li>
          <li><strong>Secure Password Hashing:</strong> Argon2id (OWASP recommended)</li>
          <li><strong>JWT Tokens:</strong> HS512 signed, 24-hour expiry</li>
          <li><strong>Rate Limiting:</strong> Protection against brute-force attacks</li>
          <li><strong>PII/PHI Redaction:</strong> Sensitive data never appears in logs</li>
        </ul>
      </div>

      {/* Disk Encryption Warning */}
      <div style={{
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <AlertTriangle style={{ width: '1.125rem', height: '1.125rem', color: '#FCD34D', flexShrink: 0, marginTop: '0.125rem' }} />
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FCD34D', marginBottom: '0.375rem' }}>
              Disk Encryption Required
            </h4>
            <p style={{ color: '#FCD34D', lineHeight: 1.6, fontSize: '0.75rem' }}>
              You must enable full-disk encryption on your device:
            </p>
            <ul style={{
              listStyle: 'disc',
              paddingLeft: '1.5rem',
              color: '#FCD34D',
              marginTop: '0.375rem',
              fontSize: '0.75rem',
              lineHeight: 1.5
            }}>
              <li><strong>macOS:</strong> FileVault (System Preferences → Security)</li>
              <li><strong>Windows:</strong> BitLocker (Settings → System → Storage)</li>
              <li><strong>Linux:</strong> LUKS (during installation or cryptsetup)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Retention Section */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Clock style={{ width: '1rem', height: '1rem', color: '#60A5FA' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Data Retention</h4>
        </div>
        <ul style={{
          listStyle: 'disc',
          paddingLeft: '2rem',
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem'
        }}>
          <li><strong>Indefinite Storage:</strong> Data is kept until you delete it</li>
          <li><strong>Auto-Retention:</strong> Optional automatic cleanup (configurable in settings)</li>
          <li><strong>Manual Deletion:</strong> Delete individual sessions or all data anytime</li>
        </ul>
      </div>

      {/* Your Rights Section */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Shield style={{ width: '1rem', height: '1rem', color: '#60A5FA' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Your Rights (GDPR)</h4>
        </div>
        <ul style={{
          listStyle: 'disc',
          paddingLeft: '2rem',
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem'
        }}>
          <li><strong>Right to Access:</strong> View all your stored data at any time</li>
          <li><strong>Right to Export:</strong> <Download style={{ width: '0.75rem', height: '0.75rem', display: 'inline', verticalAlign: 'middle' }} /> Download all data in JSON format</li>
          <li><strong>Right to Erasure:</strong> <Trash2 style={{ width: '0.75rem', height: '0.75rem', display: 'inline', verticalAlign: 'middle' }} /> Delete individual or all data permanently</li>
          <li><strong>Right to Portability:</strong> Export and transfer your data</li>
        </ul>
      </div>

      {/* California Consumer Privacy Act (CCPA) Section */}
      <div style={{
        backgroundColor: 'rgba(147, 51, 234, 0.08)',
        border: '1px solid rgba(147, 51, 234, 0.2)',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Shield style={{ width: '1rem', height: '1rem', color: '#C084FC' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C084FC' }}>
            California Residents (CCPA)
          </h4>
        </div>
        <p style={{
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          fontSize: '0.75rem',
          marginBottom: '0.625rem'
        }}>
          If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
        </p>

        <div style={{ marginBottom: '0.625rem' }}>
          <h5 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C084FC', marginBottom: '0.25rem' }}>
            Personal Information Collected
          </h5>
          <ul style={{
            listStyle: 'disc',
            paddingLeft: '1.5rem',
            color: 'rgb(var(--text-secondary))',
            lineHeight: 1.6,
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <li><strong>Identifiers:</strong> Password hash, session tokens (locally stored only)</li>
            <li><strong>Content:</strong> Chat messages, uploaded documents, conversation history</li>
            <li><strong>Usage Data:</strong> Session timestamps, chat mode preferences</li>
            <li><strong>Device Info:</strong> File paths for local database storage</li>
          </ul>
        </div>

        <div style={{ marginBottom: '0.625rem' }}>
          <h5 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C084FC', marginBottom: '0.25rem' }}>
            Your CCPA Rights
          </h5>
          <ul style={{
            listStyle: 'disc',
            paddingLeft: '1.5rem',
            color: 'rgb(var(--text-secondary))',
            lineHeight: 1.6,
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <li><strong>Right to Know:</strong> Request details about personal information collected (available via Settings → Export Data)</li>
            <li><strong>Right to Delete:</strong> Request deletion of your personal information (available via Settings → Delete All Data)</li>
            <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of exercising your privacy rights</li>
            <li><strong>Right to Opt-Out:</strong> Opt out of &ldquo;sale&rdquo; of personal information (see below)</li>
          </ul>
        </div>

        <div style={{
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '0.375rem',
          padding: '0.625rem',
          marginTop: '0.625rem'
        }}>
          <h5 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4ADE80', marginBottom: '0.25rem' }}>
            Do Not Sell My Personal Information
          </h5>
          <p style={{ color: '#4ADE80', lineHeight: 1.6, fontSize: '0.6875rem' }}>
            <strong>We do NOT sell, share, or transmit your personal information to any third parties.</strong> All data remains stored locally on your device. We do not engage in any data sales or sharing activities as defined by the CCPA. This application processes data entirely offline.
          </p>
        </div>

        <p style={{
          color: 'rgb(var(--text-secondary))',
          lineHeight: 1.6,
          fontSize: '0.6875rem',
          marginTop: '0.625rem',
          fontStyle: 'italic'
        }}>
          To exercise your CCPA rights, use the data management features in the application settings. For questions, contact: <a href="mailto:privacy@chatman.local" style={{ color: '#C084FC', textDecoration: 'underline' }}>privacy@chatman.local</a>
        </p>
      </div>

      {/* Data Controller */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        marginBottom: '1rem'
      }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem' }}>
          Data Controller
        </h4>
        <p style={{ color: 'rgb(var(--text-secondary))', lineHeight: 1.6, fontSize: '0.75rem' }}>
          <strong>You are the data controller.</strong> This application runs locally on your device, and you have complete control over all data processing activities. Chat Man is open-source software (AGPL-3.0) and does not collect, transmit, or share your data with any third parties.
        </p>
      </div>

      {/* Important Notice */}
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        marginBottom: '1rem'
      }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F87171', marginBottom: '0.375rem' }}>
          Password Cannot Be Recovered
        </h4>
        <p style={{ color: '#F87171', lineHeight: 1.6, fontSize: '0.75rem' }}>
          Your password encrypts all data using industry-standard cryptography. If you lose your password, <strong>your data cannot be recovered</strong>. We recommend using a password manager (1Password, Bitwarden, etc.) to store your password securely.
        </p>
      </div>

      {/* Acceptance */}
      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        cursor: 'pointer',
        padding: '0.75rem',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          style={{
            width: '1rem',
            height: '1rem',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: '0.125rem'
          }}
        />
        <span style={{
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          color: 'rgb(var(--text-primary))'
        }}>
          I have read and understood this privacy notice. I consent to the processing of my data as described above and confirm that I have enabled full-disk encryption on my device.
        </span>
      </label>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        flexDirection: compact ? 'column' : 'row'
      }}>
        <button
          type="button"
          onClick={handleAccept}
          disabled={!accepted}
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: accepted ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${accepted ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '0.625rem',
            color: accepted ? '#60A5FA' : 'rgb(var(--text-secondary))',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: accepted ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s'
          }}
        >
          Accept and Continue
        </button>
        {onDecline && (
          <button
            type="button"
            onClick={onDecline}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.625rem',
              color: 'rgb(var(--text-secondary))',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Decline
          </button>
        )}
      </div>
    </div>
  );
};
