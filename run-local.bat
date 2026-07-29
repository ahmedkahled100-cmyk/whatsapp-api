@echo off
title AN-Academy Full App Launcher
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Starting WhatsApp Server on port 3001...
start "WhatsApp Microservice" cmd /k "run-whatsapp-server.bat"

echo Starting Next.js Web App on port 3000...
start "AN-Academy Next.js" cmd /k "npm run dev"

echo.
echo =========================================================
echo  AN-Academy services starting in separate windows:
echo  - Next.js Web App:  http://localhost:3000
echo  - WhatsApp Server: http://localhost:3001
echo =========================================================
echo.
