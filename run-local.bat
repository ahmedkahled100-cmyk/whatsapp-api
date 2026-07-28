@echo off
chcp 65001 > nul
echo ===================================================
echo   تشغيل منصة AN-Academy وخادم الواتساب محلياً
echo ===================================================
echo.
echo 1. جاري تشغيل خادم الواتساب (WhatsApp Server على المنفذ 3001)...
start "WhatsApp Microservice" cmd /k "cd whatsapp-server && node index.js"

echo 2. جاري تشغيل موقع المنصة (Next.js على المنفذ 3000)...
start "AN-Academy Next.js" cmd /k "npm run dev"

echo.
echo ===================================================
echo  تم تشغيل الخدمات في نافذتين منفصلتين:
echo  - موقع المنصة:  http://localhost:3000
echo  - خادم الواتساب: http://localhost:3001
echo ===================================================
echo.
