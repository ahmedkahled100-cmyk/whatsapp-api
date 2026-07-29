#!/bin/bash
echo "========================================================="
echo "   AN-Academy - WhatsApp Server for Android (Termux)"
echo "========================================================="
echo ""

pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts chromium git

export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)

npm install

echo ""
echo "========================================================="
echo " Starting WhatsApp Server on Port 3001..."
echo "========================================================="
echo ""

node index.js
