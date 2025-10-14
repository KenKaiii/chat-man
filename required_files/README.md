# Required Files for Compliance

## ⚠️ WARNING: DO NOT DELETE FILES IN THIS DIRECTORY

This directory contains critical files required for GDPR/HIPAA compliance verification.

## Purpose

The compliance status checker in the application monitors the existence of these files to verify that mandatory compliance documentation and controls are in place. Deleting or moving files from this directory will cause compliance checks to fail.

## Files in This Directory

### SECURITY_REQUIREMENTS.md
Complete documentation of GDPR and HIPAA security requirements, including:
- GDPR compliance requirements (Articles 5, 13, 15, 17, 20, 25, 32)
- HIPAA Security Rule requirements (§164.308, §164.310, §164.312)
- Implementation details for encryption, backup, audit logging, and retention policies
- Security controls and technical safeguards

## Compliance Verification

The compliance status modal (Shield icon in navbar) checks for the existence of files in this directory. If files are missing, the compliance status will show as non-compliant.

## Additional Compliance Files

Other compliance-critical files are located in:
- `src/components/auth/PrivacyNotice.tsx` - GDPR Article 13 privacy notice component
- `server/backup/backupManager.ts` - HIPAA §164.308(a)(7)(ii)(A) backup controls
- `server/audit/auditLogger.ts` - HIPAA §164.312(b) audit controls
- `server/audit/auditEvents.ts` - Audit event definitions

## Maintenance

When updating compliance documentation:
1. Always keep files in this directory
2. Update version numbers and dates in documentation
3. Verify compliance status after changes
4. Consult with legal/compliance professionals for regulatory updates

---

**Last Updated**: 2025-10-14
**Maintained By**: Chat Man Development Team
