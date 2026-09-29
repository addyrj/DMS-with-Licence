@echo off
title DMS — Secure Database for Client
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0secure-db.ps1"
pause
