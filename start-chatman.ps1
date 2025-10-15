#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Chat Man - Production Startup Script for Windows (PowerShell)

.DESCRIPTION
    This script runs Chat Man in production mode with all security checks enabled.

    IMPORTANT: Before first run, you must:
    1. Enable disk encryption on your computer (BitLocker)
    2. Change the CHAT_MAN_PASSWORD below to a strong password

.NOTES
    File Name      : start-chatman.ps1
    Prerequisite   : PowerShell 5.1 or higher, Bun runtime
    Copyright      : 2025 KenKai
    License        : AGPL-3.0-or-later
#>

# ===== CONFIGURATION =====
# Change this to your own secure password!
$env:CHAT_MAN_PASSWORD = 'CHANGE_ME_TO_SECURE_PASSWORD'

# Run in production mode (enforces security checks)
$env:NODE_ENV = 'production'

# ===== STARTUP =====
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   Chat Man - Production Startup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Chat Man..." -ForegroundColor Green
Write-Host ""

# Check if password was changed
if ($env:CHAT_MAN_PASSWORD -eq 'CHANGE_ME_TO_SECURE_PASSWORD') {
    Write-Host "[ERROR] You must change CHAT_MAN_PASSWORD in this script!" -ForegroundColor Red
    Write-Host "   Edit start-chatman.ps1 and set a strong password." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Show system info
Write-Host "System: Windows (PowerShell $($PSVersionTable.PSVersion))" -ForegroundColor White
Write-Host "Mode: PRODUCTION (security checks enabled)" -ForegroundColor White
Write-Host ""

# Check BitLocker status (informational only - app will verify)
Write-Host "Checking BitLocker status..." -ForegroundColor Yellow
try {
    $bitlockerStatus = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
    if ($bitlockerStatus) {
        if ($bitlockerStatus.ProtectionStatus -eq "On") {
            Write-Host "[OK] BitLocker is enabled on C:" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] BitLocker is NOT enabled on C:" -ForegroundColor Yellow
            Write-Host "   Enable BitLocker before using with sensitive data." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARNING] Could not check BitLocker status" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not check BitLocker status (requires admin privileges)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Starting application..." -ForegroundColor Green
Write-Host "Access at: http://localhost:3010" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host "================================" -ForegroundColor Gray
Write-Host ""

# Start the application
bun run dev:server
