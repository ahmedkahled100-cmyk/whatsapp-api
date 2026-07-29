@echo off
title AN-Academy WhatsApp Server (Background)
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this machine!
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Starting WhatsApp Server in background...
wscript //Nologo start-whatsapp-background.vbs

echo.
echo =========================================================
echo  [SUCCESS] WhatsApp Server is now running in the background!
echo  - Port: http://localhost:3001
echo  - Logs & QR Code: whatsapp-server.log
echo  - You can safely CLOSE this window. It will keep running.
echo =========================================================
echo.
pause
