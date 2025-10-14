# Incident Response Plan

**Version**: 1.0.0
**Last Updated**: 2025-10-14
**Compliance**: GDPR, HIPAA

## Overview

This incident response plan provides procedures for identifying, containing, and recovering from security incidents affecting Chat Man, in compliance with HIPAA §164.308(a)(6) and GDPR Article 33 breach notification requirements.

## Incident Classification

### Severity Levels

#### Level 1: CRITICAL
- Confirmed data breach with PHI/PII exposure
- Unauthorized access to encryption keys
- Complete system compromise
- Ransomware attack
- Active ongoing attack

**Response Time**: Immediate (< 15 minutes)
**Notification**: Immediate escalation to management and compliance officer

#### Level 2: HIGH
- Suspected data breach
- Multiple failed security controls
- Brute force attack in progress
- Backup system compromise
- Audit log tampering detected

**Response Time**: < 1 hour
**Notification**: Security team and system administrator

#### Level 3: MEDIUM
- Security alert patterns indicating potential threat
- Backup verification failures
- Unusual system behavior
- Authentication anomalies

**Response Time**: < 4 hours
**Notification**: System administrator

#### Level 4: LOW
- Single security control failure
- Configuration issues
- Performance degradation
- Non-critical system alerts

**Response Time**: < 24 hours
**Notification**: System administrator

## Incident Response Team

### Roles and Responsibilities

**Incident Commander**
- Overall incident coordination
- Decision-making authority
- External communications
- Contact: [Name, Phone, Email]

**Technical Lead**
- Technical investigation
- System containment
- Recovery operations
- Contact: [Name, Phone, Email]

**Compliance Officer**
- Regulatory compliance
- Breach notification assessment
- Documentation requirements
- Contact: [Name, Phone, Email]

**Legal Counsel**
- Legal implications
- Notification requirements
- Liability assessment
- Contact: [Name, Phone, Email]

**Communications Lead**
- Internal communications
- User notifications
- Media relations (if applicable)
- Contact: [Name, Phone, Email]

## Incident Response Phases

### Phase 1: Detection and Analysis

#### Detection Sources

1. **Automated Alerts**
```bash
# Check security alerts
curl http://localhost:3001/api/security/alerts?resolved=false | jq
```

2. **Audit Log Monitoring**
```bash
# Review recent critical events
grep "CRITICAL" data/audit/audit.log | tail -n 50 | jq
```

3. **System Health Checks**
```bash
# Check system health
curl http://localhost:3001/api/health/detailed | jq
```

4. **User Reports**
- Suspicious activity notifications
- Access issues
- Unusual system behavior

#### Initial Analysis Checklist

- [ ] What happened? (Event description)
- [ ] When did it happen? (Timestamp)
- [ ] What systems are affected?
- [ ] Is the incident still ongoing?
- [ ] What is the initial severity assessment?
- [ ] Has data been compromised?
- [ ] Who detected the incident?

#### Evidence Collection

**DO NOT modify production systems during evidence collection**

1. **Capture Security Alerts**
```bash
mkdir -p incident-$(date +%Y%m%d-%H%M%S)/evidence
cd incident-$(date +%Y%m%d-%H%M%S)/evidence

curl http://localhost:3001/api/security/alerts > security-alerts.json
```

2. **Export Audit Logs**
```bash
cp data/audit/audit.log audit-log-backup.log
curl http://localhost:3001/api/audit/export > audit-export.json
```

3. **Capture System State**
```bash
curl http://localhost:3001/api/health/detailed > system-health.json
curl http://localhost:3001/api/metrics > system-metrics.json
ps aux > process-list.txt
netstat -tuln > network-connections.txt
```

4. **Capture Configuration**
```bash
cp config/settings.json config-backup.json
ls -laR config/ > config-permissions.txt
md5sum config/.auth config/.encryption_salt > config-checksums.txt
```

### Phase 2: Containment

#### Short-term Containment

**For Data Breach (Level 1)**:

1. **Immediate Actions**
```bash
# Stop the service IMMEDIATELY
sudo systemctl stop chatman
# OR
pm2 stop chatman
```

