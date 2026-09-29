# DMS Production Mode
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ROOT     = (Get-Item "$PSScriptRoot\..").FullName
$BACKEND  = "$ROOT\backend"
$FRONTEND = "$ROOT\dms-frontend"

function Kill-Port($port) {
    $lines = netstat -ano | Select-String ":$port "
    foreach ($line in $lines) {
        $pid2 = ($line -split "\s+")[-1]
        if ($pid2 -match "^\d+$" -and [int]$pid2 -gt 0) {
            Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue
        }
    }
}

function Show-Status($msg) {
    $host.UI.RawUI.WindowTitle = "DMS - $msg"
    Write-Host "  >> $msg" -ForegroundColor Yellow
}

function Set-ShortcutRunAsAdmin($shortcutPath) {
    $bytes = [System.IO.File]::ReadAllBytes($shortcutPath)
    $bytes[21] = $bytes[21] -bor 0x20
    [System.IO.File]::WriteAllBytes($shortcutPath, $bytes)
}

function Create-Shortcuts {
    $startSC = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop", "DMS Start.lnk")
    $stopSC  = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop", "DMS Stop.lnk")
    $iconDir = "$PSScriptRoot\icons"
    $shell   = New-Object -ComObject WScript.Shell

    # Clean up old files
    Remove-Item "$PSScriptRoot\dms-launcher.vbs"      -Force -ErrorAction SilentlyContinue
    Remove-Item "$PSScriptRoot\dms-stop-launcher.vbs"  -Force -ErrorAction SilentlyContinue
    Remove-Item "$PSScriptRoot\dms-start-run.bat"      -Force -ErrorAction SilentlyContinue
    Remove-Item "$PSScriptRoot\dms-stop-run.bat"       -Force -ErrorAction SilentlyContinue
    Remove-Item "$PSScriptRoot\dms-stop.ps1"           -Force -ErrorAction SilentlyContinue

    # START shortcut points directly to powershell.exe with the ps1 file
    # WindowStyle 1 = Normal visible window ? client sees the progress
    $lnk = $shell.CreateShortcut($startSC)
    $lnk.TargetPath       = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    $lnk.Arguments        = "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\setup-prod.ps1`""
    $lnk.WorkingDirectory = $PSScriptRoot
    $lnk.WindowStyle      = 1
    $lnk.Description      = "Start DMS Digital Signage"
    if (Test-Path "$iconDir\dms-start.ico") { $lnk.IconLocation = "$iconDir\dms-start.ico" }
    $lnk.Save()
    Set-ShortcutRunAsAdmin $startSC

    # STOP shortcut points directly to powershell.exe with inline stop command
    # WindowStyle 1 = Normal visible window ? client sees what was stopped
    $stopCmd = "-NoProfile -ExecutionPolicy Bypass -Command `"& { " + `
        "Write-Host ''; " + `
        "Write-Host '  Stopping DMS...' -ForegroundColor Yellow; " + `
        "Write-Host ''; " + `
        "taskkill /f /im node.exe; " + `
        "taskkill /f /im mosquitto.exe; " + `
        "taskkill /f /im httpd.exe; " + `
        "taskkill /f /im mysqld.exe; " + `
        "Write-Host ''; " + `
        "Write-Host '  All DMS services stopped.' -ForegroundColor Green; " + `
        "Write-Host ''; " + `
        "Start-Sleep 3 }`""

    $lnk2 = $shell.CreateShortcut($stopSC)
    $lnk2.TargetPath       = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    $lnk2.Arguments        = $stopCmd
    $lnk2.WorkingDirectory = $PSScriptRoot
    $lnk2.WindowStyle      = 1
    $lnk2.Description      = "Stop DMS Digital Signage"
    if (Test-Path "$iconDir\dms-stop.ico") { $lnk2.IconLocation = "$iconDir\dms-stop.ico" }
    $lnk2.Save()
    Set-ShortcutRunAsAdmin $stopSC
}

function Wait-ForApp {
    $backendReady  = $false
    $frontendReady = $false
    for ($i = 1; $i -le 40; $i++) {
        Start-Sleep 3
        if (-not $backendReady) {
            try {
                Invoke-WebRequest -Uri "http://localhost:5004" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
                $backendReady = $true
            } catch {
                if ($_.Exception.Response -ne $null) { $backendReady = $true }
            }
        }
        if (-not $frontendReady) {
            try {
                Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
                $frontendReady = $true
            } catch {
                if ($_.Exception.Response -ne $null) { $frontendReady = $true }
            }
        }
        if ($backendReady -and $frontendReady) {
            Write-Host ""
            Write-Host "  [OK] DMS is ready!" -ForegroundColor Green
            Write-Host "  Opening browser now..." -ForegroundColor Cyan
            Start-Sleep 1
            Start-Process "http://localhost:3000"
            return
        }
        Write-Host "  Please wait... ($i/40)" -ForegroundColor Gray
    }
    Write-Host "  [WARN] Timeout - opening browser anyway" -ForegroundColor Yellow
    Start-Process "http://localhost:3000"
}

# ==========================================================
#  MAIN
# ==========================================================

$host.UI.RawUI.WindowTitle = "DMS - Please Wait..."
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DMS Digital Signage - Starting up" -ForegroundColor Cyan
Write-Host "  Please wait, do not close this window..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Admin check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $host.UI.RawUI.WindowTitle = "DMS ERROR"
    Write-Host "  [ERROR] Must run as Administrator." -ForegroundColor Red
    Write-Host "  Right-click the icon and choose Run as administrator." -ForegroundColor Yellow
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Administrator" -ForegroundColor Green

# Node check
try { node --version | Out-Null }
catch {
    $host.UI.RawUI.WindowTitle = "DMS ERROR"
    Write-Host "  [ERROR] Node.js not found. Run START.bat first." -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Node.js found" -ForegroundColor Green

# MySQL
Write-Host ""
Show-Status "Starting MySQL..."

Get-Process -Name mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 1
Remove-Item "C:\xampp\mysql\data\multi-master.info" -Force -ErrorAction SilentlyContinue
Get-ChildItem "C:\xampp\mysql\data\" -File |
    Where-Object { $_.Name -match "^(master-|relay-log-|mysql-relay-bin-)" } |
    Remove-Item -Force -ErrorAction SilentlyContinue

$startedViaSvc = $false
foreach ($svc in @("MYSQL80","mysql80","MySQL","mysql")) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        if ($s.Status -ne "Running") {
            Start-Service $svc -ErrorAction SilentlyContinue | Out-Null
            Start-Sleep 3
        }
        $s2 = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s2.Status -eq "Running") { $startedViaSvc = $true }
        break
    }
}

