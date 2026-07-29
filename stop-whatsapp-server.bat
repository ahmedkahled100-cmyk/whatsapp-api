@echo off
title Stop AN-Academy WhatsApp Server
cd /d "%~dp0"

echo [STOPPING] Searching for WhatsApp Server process on port 3001...
set "PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set "PID=%%a"
)

if "%PID%"=="" (
    echo [INFO] WhatsApp Server is not running.
) else (
    taskkill /F /PID %PID% >nul 2>&1
    echo [SUCCESS] WhatsApp Server (PID %PID%) stopped successfully.
)

echo.
pause
