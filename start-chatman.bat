@echo off
REM Chat Man - Production Startup Script for Windows (Batch)
REM ===========================================================
REM This script runs Chat Man in production mode with all security checks enabled.
REM
REM IMPORTANT: Before first run, you must:
REM 1. Enable disk encryption on your computer (BitLocker)
REM 2. Change the CHAT_MAN_PASSWORD below to a strong password
REM

echo.
echo =====================================
echo    Chat Man - Production Startup
echo =====================================
echo.

REM ===== CONFIGURATION =====
REM Change this to your own secure password!
set CHAT_MAN_PASSWORD=CHANGE_ME_TO_SECURE_PASSWORD

REM Run in production mode (enforces security checks)
set NODE_ENV=production

REM ===== STARTUP =====
echo Starting Chat Man...
echo.

REM Check if password was changed
if "%CHAT_MAN_PASSWORD%"=="CHANGE_ME_TO_SECURE_PASSWORD" (
    echo [ERROR] You must change CHAT_MAN_PASSWORD in this script!
    echo    Edit start-chatman.bat and set a strong password.
    echo.
    pause
    exit /b 1
)

REM Show system info
echo System: Windows
echo Mode: PRODUCTION (security checks enabled)
echo.

REM Check BitLocker status (informational only - app will verify)
echo Checking BitLocker status...
manage-bde -status C: 2>nul
if errorlevel 1 (
    echo [WARNING] Could not check BitLocker status
    echo    Make sure BitLocker is enabled before using with sensitive data.
)
echo.

echo Starting application...
echo Access at: http://localhost:3010
echo.
echo Press Ctrl+C to stop
echo ================================
echo.

REM Start the application
bun run dev:server
