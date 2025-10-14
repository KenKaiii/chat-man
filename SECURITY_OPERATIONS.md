# Security Operations Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-14
**Compliance**: GDPR, HIPAA

## Overview

This guide provides day-to-day security operations procedures for Chat Man administrators to maintain HIPAA/GDPR compliance and respond to security events.

## Daily Security Operations

### Morning Security Check (5 minutes)

```bash
#!/bin/bash
# Save as: scripts/daily-security-check.sh

echo "=== Daily Security Check ==="
echo "Date: $(date)"
echo ""

# 1. Check for new security alerts
echo "1. Security Alerts (Last 24 hours):"
curl -s http://localhost:3001/api/security/alerts?limit=100 | jq '.alerts[] | select(.timestamp > "'$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)'") | {timestamp, severity, type, message}'

# 2. Check authentication failures
echo ""
echo "2. Failed Login Attempts:"
curl -s http://localhost:3001/api/security/metrics | jq '.failedLoginAttempts'

# 3. Verify system health
echo ""
echo "3. System Health:"
curl -s http://localhost:3001/api/health/detailed | jq '{status, healthy}'

# 4. Check last backup
echo ""
echo "4. Last Backup:"
curl -s http://localhost:3001/api/backup/list | jq '.backups[0] | {id, timestamp, size}'

echo ""
echo "=== Check Complete ==="
```

Run daily:
```bash
chmod +x scripts/daily-security-check.sh
./scripts/daily-security-check.sh
```

### Alert Monitoring

Check security alerts throughout the day:

```bash
# View unresolved alerts
curl http://localhost:3001/api/security/alerts?resolved=false | jq

# Filter by severity
curl http://localhost:3001/api/security/alerts?severity=CRITICAL | jq
curl http://localhost:3001/api/security/alerts?severity=HIGH | jq
```

## Security Alert Response Procedures

### Alert: BRUTE_FORCE_ATTACK

**Severity**: CRITICAL
**Description**: Multiple failed login attempts detected (threshold: 5 in 15 minutes)

**Immediate Actions**:
1. Review audit logs for IP addresses:
```bash
grep "AUTH_LOGIN_FAILED" data/audit/audit.log | tail -n 20
```

2. If attack is ongoing, consider:
   - Implementing IP-based rate limiting at reverse proxy level
   - Temporarily blocking suspicious IPs in firewall
   - Increasing password complexity requirements

3. Verify account integrity:
```bash
# Check if auth file was modified
ls -la config/.auth
md5sum config/.auth
```

4. Document incident (see INCIDENT_RESPONSE.md)

**Follow-up Actions**:
- Review and update authentication policies
- Consider implementing 2FA
- Set up automated IP blocking
- Monitor for continued attempts

### Alert: MULTIPLE_BACKUP_RESTORES

**Severity**: HIGH
**Description**: Multiple backup restore operations detected (threshold: 2 in 1 hour)

**Immediate Actions**:
1. Verify restore operations were authorized:
```bash
# Review restore events in audit log
grep "BACKUP_RESTORE" data/audit/audit.log | tail -n 10
```

2. Check who performed restores (review authentication logs)

3. If unauthorized:
   - Immediately verify current database integrity
   - Compare current database with known-good backup
   - Investigate potential data breach

**Follow-up Actions**:
- Review access controls
- Implement restore approval workflow
- Document restore operations

### Alert: AUDIT_LOG_FAILURE

**Severity**: CRITICAL
**Description**: Audit logging system is failing to write events

**Immediate Actions**:
1. Check audit log file:
```bash
ls -la data/audit/audit.log
df -h  # Check disk space
```

2. Verify write permissions:
```bash
chmod 644 data/audit/audit.log
chown chatman:chatman data/audit/audit.log
```

3. Check for disk space issues:
```bash
df -h
du -sh data/audit/
```

4. If disk full, free space immediately:
```bash
# Archive old logs
tar -czf audit-archive-$(date +%Y%m%d).tar.gz data/audit/audit.log
# Rotate log
mv data/audit/audit.log data/audit/audit.log.old
touch data/audit/audit.log
chmod 644 data/audit/audit.log
```

