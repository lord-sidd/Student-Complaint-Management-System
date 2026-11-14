@echo off
title Student Complaint Management System - SCMS (MERN Stack)
color 0b
echo ======================================================================
echo   Zeal College of Engineering & Technology
echo   Student Complaint Management System (SCMS) - MERN Stack
echo ======================================================================
echo.
echo [1/2] Navigating to project root directory...
cd /d "%~dp0"

echo [2/2] Opening application in your default browser...
start http://localhost:5000

echo.
echo ======================================================================
echo   Server is running on http://localhost:5000
echo   Press Ctrl + C in this window to stop the server anytime.
echo ======================================================================
echo.

node backend/server.js
if %errorlevel% neq 0 (
    echo.
    echo Server stopped or encountered an error.
    pause
)

