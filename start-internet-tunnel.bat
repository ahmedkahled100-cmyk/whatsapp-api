@echo off
title AN-Academy WhatsApp Public Tunnel
cd /d "%~dp0"
echo ========================================================
echo   AN-Academy - WhatsApp Public Internet Tunnel
echo ========================================================
echo.
echo  جاري إنشاء رابط إنترنت آمن للمعلمين خارج الشبكة...
echo.
call npx localtunnel --port 3001
pause