2. **Isolate System**
```bash
# Block external access at firewall
sudo iptables -A INPUT -p tcp --dport 3001 -j DROP

# OR disable in reverse proxy
sudo systemctl stop nginx
```

3. **Preserve Evidence**
```bash
# Create forensic backup
sudo dd if=/dev/sda of=/mnt/forensics/disk-image-$(date +%Y%m%d).img bs=4M

# Backup database
cp data/sessions.db incident-evidence/sessions-$(date +%Y%m%d).db
```

**For Brute Force Attack (Level 2)**:

1. **Identify Attack Source**
```bash
# Find failed login attempts
grep "AUTH_LOGIN_FAILED" data/audit/audit.log | jq '.details.ip' | sort | uniq -c | sort -rn
```

2. **Block Attacker IPs**
```bash
# At firewall level
sudo iptables -A INPUT -s <attacker-ip> -j DROP

# OR in nginx
echo "deny <attacker-ip>;" >> /etc/nginx/conf.d/blocked-ips.conf
sudo systemctl reload nginx
```

3. **Force Password Reset**
```bash
# Generate new strong password
NEW_PASSWORD=$(openssl rand -base64 24)
export CHAT_MAN_PASSWORD="$NEW_PASSWORD"
bun run server/auth/setup.ts
```

**For Backup Compromise (Level 2)**:

1. **Verify All Backups**
```bash
# Check all backup integrity
for backup in data/backups/*.backup; do
  BACKUP_ID=$(basename $backup .backup)
  echo "Verifying: $BACKUP_ID"
  curl -X POST http://localhost:3001/api/backup/verify/$BACKUP_ID
done
```

2. **Isolate Backup Directory**
```bash
# Change permissions to prevent access
chmod 000 data/backups/
```

3. **Create Forensic Copy**
```bash
cp -r data/backups/ /mnt/forensics/backups-$(date +%Y%m%d)/
```

#### Long-term Containment

**Patch and Update**:
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update application dependencies
bun update

# Rebuild application
bun run build
```

**Enhanced Monitoring**:
```bash
# Reduce monitoring interval temporarily
# Edit config/settings.json
"monitoring": {
  "checkIntervalMinutes": 1  // Increased frequency during incident
}
```

**Additional Access Controls**:
- Implement IP whitelisting
- Add VPN requirement
- Enable 2FA (if available)
- Rotate all credentials

### Phase 3: Eradication

#### Remove Threat

**For Malware/Backdoor**:
1. Scan system for malware
2. Remove malicious files
3. Verify system integrity
4. Reinstall from clean source if necessary

**For Compromised Credentials**:
```bash
# Rotate all credentials
NEW_PASSWORD=$(openssl rand -base64 24)
export CHAT_MAN_PASSWORD="$NEW_PASSWORD"
bun run server/auth/setup.ts

# Rotate encryption keys
openssl rand -base64 32 > config/.encryption_salt.new
# Re-encrypt data (requires custom script)
mv config/.encryption_salt.new config/.encryption_salt
```

**For Configuration Vulnerability**:
```bash
# Review and update settings
vim config/settings.json

# Verify secure permissions
chmod 700 config/
chmod 600 config/.auth config/.encryption_salt
chmod 644 config/settings.json
```

#### Verify Eradication

- [ ] Threat no longer present in system
- [ ] All malicious artifacts removed
- [ ] Security controls functioning
- [ ] No unusual system behavior
- [ ] Clean malware scan

### Phase 4: Recovery

#### Restore Services

1. **Verify System Integrity**
```bash
# Check system health
curl http://localhost:3001/api/health/detailed | jq

# Verify no security alerts
curl http://localhost:3001/api/security/alerts?resolved=false | jq
```

2. **Test with Limited Access**
```bash
# Start service in maintenance mode
# Test core functionality
# Verify authentication works
# Check data integrity
```

3. **Restore from Backup if Necessary**
```bash
# List available backups
curl http://localhost:3001/api/backup/list | jq

