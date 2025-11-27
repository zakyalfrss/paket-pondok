@echo off
title APP PAKET PONDOK
echo ===============================
echo   PAKET PONDOK MANAGEMENT SYSTEM
echo ===============================
echo.

cd /d %~dp0backend

echo 🔧 Checking Node.js...
node --version
if errorlevel 1 (
    echo ❌ Node.js not installed!
    echo 📥 Download from: https://nodejs.org
    pause
    exit
)

echo 📦 Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo 🗃️ Checking database...
node health-check.js
if errorlevel 1 (
    echo ❌ Database connection failed!
    echo 💡 Please check:
    echo   1. MySQL service is running
    echo   2. Database 'paket_pondok' exists
    echo   3. MySQL credentials in .env file
    pause
    exit
)

echo 🚀 Starting application...
node server.js