@echo off
title DMS — Get PC Info for License
color 0B
cls
echo.
echo ════════════════════════════════════════════════
echo   DMS — Get My PC Info for License
echo   IOTtech Smart Products Pvt. Ltd.
echo ════════════════════════════════════════════════
echo.
echo   Send ALL information below to IOTtech:
echo.
echo ────────────────────────────────────────────────

:: MAC Address (first active adapter)
echo   MAC Address:
for /f "tokens=1 delims= " %%a in ('getmac /fo table /nh ^| findstr /v "N/A" ^| findstr /v "Disconnected"') do (
    echo               %%a
    GOTO :GOT_MAC
)
:GOT_MAC

echo.

:: PC Name
echo   PC Name     : %COMPUTERNAME%

echo.

:: Windows UUID
echo   PC UUID:
for /f "tokens=2 delims==" %%a in ('wmic csproduct get UUID /value 2^>nul') do (
    if not "%%a"=="" echo               %%a
)

echo.
echo ────────────────────────────────────────────────
echo.
echo   Screenshot this window and send to IOTtech
echo   via WhatsApp or Email to get your license.key
echo.
echo   IOTtech Smart Products Pvt. Ltd.
echo.
echo ════════════════════════════════════════════════
echo.
pause
