@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { taskkill /f /im node.exe 2>$null; taskkill /f /im mosquitto.exe 2>$null; taskkill /f /im httpd.exe 2>$null; taskkill /f /im mysqld.exe 2>$null; net stop MySQL 2>$null; net stop mysql 2>$null; net stop Apache2.4 2>$null; net stop mosquitto 2>$null; Write-Host 'All DMS services stopped.' }"
pause
