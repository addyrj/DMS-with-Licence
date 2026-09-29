Set oWS = WScript.CreateObject("WScript.Shell")
Dim desktop
desktop = oWS.SpecialFolders("Desktop")
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' ── START shortcut ──────────────────────────────────────
Set oLink = oWS.CreateShortcut(desktop & "\DMS Start.lnk")
oLink.TargetPath = "powershell.exe"
oLink.Arguments = "-NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "setup-prod.ps1"""
oLink.WorkingDirectory = scriptDir
oLink.WindowStyle = 1
oLink.IconLocation = scriptDir & "icons\dms-start.ico"
oLink.Description = "Start DMS Digital Signage"
oLink.Save

' ── STOP shortcut ───────────────────────────────────────
Set oLink2 = oWS.CreateShortcut(desktop & "\DMS Stop.lnk")
oLink2.TargetPath = "powershell.exe"
oLink2.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command ""& {taskkill /f /im node.exe 2>$null; taskkill /f /im mosquitto.exe 2>$null; taskkill /f /im httpd.exe 2>$null; taskkill /f /im mysqld.exe 2>$null; Write-Host 'DMS Stopped.' -ForegroundColor Green; Start-Sleep 2}"""
oLink2.WorkingDirectory = scriptDir
oLink2.WindowStyle = 1
oLink2.IconLocation = scriptDir & "icons\dms-stop.ico"
oLink2.Description = "Stop DMS Digital Signage"
oLink2.Save

MsgBox "Desktop shortcuts created successfully!" & Chr(13) & Chr(13) & "You will now see on your Desktop:" & Chr(13) & "  - DMS Start" & Chr(13) & "  - DMS Stop", 64, "DMS Setup"