**Follow-up Actions**:
- Implement log rotation
- Set up disk space monitoring
- Archive old logs to cold storage

### Alert: SUSPICIOUS_ACTIVITY

**Severity**: HIGH
**Description**: Unusual patterns detected in system behavior

**Immediate Actions**:
1. Review recent audit events:
```bash
tail -n 100 data/audit/audit.log | jq
```

2. Check for unusual API access patterns:
```bash
curl http://localhost:3001/api/metrics | jq '.requests.byEndpoint'
```

3. Review active sessions:
```bash
# Check session database
sqlite3 data/sessions.db "SELECT id, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 10;"
```

**Follow-up Actions**:
- Analyze patterns
- Update monitoring thresholds if needed
- Consider implementing additional detection rules

### Alert: ENCRYPTION_KEY_ACCESS

**Severity**: CRITICAL
**Description**: Unauthorized access to encryption keys detected

**Immediate Actions**:
1. **IMMEDIATELY** verify encryption files:
```bash
ls -la config/.encryption_salt
md5sum config/.encryption_salt
```

2. Check file access logs:
```bash
# On Linux with auditd
ausearch -f /opt/chatman/config/.encryption_salt

# On macOS
log show --predicate 'eventMessage contains ".encryption_salt"' --last 1h
```

3. If compromise suspected:
   - Rotate encryption keys immediately
   - Re-encrypt all data
   - Force password reset
   - Document incident as data breach

**Follow-up Actions**:
- Implement file integrity monitoring
- Review access controls
- Consider hardware security module (HSM)

## Access Control Management

### Reviewing Authentication Logs

```bash
# View all authentication events
grep -E "AUTH_LOGIN|AUTH_LOGOUT" data/audit/audit.log | jq

# Failed logins only
grep "AUTH_LOGIN_FAILED" data/audit/audit.log | jq

# Successful logins
grep "AUTH_LOGIN_SUCCESS" data/audit/audit.log | jq
```

### Password Rotation

Rotate the master password quarterly:

```bash
# 1. Generate new strong password
NEW_PASSWORD=$(openssl rand -base64 24)
echo "New password: $NEW_PASSWORD"

# 2. Set new password
export CHAT_MAN_PASSWORD="$NEW_PASSWORD"
bun run server/auth/setup.ts

# 3. Verify new password works
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$NEW_PASSWORD\"}"

# 4. Update environment variables in production
# - Update systemd service file
# - Or update .env file
# - Restart service

# 5. Document password rotation in audit log
```

### Key Rotation

Rotate encryption keys annually or after suspected compromise:

```bash
# 1. Backup current system
curl -X POST http://localhost:3001/api/backup/create

# 2. Generate new encryption salt
openssl rand -base64 32 > config/.encryption_salt.new

# 3. Stop service
sudo systemctl stop chatman

# 4. Decrypt all data with old key
# Re-encrypt with new key
# (This requires custom script - contact support)

# 5. Replace old salt
mv config/.encryption_salt config/.encryption_salt.old
mv config/.encryption_salt.new config/.encryption_salt

# 6. Restart service
sudo systemctl start chatman

# 7. Verify functionality
curl http://localhost:3001/api/health/detailed

# 8. Securely delete old salt
shred -vfz -n 10 config/.encryption_salt.old
```

## Backup Operations

### Daily Backup Verification

```bash
#!/bin/bash
# Save as: scripts/verify-daily-backup.sh

# Get today's backup
BACKUP_ID=$(curl -s http://localhost:3001/api/backup/list | jq -r '.backups[0].id')

echo "Verifying backup: $BACKUP_ID"

# Verify integrity
VERIFY_RESULT=$(curl -s -X POST http://localhost:3001/api/backup/verify/$BACKUP_ID)
echo "Verification: $VERIFY_RESULT"

# Test restore to temp location
TEST_RESULT=$(curl -s -X POST http://localhost:3001/api/backup/test-restore/$BACKUP_ID)
echo "Test Restore: $TEST_RESULT"

# Alert if failed
if [ "$(echo $VERIFY_RESULT | jq -r '.valid')" != "true" ]; then
  echo "ERROR: Backup verification failed!"
  # Send alert (email, webhook, etc.)
fi
```