if (-not $startedViaSvc -and -not (Get-Process -Name mysqld -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\xampp\mysql\bin\mysqld.exe") {
        Set-Location "C:\xampp\mysql\bin"
        Start-Process "C:\xampp\mysql\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini" -WindowStyle Hidden
    }
}

$mysqlReady = $false
for ($i = 1; $i -le 10; $i++) {
    Start-Sleep 3
    $ping2 = & "C:\xampp\mysql\bin\mysqladmin.exe" -u root ping 2>$null
    if ($ping2 -match "alive") {
        $mysqlReady = $true
        break
    }
    Write-Host "  Waiting for MySQL... ($i/10)" -ForegroundColor Yellow
}

if (-not $mysqlReady) {
    $host.UI.RawUI.WindowTitle = "DMS ERROR - MySQL Failed"
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "  ERROR: MySQL did not start!" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "  1. Open C:\xampp\xampp-control.exe" -ForegroundColor White
    Write-Host "  2. Click START next to MySQL" -ForegroundColor White
    Write-Host "  3. Run DMS Start again" -ForegroundColor White
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [OK] MySQL is ready" -ForegroundColor Green

# Apache
Show-Status "Starting Apache..."
$apacheStarted = $false
foreach ($svc in @("Apache2.4","apache2.4","Apache","apache")) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        if ($s.Status -ne "Running") {
            Start-Service $svc -ErrorAction SilentlyContinue | Out-Null
            Start-Sleep 2
        }
        $s2 = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s2.Status -eq "Running") { $apacheStarted = $true }
        break
    }
}
if (-not $apacheStarted -and -not (Get-Process -Name httpd -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\xampp\apache\bin\httpd.exe") {
        Start-Process "C:\xampp\apache\bin\httpd.exe" -WindowStyle Hidden
        Start-Sleep 2
    }
}
if (Get-Process -Name httpd -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] Apache running" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Apache did not start - phpMyAdmin unavailable" -ForegroundColor Yellow
}

