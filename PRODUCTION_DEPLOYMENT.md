# Production Deployment Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-14
**Compliance**: GDPR, HIPAA

## Overview

This guide provides step-by-step instructions for deploying Chat Man to a production environment with full HIPAA/GDPR compliance features enabled.

## Pre-Deployment Checklist

### 1. Environment Requirements

- [ ] Node.js 18+ or Bun runtime installed
- [ ] Ollama installed and configured
- [ ] SQLite3 or PostgreSQL database available
- [ ] Sufficient disk space (minimum 10GB for backups)
- [ ] SSL/TLS certificates configured
- [ ] Reverse proxy configured (nginx/Apache)
- [ ] Firewall rules configured

### 2. Security Configuration

- [ ] Generate strong encryption salt: `openssl rand -base64 32`
- [ ] Set strong CHAT_MAN_PASSWORD environment variable (minimum 12 characters, mixed case, numbers, symbols)
- [ ] Configure file permissions: `config/` directory should be 700, `.auth` and `.encryption_salt` should be 600
- [ ] Enable audit logging in `config/settings.json`
- [ ] Configure backup retention policy
- [ ] Set up monitoring alerts webhook (optional)

### 3. Database Setup

- [ ] Database file location secured with appropriate permissions
- [ ] Backup directory created: `data/backups/`
- [ ] Audit log directory created: `data/audit/`
- [ ] Vector database directory created: `data/rag-vectors/`

### 4. Configuration Files

- [ ] `config/settings.json` - Production settings configured
- [ ] `config/system-prompt.txt` - System prompt customized (optional)
- [ ] `config/knowledge.md` - Knowledge base populated (optional)
- [ ] `.env` file created with required variables (see below)

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required
NODE_ENV=production
CHAT_MAN_PASSWORD=<your-strong-password>
PORT=3001

# Optional
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_PATH=./data/sessions.db
BACKUP_DIR=./data/backups
AUDIT_LOG_PATH=./data/audit/audit.log

# Monitoring (optional)
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd /path/to/chat-man
bun install
```

### Step 2: Initialize Security System

```bash
# Set password and generate encryption keys
export CHAT_MAN_PASSWORD='YourStrongPassword123!'
bun run build
bun run server/auth/setup.ts
```

This creates:
- `config/.auth` - Hashed password (Argon2id)
- `config/.encryption_salt` - Encryption key derivation salt (HKDF)

### Step 2a: Enable Filesystem Encryption (REQUIRED for HIPAA §164.312(a)(2)(iv))

**macOS:**
```bash
# Enable FileVault
System Preferences > Security & Privacy > FileVault > Turn On FileVault
```

**Linux:**
```bash
# Verify LUKS encryption is enabled
lsblk -o NAME,FSTYPE | grep crypto_LUKS
# If not encrypted, encrypt your system disk before proceeding
```

**Windows:**
```bash
# Enable BitLocker
Control Panel > BitLocker Drive Encryption > Turn On BitLocker
```

**Note**: The application will check filesystem encryption on startup. In production mode, it will exit if encryption is not detected. To bypass this check (NOT RECOMMENDED for HIPAA/GDPR compliance):
```bash
export SKIP_ENCRYPTION_CHECK=true
```

### Step 2b: Migrate Existing Messages to Encrypted Format

If you have existing data, run the migration script:

```bash
export CHAT_MAN_PASSWORD='YourStrongPassword123!'
bun run server/scripts/migrate-encrypt-messages.ts
```

This will:
- Encrypt all plaintext messages with AES-256-GCM
- Verify encryption integrity
- Generate a migration report
- Keep legacy data during migration for safety

### Step 3: Configure Production Settings

Edit `config/settings.json`:

```json
{
  "model": {
    "name": "llama3.2:3b",
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "max_tokens": 2048
  },
  "system": {
    "enableKnowledgeBase": true,
    "enableSystemPrompt": true,
    "streamingEnabled": true
  },
  "retention": {
    "enabled": true,
    "maxSessionAgeDays": 90,
    "autoCleanupEnabled": true,
    "cleanupSchedule": "daily"
  },
  "backup": {
    "enabled": true,
    "autoBackupEnabled": true,
    "autoBackupSchedule": "daily",
    "keepLastN": 7,
    "testBackupsEnabled": true,
    "testBackupSchedule": "weekly"
  },
  "audit": {
    "enabled": true,
    "logToFile": true,
    "logRetentionDays": 2190
  },
  "monitoring": {
    "enabled": true,
    "alertWebhookUrl": null,
    "failedLoginThreshold": 5,
    "backupRestoreThreshold": 2,
    "checkIntervalMinutes": 5,
    "retainAlertsForDays": 90
  }
}
```

### Step 4: Secure File Permissions

```bash
# Secure configuration directory
chmod 700 config/
chmod 600 config/.auth
chmod 600 config/.encryption_salt
chmod 644 config/settings.json

