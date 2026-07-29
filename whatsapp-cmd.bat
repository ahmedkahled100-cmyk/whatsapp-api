@echo off
chcp 65001 >nul
title AN-Academy - WhatsApp Server Manager (CMD)
cd /d "%~dp0"

:MENU
cls
echo ========================================================
echo        AN-Academy - WhatsApp Server Control Panel
echo ========================================================
echo.
echo  [1] Start Server (Background)  /  تشغيل الخادم في الخلفية
echo  [2] Check Server Status       /  معرفة حالة الخادم
echo  [3] Stop WhatsApp Server       /  إيقاف خادم الواتساب
echo  [4] View Logs                 /  عرض آخر السجلات
echo  [0] Exit                      /  خروج
echo.
echo ========================================================
set "choice="
set /p choice="Enter choice [0-4] / اختر رقم الخيار: "

if "%choice%"=="1" goto START_SERVER
if "%choice%"=="2" goto CHECK_STATUS
if "%choice%"=="3" goto STOP_SERVER
if "%choice%"=="4" goto VIEW_LOGS
if "%choice%"=="0" goto EXIT
goto MENU

:START_SERVER
cls
echo ========================================================
echo             [1] Starting WhatsApp Server...
echo ========================================================
echo.

set "PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set "PID=%%a"
)

if not "%PID%"=="" (
    echo [INFO] WhatsApp Server is ALREADY RUNNING! (PID: %PID%)
    echo URL: http://localhost:3001
    echo.
    pause
    goto MENU
)

echo Starting WhatsApp server in background...
call npx pm2 restart whatsapp-server >nul 2>&1
if %errorlevel% neq 0 (
    call npx pm2 start start-whatsapp-server.js --name whatsapp-server >nul 2>&1
)
if %errorlevel% neq 0 (
    wscript //Nologo start-whatsapp-background.vbs
)

timeout /t 3 >nul

set "NEW_PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set "NEW_PID=%%a"
)

if not "%NEW_PID%"=="" (
    echo.
    echo ========================================================
    echo  [SUCCESS] WhatsApp Server is RUNNING in background!
    echo  - PID: %NEW_PID%
    echo  - URL: http://localhost:3001
    echo ========================================================
) else (
    echo.
    echo [INFO] Start command sent. Check status using Option (2).
)

echo.
pause
goto MENU

:CHECK_STATUS
cls
echo ========================================================
echo             [2] WhatsApp Server Status
echo ========================================================
echo.

set "PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set "PID=%%a"
)

if "%PID%"=="" (
    echo [STATUS] WhatsApp Server is STOPPED (NOT RUNNING).
) else (
    echo ========================================================
    echo  [STATUS] WhatsApp Server is RUNNING!
    echo  - PID: %PID%
    echo  - Port: 3001
    echo  - URL: http://localhost:3001
    echo ========================================================
)

echo.
pause
goto MENU

:STOP_SERVER
cls
echo ========================================================
echo             [3] Stopping WhatsApp Server...
echo ========================================================
echo.

set "PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set "PID=%%a"
)

call npx pm2 stop whatsapp-server >nul 2>&1
call npx pm2 delete whatsapp-server >nul 2>&1

if not "%PID%"=="" (
    taskkill /F /PID %PID% >nul 2>&1
)

echo [SUCCESS] WhatsApp Server stopped successfully.
echo.
pause
goto MENU

:VIEW_LOGS
cls
echo ========================================================
echo             [4] Server Logs (whatsapp-server.log)
echo ========================================================
echo.
if exist whatsapp-server.log (
    powershell -Command "Get-Content whatsapp-server.log -Tail 25"
) else (
    echo No log file found.
)
echo.
pause
goto MENU

:EXIT
exit /b 0