# Test restore first
curl -X POST http://localhost:3001/api/backup/test-restore/<backup-id>

# If test successful, restore
curl -X POST http://localhost:3001/api/backup/restore/<backup-id>
```

4. **Gradual Service Restoration**
```bash
# Enable service
sudo systemctl start chatman

# Monitor closely
journalctl -u chatman -f

# Re-enable external access
sudo iptables -D INPUT -p tcp --dport 3001 -j DROP
sudo systemctl start nginx
```

5. **Verify Operations**
- [ ] Authentication working
- [ ] Data accessible
- [ ] Backup system operational
- [ ] Audit logging functioning
- [ ] Monitoring active
- [ ] No errors in logs

#### Enhanced Monitoring Post-Recovery

```bash
# Increase monitoring frequency temporarily
# Monitor for 72 hours after restoration
# Review security alerts every 4 hours
# Check audit logs every 8 hours
```

### Phase 5: Post-Incident Activity

#### Incident Documentation

Create detailed incident report:

```markdown
# Incident Report: [INCIDENT-ID]

## Executive Summary
- Incident type: [Data breach / Unauthorized access / etc.]
- Severity: [Level 1-4]
- Detection date: [YYYY-MM-DD HH:MM]
- Resolution date: [YYYY-MM-DD HH:MM]
- Impact: [Description]

## Timeline
| Time | Event | Action Taken |
|------|-------|--------------|
| [timestamp] | Initial detection | [action] |
| [timestamp] | Containment | [action] |
| [timestamp] | Investigation | [action] |
| [timestamp] | Resolution | [action] |

## Root Cause Analysis
- Primary cause: [description]
- Contributing factors: [list]
- How it could have been prevented: [analysis]

## Impact Assessment
- Systems affected: [list]
- Data compromised: [yes/no, details]
- Users affected: [count/scope]
- Downtime: [duration]
- Financial impact: [estimate]

## Response Effectiveness
- Detection time: [duration from occurrence to detection]
- Response time: [duration from detection to initial response]
- Resolution time: [total duration]
- What went well: [list]
- What could be improved: [list]

## Evidence Collected
- Audit logs: [location]
- System snapshots: [location]
- Security alerts: [location]
- Network captures: [location]

## Remediation Actions
- Immediate fixes: [list with completion status]
- Short-term improvements: [list with timeline]
- Long-term enhancements: [list with timeline]

## Compliance Notifications
- HIPAA breach notification required: [yes/no]
- GDPR breach notification required: [yes/no]
- Notifications sent: [list with timestamps]

## Lessons Learned
- Technical lessons: [list]
- Process improvements: [list]
- Training needs: [list]

## Recommendations
1. [Recommendation with priority]
2. [Recommendation with priority]
3. [Recommendation with priority]

---
Report prepared by: [Name]
Date: [YYYY-MM-DD]
Reviewed by: [Name]
```

#### Lessons Learned Meeting

Schedule within 7 days of incident resolution:

**Attendees**:
- Incident Response Team
- System Administrators
- Management
- Compliance Officer

**Agenda**:
1. Incident timeline review
2. What went well
3. What could be improved
4. Action items for improvement
5. Policy and procedure updates

#### Root Cause Analysis

Use the 5 Whys technique:
1. Why did the incident occur?
2. Why did that happen?
3. Why did that happen?
4. Why did that happen?
5. Why did that happen?

Document findings and implement preventive measures.

## Breach Notification Requirements

### HIPAA Breach Notification (§164.408)

#### Assessment Criteria

Determine if breach notification is required:

- [ ] Was PHI involved?
- [ ] Was it unsecured PHI (not encrypted)?
- [ ] Does it meet the definition of "breach"?
- [ ] Risk assessment completed?

**Risk Assessment Factors**:
1. Nature and extent of PHI
2. Unauthorized person who accessed PHI
3. Whether PHI was actually acquired or viewed
4. Extent to which risk has been mitigated

#### Notification Timeline

**Less than 500 individuals affected**:
- Notify individuals: Within 60 days
- Notify HHS: Annually

**500 or more individuals affected**:
- Notify individuals: Within 60 days
- Notify HHS: Within 60 days
- Notify media: Within 60 days

**Notification Content**:
- Brief description of breach
- Description of PHI involved
- Steps individuals should take
- What organization is doing
- Contact procedures

### GDPR Breach Notification (Article 33)

#### Assessment Criteria

- [ ] Is there a risk to individuals' rights and freedoms?
- [ ] Likelihood and severity of impact?
- [ ] Is data encrypted/protected?

#### Notification Timeline

**Supervisory Authority**:
- Within 72 hours of becoming aware
- If after 72 hours, must provide reasons for delay

**Data Subjects**:
- Without undue delay if high risk to rights/freedoms
- Clear and plain language
- Advice on protective measures

**Notification Content**:
- Nature of personal data breach
- Contact point for more information
- Likely consequences
- Measures taken/proposed

## Incident Response Playbooks

### Playbook 1: Suspected Data Breach

```bash
#!/bin/bash
# Execute: ./playbooks/data-breach-response.sh