# Secure data directories
chmod 700 data/
chmod 700 data/backups/
chmod 700 data/audit/
chmod 600 data/sessions.db
```

### Step 5: Test Authentication

```bash
# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "YourStrongPassword123!"}'

# Should return: {"success": true, "message": "Authentication successful"}
```

### Step 6: Verify Backup System

```bash
# Create a test backup
curl -X POST http://localhost:3001/api/backup/create \
  -H "Content-Type: application/json"

# List backups
curl http://localhost:3001/api/backup/list

# Verify backup integrity
curl -X POST http://localhost:3001/api/backup/verify/<backup-id>

# Test restore to temporary location
curl -X POST http://localhost:3001/api/backup/test-restore/<backup-id>
```

### Step 7: Configure Monitoring

```bash
# Check system health
curl http://localhost:3001/api/health/detailed

# Check security metrics
curl http://localhost:3001/api/security/metrics

# View security alerts
curl http://localhost:3001/api/security/alerts

# Prometheus metrics endpoint
curl http://localhost:3001/api/metrics/prometheus
```

### Step 8: Start Production Server

#### Option A: Systemd Service (Linux)

Create `/etc/systemd/system/chatman.service`:

```ini
[Unit]
Description=Chat Man Server
After=network.target ollama.service

[Service]
Type=simple
User=chatman
WorkingDirectory=/opt/chatman
Environment="NODE_ENV=production"
Environment="CHAT_MAN_PASSWORD=YourStrongPassword123!"
Environment="PORT=3001"
ExecStart=/usr/bin/bun run server/server.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable chatman
sudo systemctl start chatman
sudo systemctl status chatman
```

#### Option B: Docker Container

Create `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .

EXPOSE 3001

CMD ["bun", "run", "server/server.ts"]
```

Build and run:

```bash
docker build -t chatman:latest .
docker run -d \
  --name chatman \
  -p 3001:3001 \
  -v /opt/chatman/data:/app/data \
  -v /opt/chatman/config:/app/config \
  -e CHAT_MAN_PASSWORD='YourStrongPassword123!' \
  -e NODE_ENV=production \
  --restart unless-stopped \
  chatman:latest
```

#### Option C: PM2 Process Manager

```bash
pm2 start server/server.ts --name chatman --interpreter bun
pm2 save
pm2 startup
```

### Step 9: Configure Reverse Proxy

#### Nginx Configuration

```nginx
upstream chatman {
    server localhost:3001;
}