Run daily:
```bash
chmod +x scripts/verify-daily-backup.sh
./scripts/verify-daily-backup.sh
```

### Weekly Off-Site Backup

```bash
#!/bin/bash
# Save as: scripts/weekly-offsite-backup.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/opt/chatman/data/backups"
OFFSITE_DIR="/mnt/offsite-storage/chatman"

# Sync backups to off-site location
rsync -avz --delete \
  --exclude='*.tmp' \
  --exclude='test-restore-*' \
  $BACKUP_DIR/ \
  $OFFSITE_DIR/

# Verify sync
BACKUP_COUNT=$(ls $BACKUP_DIR/*.backup 2>/dev/null | wc -l)
OFFSITE_COUNT=$(ls $OFFSITE_DIR/*.backup 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -ne "$OFFSITE_COUNT" ]; then
  echo "WARNING: Backup count mismatch!"
  echo "Local: $BACKUP_COUNT, Off-site: $OFFSITE_COUNT"
fi

echo "Off-site backup sync complete: $DATE"
```

### Backup Retention Management

Monitor backup storage:

```bash
# Check backup directory size
du -sh data/backups/

# List backups by age
ls -lt data/backups/*.backup

# Current retention policy (from settings.json)
cat config/settings.json | jq '.backup.keepLastN'

# Manually clean old backups if needed
find data/backups/ -name "*.backup" -mtime +30 -ls
# After review:
# find data/backups/ -name "*.backup" -mtime +30 -delete
```

## Audit Log Management

### Daily Audit Log Review

```bash
# Today's audit events
TODAY=$(date +%Y-%m-%d)
grep "\"timestamp\":\"$TODAY" data/audit/audit.log | jq

# Critical events only
grep "CRITICAL" data/audit/audit.log | jq

# Failed operations
grep "\"result\":\"FAILURE\"" data/audit/audit.log | jq
```

### Audit Log Export

Export logs for compliance reporting:

```bash
# Export last 30 days
curl "http://localhost:3001/api/audit/export?startDate=$(date -d '30 days ago' +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)" \
  > audit-export-$(date +%Y%m%d).json
```

### Audit Log Retention

Audit logs are retained according to `config/settings.json`:

```json
"audit": {
  "enabled": true,
  "logToFile": true,
  "logRetentionDays": 365  // HIPAA requirement: minimum 6 years for some data
}
```

Archive old logs:

```bash
#!/bin/bash
# Save as: scripts/archive-audit-logs.sh

# Archive logs older than retention period
RETENTION_DAYS=365
ARCHIVE_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)

# Create archive
grep -v "\"timestamp\":\"$ARCHIVE_DATE" data/audit/audit.log > data/audit/audit.log.new

# Backup old data to archive
grep "\"timestamp\":\"$ARCHIVE_DATE" data/audit/audit.log | \
  gzip > data/audit/archive/audit-$(date +%Y%m%d).log.gz

# Replace current log
mv data/audit/audit.log.new data/audit/audit.log

echo "Audit logs archived: $ARCHIVE_DATE"
```

## Data Retention Operations

### Manual Cleanup Trigger

```bash
# Trigger retention cleanup (deletes sessions older than maxSessionAgeDays)
curl -X POST http://localhost:3001/api/compliance/retention/cleanup

# View results in audit log
grep "RETENTION_CLEANUP" data/audit/audit.log | tail -n 1 | jq
```

### Data Subject Access Requests (GDPR Article 15)

Export all data for a specific session:

```bash
# List all sessions
curl http://localhost:3001/api/sessions | jq

# Export specific session data
SESSION_ID="<session-id>"
curl http://localhost:3001/api/sessions/$SESSION_ID | jq > session-export-$SESSION_ID.json

# Include in audit log
grep "SESSION_CREATE\|SESSION_DELETE" data/audit/audit.log | grep "$SESSION_ID" >> session-export-$SESSION_ID.json
```

### Right to Erasure (GDPR Article 17)

Delete user data upon request:

