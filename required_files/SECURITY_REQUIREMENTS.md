# Security Requirements for Chat Man

## Overview

Chat Man is a GDPR and HIPAA compliant local chat application that stores all data on your device. This document outlines the mandatory security requirements for running this application.

## CRITICAL REQUIREMENT: Full-Disk Encryption

**YOU MUST enable full-disk encryption on your device before using Chat Man.**

While the application encrypts data in transit and uses strong password hashing, the SQLite database files are stored in plaintext on disk. Full-disk encryption is essential to protect your data at rest.

### How to Enable Disk Encryption

#### macOS - FileVault

1. Open System Preferences → Security & Privacy
2. Click the "FileVault" tab
3. Click the lock icon and enter your admin password
4. Click "Turn On FileVault"
5. Follow the setup wizard
6. **Save your recovery key in a secure location**

Verify FileVault is enabled:
```bash
fdesetup status
```

You should see: `FileVault is On.`

#### Windows - BitLocker

1. Open Settings → System → Storage
2. Click "Advanced storage settings"
3. Select "Disk & volumes"
4. Click your system drive (usually C:)
5. Click "Turn on BitLocker"
6. Follow the setup wizard
7. **Save your recovery key in a secure location**

Verify BitLocker is enabled:
```powershell
manage-bde -status C:
```

You should see: `Conversion Status: Fully Encrypted`

#### Linux - LUKS

LUKS encryption is typically configured during installation. If you need to add encryption to an existing system:

**WARNING: This will erase all data on the partition. Backup first!**

```bash
# Encrypt a partition (replace /dev/sdX1 with your partition)
cryptsetup luksFormat /dev/sdX1

# Open the encrypted partition
cryptsetup open /dev/sdX1 cryptdisk

# Create filesystem
mkfs.ext4 /dev/mapper/cryptdisk

# Add to /etc/crypttab for auto-mount
echo "cryptdisk /dev/sdX1 none luks" >> /etc/crypttab
```

Verify LUKS encryption:
```bash
cryptsetup status /dev/mapper/cryptdisk
```

## Password Requirements

Your master password protects all data encryption keys. It must meet these requirements:

- **Minimum 12 characters**
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)
- Must not contain common weak patterns (password, 123456, qwerty, etc.)

### Password Storage

**CRITICAL: If you lose your password, your data CANNOT be recovered.**

We strongly recommend using a password manager:

- [1Password](https://1password.com/)
- [Bitwarden](https://bitwarden.com/)
- [KeePassXC](https://keepassxc.org/)
- [LastPass](https://www.lastpass.com/)

Do NOT:
- Write your password on paper (unless stored in a physical safe)
- Store your password in plain text files
- Share your password via email or messaging apps
- Use the same password for other services

## Data Storage Locations

All data is stored locally on your device in the following locations:

```
chat-man/
├── config/
│   ├── .auth                  # Password hash (Argon2id)
│   └── .encryption_salt       # Encryption salt
├── data/
│   ├── sessions.db           # Chat history and messages
│   └── rag-vectors/          # Uploaded documents (vector database)
└── backups/                  # Encrypted backups (if enabled)
```

### Important Notes

1. **Never commit these files to git** - They are excluded in `.gitignore`
2. **Never share your `config/` directory** - Contains authentication secrets
3. **Never upload `data/` directory** - Contains all your chat history
4. **Backup encrypted** - Only store backups on encrypted drives

## Network Security

### Local-Only Operation

Chat Man runs entirely on localhost:

- **WebSocket:** `ws://localhost:3001/ws`
- **API Server:** `http://localhost:3001`
- **Ollama:** `http://localhost:11434` (if used)

### DO NOT expose to network

Never bind Chat Man to `0.0.0.0` or your network IP address. This would expose your chat history to your local network without HTTPS/WSS encryption.

If you need to access from other devices, use SSH tunneling instead:

```bash
# From remote device
ssh -L 3001:localhost:3001 user@your-machine

# Then access http://localhost:3001 on remote device
```

## Authentication

### JWT Tokens

- **Algorithm:** HS512 (HMAC SHA-512)
- **Expiry:** 24 hours
- **Maximum Session:** 7 days
- **Storage:** Browser localStorage (cleared on logout)

### Rate Limiting

- **Maximum attempts:** 5 failed login attempts
- **Lockout period:** 1 hour
- **Window:** 15 minutes

## Encryption Specifications

### At-Rest Encryption (via Disk Encryption)

- **Required:** Full-disk encryption (FileVault/BitLocker/LUKS)
- **Algorithm:** OS-dependent (typically AES-128/256)
- **Managed by:** Operating system

### In-Transit Encryption

- **WebSocket:** Currently `ws://` (plaintext)
- **Recommended:** Use SSH tunnel for remote access
- **Future:** Optional HTTPS/WSS with mkcert

### Password Hashing

- **Algorithm:** Argon2id
- **Memory cost:** 64 MiB (65536 KiB)
- **Time cost:** 3 iterations
- **Parallelism:** 4 threads
- **Salt:** 32 bytes (cryptographically random)

### Data Encryption (Future)

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** HKDF (HMAC-based)
- **IV:** 16 bytes (random per encryption)
- **Auth tag:** 16 bytes (GCM)

## Compliance

### GDPR (General Data Protection Regulation)

Chat Man complies with GDPR requirements:

✅ **Right to Access** - View all stored data via session API
✅ **Right to Erasure** - Delete sessions or all data
✅ **Right to Portability** - Export data in JSON format
✅ **Data Minimization** - Only stores necessary chat data
✅ **Storage Limitation** - Optional auto-deletion policies
✅ **Security** - Encryption, access controls, audit logs
✅ **Transparency** - Privacy notice shown during setup

### HIPAA (Health Insurance Portability and Accountability Act)

If you plan to store Protected Health Information (PHI):

✅ **Access Controls** - Password authentication with strong requirements
✅ **Audit Controls** - Logging of access and modifications
✅ **Integrity** - Encryption prevents tampering
✅ **Transmission Security** - Local-only (no network transmission)
⚠️ **At-Rest Encryption** - Requires full-disk encryption

**Note:** Chat Man is suitable for HIPAA compliance when used with full-disk encryption on a properly secured device.

## Security Checklist

Before using Chat Man with sensitive data:

- [ ] Full-disk encryption enabled (FileVault/BitLocker/LUKS)
- [ ] Strong master password set (12+ chars, mixed case, numbers, symbols)
- [ ] Password stored in password manager
- [ ] Recovery key for disk encryption backed up securely
- [ ] Application only accessible on localhost
- [ ] No sensitive files committed to git
- [ ] Regular backups created and encrypted
- [ ] Physical device security maintained (screen lock, etc.)
- [ ] Operating system and security updates installed
- [ ] Antivirus/anti-malware software active (if applicable)

## Incident Response

### If Your Password is Compromised

1. **Change password immediately** in application settings
2. **Review audit logs** for unauthorized access
3. **Export all data** for backup
4. **Delete and recreate** all sessions if needed
5. **Rotate disk encryption key** (OS-specific procedure)

### If Your Device is Lost or Stolen

1. **If disk encryption enabled:** Data is protected
2. **If not encrypted:** Assume data is compromised
3. **Report to appropriate authorities** if required by law
4. **Document the incident** for compliance purposes

### If You Forget Your Password

**Data cannot be recovered. There is no password reset mechanism.**

This is by design for security. You will need to:

1. Delete `config/.auth` file
2. Restart the application
3. Set up a new password
4. **All existing data will remain encrypted and inaccessible**

## Best Practices

### General Security

1. **Keep software updated** - OS, Chat Man, and Ollama
2. **Enable screen lock** - Auto-lock after 5-10 minutes
3. **Use firewall** - Block incoming connections
4. **Disable unnecessary services** - Reduce attack surface
5. **Be cautious with backups** - Encrypt before cloud storage

### Physical Security

1. **Never leave device unlocked** in public spaces
2. **Use privacy screen** when using in public
3. **Secure device when not in use** - Lock screen or shutdown
4. **Keep backup recovery keys** in a safe physical location

### Operational Security

1. **Review sessions regularly** - Delete old/unnecessary chats
2. **Monitor audit logs** - Check for suspicious activity
3. **Test backup restoration** - Ensure backups work
4. **Document incidents** - Keep records for compliance
5. **Train users** - If multiple people use the device

## Support

For security issues or questions:

- **GitHub Issues:** https://github.com/kenkai/chat-man/issues
- **Security Email:** (Configure if needed)
- **Documentation:** https://github.com/kenkai/chat-man

## Version History

- **v1.0.0** (2025-01-14) - Initial security requirements
- **v1.0.1** (2025-01-14) - Added GDPR/HIPAA compliance section

---

**Last Updated:** 2025-01-14
**License:** AGPL-3.0-or-later