server {
    listen 443 ssl http2;
    server_name chat.example.com;

    ssl_certificate /etc/ssl/certs/chat.example.com.crt;
    ssl_certificate_key /etc/ssl/private/chat.example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://chatman;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://chatman;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Step 10: Configure Automated Backups

The system includes automated backups, but you should also configure off-site backup sync:

```bash
# Add to crontab: daily off-site backup sync
0 2 * * * rsync -avz --delete /opt/chatman/data/backups/ backup-server:/backups/chatman/
```

## Post-Deployment Verification

### 1. Health Check

```bash
curl http://localhost:3001/api/health/detailed | jq
```

Expected output:
```json
{
  "healthy": true,
  "status": "healthy",
  "checks": {
    "database": { "status": "pass", "message": "Database is accessible" },
    "encryption": { "status": "pass", "message": "Encryption system operational" },
    "backup": { "status": "pass", "message": "Backup system operational" },
    "audit": { "status": "pass", "message": "Audit system operational" },
    "diskSpace": { "status": "pass", "message": "Sufficient disk space" },
    "memory": { "status": "pass", "message": "Memory usage normal" },
    "ollama": { "status": "pass", "message": "Ollama is accessible" }
  }
}
```

### 2. Audit Log Verification

```bash
tail -n 10 data/audit/audit.log
```

Should show recent events with timestamps.

### 3. Backup Verification

```bash
# List backups
curl http://localhost:3001/api/backup/list | jq

# Test restore
curl -X POST http://localhost:3001/api/backup/test-restore/<backup-id> | jq
```

### 4. Security Monitoring

```bash
# Check for security alerts
curl http://localhost:3001/api/security/alerts | jq

# View security metrics
curl http://localhost:3001/api/security/metrics | jq
```

## Monitoring and Maintenance

### Daily Tasks

- Monitor application logs: `journalctl -u chatman -f` (systemd) or `pm2 logs chatman`
- Check security alerts: `curl http://localhost:3001/api/security/alerts`
- Verify backup creation: `ls -lh data/backups/`

### Weekly Tasks

- Review audit logs: `data/audit/audit.log`
- Test backup restore: `POST /api/backup/test-restore/:id`
- Check disk space usage: `df -h`
- Review security metrics dashboard

### Monthly Tasks

- Rotate logs if needed
- Review retention policy effectiveness
- Update system dependencies: `bun update`
- Security audit of access logs

## Compliance Documentation

### HIPAA Requirements Met

- ✅ §164.308(a)(1)(ii)(D) - Access controls via password authentication (Argon2id)
- ✅ §164.308(a)(3) - Workforce training required (documented in SECURITY_OPERATIONS.md)
- ✅ §164.308(a)(5)(ii)(C) - Login monitoring via audit logs
- ✅ §164.308(a)(7)(ii)(A) - Backup controls with automated testing
- ✅ §164.312(a)(2)(iii) - Automatic logoff (15-minute session timeout)
- ✅ §164.312(a)(2)(iv) - Encryption at rest:
  - Database field-level encryption (AES-256-GCM)
  - Backup encryption (AES-256-GCM)
  - Filesystem encryption verification (FileVault/LUKS/BitLocker)
- ✅ §164.312(b) - Audit controls comprehensive logging
- ✅ §164.312(c)(1) - Integrity controls via backup verification
- ✅ §164.316(b)(2)(i) - Audit log retention (6 years / 2,190 days)

### GDPR Requirements Met

- ✅ Article 5 - Principles relating to processing (data minimization, integrity, confidentiality)
- ✅ Article 15 - Right to access (data export functionality + DSR workflow)
- ✅ Article 16 - Right to rectification (DSR workflow)
- ✅ Article 17 - Right to erasure (session deletion + retention policy + DSR workflow)
- ✅ Article 18 - Right to restriction of processing (DSR workflow)
- ✅ Article 20 - Right to data portability (structured JSON export + DSR workflow)
- ✅ Article 21 - Right to object (DSR workflow)
- ✅ Article 25 - Data protection by design and by default (encryption, access control, audit logging)
- ✅ Article 30 - Records of processing activities (comprehensive audit logs with 6-year retention)
- ✅ Article 32 - Security of processing:
  - Password hashing (Argon2id)
  - Database field-level encryption (AES-256-GCM)
  - Backup encryption (AES-256-GCM)
  - Filesystem encryption verification
  - Session timeout (15 minutes)
  - File permission verification
- ✅ Article 33 - Breach notification capability (security alerts + monitoring)

## Troubleshooting

### Issue: Authentication Fails

**Symptoms**: 401 Unauthorized on all requests

**Solutions**:
1. Verify password: `echo $CHAT_MAN_PASSWORD`
2. Check `.auth` file exists: `ls -la config/.auth`
3. Regenerate auth files: `bun run server/auth/setup.ts`
4. Check file permissions: `ls -la config/`

### Issue: Backup Creation Fails

**Symptoms**: Backup endpoints return errors

**Solutions**:
1. Check disk space: `df -h`
2. Verify backup directory exists: `ls -la data/backups/`
3. Check directory permissions: `ls -la data/`
4. Review audit logs for error details

### Issue: Health Check Shows Degraded

**Symptoms**: Health endpoint reports "degraded" status

**Solutions**:
1. Check detailed health report: `GET /api/health/detailed`
2. Review which subsystem is failing
3. Check Ollama connectivity: `curl http://localhost:11434/api/tags`
4. Verify database file: `ls -la data/sessions.db`

### Issue: Security Alerts Not Firing

**Symptoms**: No alerts despite suspicious activity

**Solutions**:
1. Verify monitoring enabled in `config/settings.json`
2. Check alert threshold settings
3. Review audit logs for events
4. Test webhook URL if configured

## Support and Resources

- **Documentation**: `/docs` directory
- **Audit Logs**: `data/audit/audit.log`
- **Security Operations Guide**: `SECURITY_OPERATIONS.md`
- **Incident Response**: `INCIDENT_RESPONSE.md`

## Version History

- **1.0.0** (2025-10-14): Initial production deployment guide
