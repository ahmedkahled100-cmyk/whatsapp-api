@echo off
title AN-Academy WhatsApp Server Status
cd /d "%~dp0"

echo Checking WhatsApp Server status...
set "PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set "PID=%%a"
)

if "%PID%"=="" (
    echo.
    echo [STATUS] WhatsApp Server is currently STOPPED.
) else (
    echo.
    echo =========================================================
    echo  [STATUS] WhatsApp Server is RUNNING in background!
    echo  - PID: %PID%
    echo  - Port: http://localhost:3001
    echo =========================================================
)

echo.
pause
