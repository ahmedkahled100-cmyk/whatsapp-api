@echo off
title AN-Academy WhatsApp Server
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

node start-whatsapp-server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] WhatsApp Server stopped unexpectedly.
    pause
)