echo "=== Data Breach Response Playbook ==="

# 1. STOP SERVICES
echo "Step 1: Stopping services..."
sudo systemctl stop chatman

# 2. PRESERVE EVIDENCE
echo "Step 2: Preserving evidence..."
INCIDENT_DIR="incidents/breach-$(date +%Y%m%d-%H%M%S)"
mkdir -p $INCIDENT_DIR/evidence
cp data/audit/audit.log $INCIDENT_DIR/evidence/
cp data/sessions.db $INCIDENT_DIR/evidence/
cp -r config/ $INCIDENT_DIR/evidence/

# 3. CAPTURE STATE
echo "Step 3: Capturing system state..."
curl http://localhost:3001/api/security/alerts > $INCIDENT_DIR/evidence/alerts.json
curl http://localhost:3001/api/audit/export > $INCIDENT_DIR/evidence/audit-export.json
ps aux > $INCIDENT_DIR/evidence/processes.txt
netstat -tuln > $INCIDENT_DIR/evidence/network.txt

# 4. NOTIFY TEAM
echo "Step 4: Notifying incident response team..."
# Send notifications (email, SMS, webhook)

echo "Evidence preserved in: $INCIDENT_DIR"
echo "Incident ID: breach-$(date +%Y%m%d-%H%M%S)"
echo "Next steps: Conduct investigation, assess scope, determine notification requirements"
```

### Playbook 2: Brute Force Attack

```bash
#!/bin/bash
# Execute: ./playbooks/brute-force-response.sh

echo "=== Brute Force Attack Response Playbook ==="

# 1. IDENTIFY ATTACK SOURCE
echo "Step 1: Identifying attack sources..."
grep "AUTH_LOGIN_FAILED" data/audit/audit.log | \
  jq -r '.details.ip // "unknown"' | \
  sort | uniq -c | sort -rn | head -n 10

# 2. BLOCK ATTACKERS
echo "Step 2: Blocking attacker IPs..."
# Manual review required - add IPs to blocklist
# Example: sudo iptables -A INPUT -s <IP> -j DROP

# 3. FORCE PASSWORD RESET
echo "Step 3: Rotating credentials..."
NEW_PASSWORD=$(openssl rand -base64 24)
export CHAT_MAN_PASSWORD="$NEW_PASSWORD"
bun run server/auth/setup.ts

echo "New password: $NEW_PASSWORD"
echo "Save this password securely!"

# 4. ENABLE ENHANCED MONITORING
echo "Step 4: Enhanced monitoring enabled"
echo "Monitor security alerts for next 24 hours"
```

### Playbook 3: Backup Compromise

```bash
#!/bin/bash
# Execute: ./playbooks/backup-compromise-response.sh

echo "=== Backup Compromise Response Playbook ==="