# Mosquitto
Show-Status "Starting Mosquitto MQTT..."
$env:Path += ";C:\Program Files\Mosquitto"
$mqttConf = "C:\Program Files\Mosquitto\mosquitto-dms.conf"
$mqttConfContent = "listener 1883 0.0.0.0`r`nprotocol mqtt`r`nallow_anonymous true`r`n`r`nlistener 9001 0.0.0.0`r`nprotocol websockets`r`nallow_anonymous true`r`n"
[System.IO.File]::WriteAllText($mqttConf, $mqttConfContent, [System.Text.Encoding]::ASCII)
Write-Host "  [OK] Mosquitto config written" -ForegroundColor Green

Stop-Process -Name mosquitto -Force -ErrorAction SilentlyContinue
Start-Sleep 1
$mqSvc = Get-Service -Name mosquitto -ErrorAction SilentlyContinue
if ($mqSvc) {
    Stop-Service mosquitto -Force -ErrorAction SilentlyContinue
    Set-Service mosquitto -StartupType Manual -ErrorAction SilentlyContinue
    Start-Sleep 1
    Stop-Process -Name mosquitto -Force -ErrorAction SilentlyContinue
}
Start-Process "C:\Program Files\Mosquitto\mosquitto.exe" -ArgumentList "-c `"$mqttConf`"" -WindowStyle Hidden
Start-Sleep 3

if (Get-Process -Name mosquitto -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] Mosquitto running (TCP:1883 WS:9001)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Mosquitto may not be running" -ForegroundColor Yellow
}

# Local IP
$localIP = "localhost"
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\." -and $_.IPAddress -notmatch "^172\." } |
        Select-Object -First 1).IPAddress
    if ($ip) { $localIP = $ip }
} catch { }

# Clear ports
Kill-Port 3000
Kill-Port 5004
Start-Sleep 1

# Frontend build
$needsBuild = -not (Test-Path "$FRONTEND\.next\BUILD_ID")
if ($needsBuild) {
    Show-Status "Building frontend (3 min)..."
    Set-Location $FRONTEND
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARN] Build failed, using dev mode" -ForegroundColor Yellow
        $useDev = $true
    } else {
        Write-Host "  [OK] Frontend built" -ForegroundColor Green
        $useDev = $false
    }
} else {
    Write-Host "  [OK] Frontend already built" -ForegroundColor Green
    $useDev = $false
}

# Desktop shortcuts
Create-Shortcuts
Write-Host "  [OK] Desktop shortcuts ready" -ForegroundColor Green

# Launch backend VISIBLE - see DB and MQTT logs
Show-Status "Launching DMS Backend..."
$backendCmd = "/k title DMS Backend :5004 && color 0B && cd /d `"$BACKEND`" && node server.js"
Start-Process "cmd.exe" -ArgumentList $backendCmd -WindowStyle Normal
Start-Sleep 2

# Launch frontend hidden
if ($useDev) {
    $frontendCmd = "/k title DMS Frontend DEV :3000 && color 0E && cd /d `"$FRONTEND`" && npm run dev"
} else {
    $frontendCmd = "/k title DMS Frontend PROD :3000 && color 0E && cd /d `"$FRONTEND`" && npm start"
}
Start-Process "cmd.exe" -ArgumentList $frontendCmd -WindowStyle Hidden

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Please wait - DMS is loading..." -ForegroundColor Yellow
Write-Host "  Browser opens automatically when ready." -ForegroundColor White
Write-Host "  Check blue Backend window for DB/MQTT logs." -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Wait-ForApp

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  DMS is running!" -ForegroundColor Green
Write-Host "  Admin  : http://localhost:3000" -ForegroundColor White
Write-Host "  Network: http://${localIP}:3000" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
$host.UI.RawUI.WindowTitle = "DMS Running - closing in 5s"
Start-Sleep 5
exit 0