```bash
# Delete specific session
SESSION_ID="<session-id>"
curl -X DELETE http://localhost:3001/api/sessions/$SESSION_ID

# Verify deletion in audit log
grep "SESSION_DELETE" data/audit/audit.log | grep "$SESSION_ID"

# Document deletion request
echo "Data deletion request processed: Session $SESSION_ID on $(date)" >> data/compliance/deletion-requests.log
```

## Security Monitoring Dashboards

### Prometheus Integration

If using Prometheus for monitoring:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'chatman'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/api/metrics/prometheus'
    scrape_interval: 30s
```

### Grafana Dashboard

Key metrics to monitor:
- Failed login attempts (last 24 hours)
- Backup success rate
- Audit log write failures
- Active sessions count
- System uptime
- Security alert count by severity

## Compliance Reporting

### Monthly Security Report

Generate monthly security report:

```bash
#!/bin/bash
# Save as: scripts/monthly-security-report.sh

MONTH=$(date +%Y-%m)
REPORT_FILE="reports/security-report-$MONTH.md"

cat > $REPORT_FILE << EOF
# Security Report - $MONTH

## Authentication Metrics
$(curl -s http://localhost:3001/api/security/metrics | jq '.authentication')

## Backup Statistics
$(curl -s http://localhost:3001/api/metrics | jq '.backups')

## Security Alerts
$(curl -s http://localhost:3001/api/security/alerts | jq '{total: .count, byType: [.alerts | group_by(.type) | .[] | {type: .[0].type, count: length}]}')

## System Health
$(curl -s http://localhost:3001/api/health/detailed | jq)

## Compliance Status
- Audit logging: Enabled
- Data retention: Enabled (90 days)
- Encryption: Active (AES-256-GCM)
- Backup testing: Enabled (weekly)
- Security monitoring: Active

Generated: $(date)
EOF

echo "Report generated: $REPORT_FILE"
```

### HIPAA Audit Response

When responding to HIPAA audits:

1. Export all audit logs:
```bash
curl http://localhost:3001/api/audit/export > hipaa-audit-logs.json
```

2. Generate backup verification report:
```bash
curl http://localhost:3001/api/backup/list | jq > hipaa-backup-report.json
```

3. Export compliance status:
```bash
curl http://localhost:3001/api/compliance/status | jq > hipaa-compliance-status.json
```

4. Document security controls in place (see PRODUCTION_DEPLOYMENT.md)

## Incident Response Quick Reference

For detailed incident response procedures, see `INCIDENT_RESPONSE.md`.

**Security Event Severity Levels**:
- **CRITICAL**: Immediate action required (data breach, unauthorized access)
- **HIGH**: Urgent action within 1 hour (brute force attack, backup failure)
- **MEDIUM**: Action within 24 hours (unusual activity, configuration issues)
- **LOW**: Monitor and review (informational alerts)

**Emergency Contacts**:
- System Administrator: [Contact Info]
- Security Team: [Contact Info]
- Compliance Officer: [Contact Info]
- Legal Department: [Contact Info]

## Security Operations Checklist

### Daily ✓
- [ ] Review security alerts
- [ ] Check failed login attempts
- [ ] Verify backup created successfully
- [ ] Review system health status

### Weekly ✓
- [ ] Test backup restore to temporary location
- [ ] Review audit logs for anomalies
- [ ] Check disk space and resource usage
- [ ] Update security monitoring thresholds if needed

### Monthly ✓
- [ ] Generate security report
- [ ] Review and update access controls
- [ ] Archive old audit logs
- [ ] Test disaster recovery procedures
- [ ] Review compliance documentation

### Quarterly ✓
- [ ] Rotate master password
- [ ] Review and update security policies
- [ ] Conduct security training
- [ ] Test incident response procedures
- [ ] Update security documentation

### Annually ✓
- [ ] Rotate encryption keys
- [ ] Comprehensive security audit
- [ ] Review and update compliance documentation
- [ ] Disaster recovery full test
- [ ] Third-party security assessment

## Support

For questions or issues with security operations:
- Review: `PRODUCTION_DEPLOYMENT.md`
- Incident Response: `INCIDENT_RESPONSE.md`
- Technical Documentation: `/docs`

## Version History

- **1.0.0** (2025-10-14): Initial security operations guide
