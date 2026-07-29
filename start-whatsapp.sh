#!/bin/bash

echo "========================================================="
echo "      AN-Academy - تشغيل خادم الواتساب المحلي"
echo "========================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[خطأ] لم يتم العثور على Node.js على هذا الجهاز!"
    echo "يرجى تحميل وتثبيت Node.js من: https://nodejs.org"
    exit 1
fi

# Navigate to whatsapp-server directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/whatsapp-server" || exit 1

# Check node_modules
if [ ! -d "node_modules" ]; then
    echo "[تنبيه] حزم خادم الواتساب غير مثبتة على هذا الجهاز."
    echo "جاري تثبيت الحزم المطلوبة..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[خطأ] فشل تثبيت المكتبات!"
        exit 1
    fi
    echo "[نجاح] تم تثبيت مكتبات خادم الواتساب بنجاح!"
    echo ""
fi

echo "========================================================="
echo " جاري بدء تشغيل خادم الواتساب على http://localhost:3001 ..."
echo "========================================================="
echo ""

node index.js