# 1. VERIFY ALL BACKUPS
echo "Step 1: Verifying all backups..."
for backup in data/backups/*.backup; do
  BACKUP_ID=$(basename $backup .backup)
  RESULT=$(curl -s -X POST http://localhost:3001/api/backup/verify/$BACKUP_ID)
  echo "$BACKUP_ID: $RESULT"
done

# 2. ISOLATE BACKUP DIRECTORY
echo "Step 2: Isolating backups..."
BACKUP_COPY="incidents/backup-forensics-$(date +%Y%m%d)"
cp -r data/backups/ $BACKUP_COPY/

# 3. IDENTIFY LAST KNOWN GOOD BACKUP
echo "Step 3: Identifying last known good backup..."
curl http://localhost:3001/api/backup/list | jq '.backups | sort_by(.timestamp) | reverse'

# 4. CREATE NEW BACKUP FROM CURRENT STATE
echo "Step 4: Creating verified backup..."
curl -X POST http://localhost:3001/api/backup/create

echo "Forensic copy saved to: $BACKUP_COPY"
```

## Communication Templates

### Internal Notification (All Staff)

```
Subject: [SEVERITY] Security Incident Notification

Team,

A [SEVERITY LEVEL] security incident has been detected affecting Chat Man.

Incident Details:
- Incident ID: [ID]
- Detection Time: [TIMESTAMP]
- Status: [Contained / Under Investigation / Resolved]
- Impact: [Description]

Actions Required:
- [Action 1]
- [Action 2]

Do Not:
- [Action to avoid]

For questions, contact the Incident Response Team at [contact].

Thank you,
[Incident Commander]
```

### User Notification (If Required)

```
Subject: Important Security Notice

Dear User,

We are writing to inform you of a security incident that may have affected your data.

What Happened:
[Brief, clear description of incident]

What Information Was Involved:
[Specific data types]

What We Are Doing:
[Actions taken to address incident]

What You Should Do:
[Specific recommendations for users]

For More Information:
Contact: [email/phone]
Reference: Incident [ID]

We take the security of your information seriously and apologize for any inconvenience.

Sincerely,
[Organization]
```

## Testing and Maintenance

### Incident Response Plan Testing

**Tabletop Exercises**: Quarterly
- Scenario-based walkthrough
- No actual system changes
- 2-hour duration

**Simulated Incidents**: Annually
- Controlled test environment
- Full response execution
- 4-hour duration

**Full DR Test**: Annually
- Production-like environment
- Complete recovery test
- 8-hour duration

### Plan Maintenance

- Review and update: Quarterly
- After each incident: Update lessons learned
- When systems change: Update procedures
- When team changes: Update contact information

## Appendices

### Appendix A: Contact Information

| Role | Name | Phone | Email | Backup |
|------|------|-------|-------|--------|
| Incident Commander | [Name] | [Phone] | [Email] | [Backup Name] |
| Technical Lead | [Name] | [Phone] | [Email] | [Backup Name] |
| Compliance Officer | [Name] | [Phone] | [Email] | [Backup Name] |
| Legal Counsel | [Name] | [Phone] | [Email] | [Backup Name] |

### Appendix B: External Contacts

| Organization | Contact | Phone | Purpose |
|--------------|---------|-------|---------|
| HHS OCR | [Contact] | 1-800-368-1019 | HIPAA breach notification |
| Data Protection Authority | [Contact] | [Phone] | GDPR breach notification |
| Law Enforcement | [Contact] | [Phone] | Criminal activity reporting |
| Cyber Insurance | [Contact] | [Phone] | Incident reporting |

### Appendix C: System Information

- **Production Server**: [hostname/IP]
- **Database Location**: [path]
- **Backup Location**: [path]
- **Audit Log Location**: [path]
- **Configuration Files**: [path]

### Appendix D: Evidence Collection Checklist

- [ ] Security alerts exported
- [ ] Audit logs backed up
- [ ] System state captured
- [ ] Configuration files backed up
- [ ] Network connections logged
- [ ] Process list captured
- [ ] System metrics recorded
- [ ] Timestamps documented
- [ ] Chain of custody maintained

## Version History

- **1.0.0** (2025-10-14): Initial incident response plan

---

**Document Classification**: CONFIDENTIAL
**Review Cycle**: Quarterly
**Next Review**: 2025-01-14
