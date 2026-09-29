@echo off
title DMS — License Status
color 0B
cls
echo.
echo ════════════════════════════════════════════════
echo   DMS — License Status Check
echo ════════════════════════════════════════════════
echo.

set "CHECK=%~dp0check-license.js"

where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo   Node.js not found. Run START.bat first.
    pause & exit /b 1
)

node "%CHECK%"

echo ────────────────────────────────────────────────
echo.
echo   To renew: run GET-MAC.bat and send output
echo   to IOTtech Smart Products Pvt. Ltd.
echo.
echo ════════════════════════════════════════════════
echo.
pause
