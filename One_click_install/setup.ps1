# DMS Digital Signage - Setup and Launcher
# IOTtech Smart Products Pvt. Ltd.
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ROOT     = (Get-Item "$PSScriptRoot\..").FullName
$BACKEND  = "$ROOT\backend"
$FRONTEND = "$ROOT\dms-frontend"
$LOG_DIR  = "$PSScriptRoot\logs"
$LOG      = "$LOG_DIR\install_$(Get-Date -Format 'yyyyMMdd_HHmm').log"
if (!(Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

function Log($m)  { Add-Content $LOG "$(Get-Date -Format 'HH:mm:ss') $m" }
function OK($m)   { Write-Host "    [OK] $m" -ForegroundColor Green;   Log "OK: $m" }
function WARN($m) { Write-Host "    [WARN] $m" -ForegroundColor Yellow; Log "WARN: $m" }
function ERR($m)  { Write-Host "    [ERROR] $m" -ForegroundColor Red;   Log "ERROR: $m" }
function Step($n,$t,$m) {
    Write-Host ""
    Write-Host "[$n/$t] $m" -ForegroundColor Cyan
    Log "=== STEP $n of $t : $m ==="
}
function Kill-Port($port) {
    $lines = netstat -ano | Select-String ":$port "
    foreach ($line in $lines) {
        $pid2 = ($line -split "\s+")[-1]
        if ($pid2 -match "^\d+$" -and [int]$pid2 -gt 0) {
            Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue
        }
    }
}
function Download($url,$dest,$label) {
    Write-Host "    Downloading $label..." -NoNewline
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
        Write-Host " Done" -ForegroundColor Green
        Log "Downloaded: $label"
        return $true
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Log "Download failed: $_"
        return $false
    }
}
function Start-MySQL-DB {
    foreach ($svc in @("MYSQL80","mysql80","MySQL","mysql")) {
        $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s) {
            if ($s.Status -ne "Running") {
                Start-Service $svc -ErrorAction SilentlyContinue | Out-Null
                Start-Sleep 3
            }
            $s2 = Get-Service -Name $svc -ErrorAction SilentlyContinue
            if ($s2.Status -eq "Running") { Log "MySQL service running: $svc"; return $true }
        }
    }
    if (Test-Path "C:\xampp\mysql\bin\mysqld.exe") {
        Write-Host "    Starting mysqld.exe directly..."
        Start-Process "C:\xampp\mysql\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini" -WindowStyle Hidden
        Start-Sleep 4
        Log "mysqld.exe started directly"
        return $true
    }
    return $false
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DMS Digital Signage - IOTtech Smart Products" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Log: $LOG"
Write-Host ""
Log "DMS Installer started $(Get-Date)"

# Admin check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) { ERR "Run as Administrator (right-click START.bat)"; Read-Host; exit 1 }
OK "Running as Administrator"

# Internet
Write-Host "Checking internet connection..." -NoNewline
try {
    Invoke-WebRequest -Uri "https://nodejs.org" -UseBasicParsing -TimeoutSec 10 | Out-Null
    Write-Host " OK" -ForegroundColor Green; Log "Internet: OK"
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    ERR "No internet connection. Please connect and retry."
    Read-Host; exit 1
}

# STEP 0: License check (deferred - check-license.js needs Node.js, which
# doesn't exist yet on a blank PC. Real gate runs right after Step 1, and
# the backend itself re-enforces this on every launch regardless.)
Step 0 7 "License check"
Write-Host "    Will verify once Node.js is available (next step)" -ForegroundColor Yellow
Log "License: deferred to post-Node.js check"

# STEP 1: Node.js
Step 1 7 "Checking Node.js"
$nodeOK = $false
try {
    $nv = node -e "process.stdout.write(String(process.versions.node.split('.')[0]))" 2>$null
    if ([int]$nv -ge 18) { $nodeOK = $true; OK "Node.js v$nv already installed" }
    else { WARN "Node.js v$nv is too old, upgrading" }
} catch { WARN "Node.js not found" }

if (!$nodeOK) {
    $msi = "$env:TEMP\node-lts.msi"
    if (!(Download "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" $msi "Node.js 20 LTS")) {
        ERR "Node.js download failed"; Read-Host; exit 1
    }
    Write-Host "    Installing Node.js (please wait)..."
    Start-Process msiexec -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    OK "Node.js installed"
}
try { $v = node --version 2>$null; OK "node $v confirmed" }
catch { ERR "Node.js not found after install. See $LOG"; Read-Host; exit 1 }

$licenseCheckPath = "$ROOT\app_segura\cliente\check-license.js"
if (Test-Path $licenseCheckPath) {
    Write-Host "    Verifying license..." -NoNewline
    $licOutput = node $licenseCheckPath 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        $licOutput | ForEach-Object { Log "License: $_" }
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        $licOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor Red; Log "License: $_" }
        ERR "Invalid license - install stopped before downloading XAMPP/Mosquitto"
        Read-Host; exit 1
    }
} else {
    WARN "app_segura\cliente\check-license.js not found - skipping (folder may be incomplete)"
}

# STEP 2: XAMPP + MySQL
Step 2 7 "Checking MySQL (XAMPP)"
if (!(Test-Path "C:\xampp\mysql\bin\mysqld.exe")) {
    $exe = "$env:TEMP\xampp-installer.exe"
    if (!(Download "https://sourceforge.net/projects/xampp/files/XAMPP%20Windows/8.2.12/xampp-windows-x64-8.2.12-0-VS16-installer.exe/download" $exe "XAMPP (~160MB)")) {
        ERR "XAMPP download failed"; Read-Host; exit 1
    }
    Write-Host "    Installing XAMPP (2-3 minutes)..."
    Start-Process $exe -ArgumentList "--mode unattended --unattendedmodeui none" -Wait
    if (!(Test-Path "C:\xampp\mysql\bin\mysqld.exe")) { ERR "XAMPP install failed"; Read-Host; exit 1 }
    OK "XAMPP installed"
} else { OK "XAMPP already installed" }

Write-Host "    Starting MySQL..."
Start-MySQL-DB | Out-Null

$mysqlConfirmed = $false
for ($i = 1; $i -le 10; $i++) {
    $ping = "C:\xampp\mysql\bin\mysqladmin.exe"
    $result = & $ping -u root ping 2>$null
    if ($result -match "alive") { $mysqlConfirmed = $true; break }
    Write-Host "    Waiting for MySQL... ($i/10)"
    Start-Sleep 3
}
if ($mysqlConfirmed) { OK "MySQL running" }
else {
    WARN "MySQL not responding. Opening XAMPP Control Panel..."
    Start-Process "C:\xampp\xampp-control.exe"
    Read-Host "Start MySQL in XAMPP then press Enter"
}

# Apache (XAMPP's unattended installer does NOT register it as a Windows
# service, so try services first, then fall back to launching httpd.exe
# directly - same pattern as Start-MySQL-DB above)
$apacheStarted = $false
foreach ($svc in @("Apache2.4","apache2.4","Apache","apache")) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        if ($s.Status -ne "Running") { Start-Service $svc -ErrorAction SilentlyContinue | Out-Null; Start-Sleep 2 }
        $s2 = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s2.Status -eq "Running") { $apacheStarted = $true }
        break
    }
}
if (!$apacheStarted -and !(Get-Process -Name httpd -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\xampp\apache\bin\httpd.exe") {
        Start-Process "C:\xampp\apache\bin\httpd.exe" -WindowStyle Hidden
        Start-Sleep 2
    }
}
if (Get-Process -Name httpd -ErrorAction SilentlyContinue) { OK "Apache running - phpMyAdmin: http://localhost/phpmyadmin" }
else { WARN "Apache did not start - phpMyAdmin unavailable. Open C:\xampp\xampp-control.exe and start Apache manually." }

# STEP 3: Mosquitto
Step 3 7 "Checking Mosquitto MQTT"
$mqttExe = "C:\Program Files\Mosquitto\mosquitto.exe"
if (!(Test-Path $mqttExe)) {
    $setup = "$env:TEMP\mosquitto-setup.exe"
    if (!(Download "https://mosquitto.org/files/binary/win64/mosquitto-2.0.18-install-windows-x64.exe" $setup "Mosquitto MQTT")) {
        ERR "Mosquitto download failed"; Read-Host; exit 1
    }
    Start-Process $setup -ArgumentList "/S" -Wait
    Start-Sleep 2
    if (!(Test-Path $mqttExe)) { ERR "Mosquitto install failed"; Read-Host; exit 1 }
    OK "Mosquitto installed"
} else { OK "Mosquitto already installed" }

$env:Path += ";C:\Program Files\Mosquitto"
$mqttConf = "C:\Program Files\Mosquitto\mosquitto-dms.conf"
$confTxt = "listener 1883 0.0.0.0`r`nprotocol mqtt`r`nallow_anonymous true`r`n`r`nlistener 9001 0.0.0.0`r`nprotocol websockets`r`nallow_anonymous true`r`n"
[System.IO.File]::WriteAllText($mqttConf, $confTxt, [System.Text.Encoding]::ASCII)

# The Mosquitto installer auto-registers + starts a Windows service pointed
# at its OWN default mosquitto.conf (no anonymous access, no websocket
# listener) - that service must never be left running, or it silently wins
# over our custom mosquitto-dms.conf. Always stop/disable the service and
# launch mosquitto.exe directly with -c mosquitto-dms.conf instead.
Stop-Process -Name mosquitto -Force -ErrorAction SilentlyContinue
Start-Sleep 1
$mqSvc = Get-Service -Name mosquitto -ErrorAction SilentlyContinue
if ($mqSvc) {
    Stop-Service mosquitto -Force -ErrorAction SilentlyContinue
    Set-Service mosquitto -StartupType Manual -ErrorAction SilentlyContinue
    Start-Sleep 1
    Stop-Process -Name mosquitto -Force -ErrorAction SilentlyContinue
}
Start-Process $mqttExe -ArgumentList "-c `"$mqttConf`"" -WindowStyle Hidden
Start-Sleep 2

if (Get-Process -Name mosquitto -ErrorAction SilentlyContinue) { OK "MQTT running TCP:1883 WS:9001" }
else { WARN "Mosquitto may not be running" }

# STEP 4: Config
Step 4 7 "Checking config files"
$localIP = "localhost"
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\." -and $_.IPAddress -notmatch "^172\." } |
        Select-Object -First 1).IPAddress
    if ($ip) { $localIP = $ip }
} catch { }
Write-Host "    Local IP: $localIP"

if (!(Test-Path "$BACKEND\.env")) {
    $jwtSecret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) -replace '[^a-zA-Z0-9]', ''
    Set-Content "$BACKEND\.env" @"
PORT=5004
NODE_ENV=production

JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d

SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=super123
SUPERADMIN_EMAIL=sopoffline@iottechsmart.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=master_db

MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_WS_PORT=9001
MQTT_USERNAME=
MQTT_PASSWORD=

BASE_URL=http://${localIP}:5004
UPLOAD_DIR=./uploads
TVFILE_DIR=./tvfiles
CORS_ORIGIN=*

RAZORPAY_KEY_ID=rzp_test_REPLACE_ME
RAZORPAY_KEY_SECRET=REPLACE_ME

SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=sopoffline@iottechsmart.com
"@
    OK "backend .env created (login: superadmin / super123 - change after first login)"
} else { OK "backend .env exists" }

if (!(Test-Path "$FRONTEND\.env.local")) {
    Set-Content "$FRONTEND\.env.local" @"
NEXT_PUBLIC_API_URL=http://${localIP}:5004
"@
    OK "frontend .env.local created"
} else { OK "frontend .env.local exists" }

# STEP 5: npm install
Step 5 7 "Installing npm packages"
if (!(Test-Path "$BACKEND\node_modules")) {
    Write-Host "    Installing backend packages (~2 min)..."
    Set-Location $BACKEND
    npm install 2>&1 | Add-Content $LOG
    if ($LASTEXITCODE -ne 0) { ERR "Backend npm install failed. See $LOG"; Read-Host; exit 1 }
    OK "Backend packages installed"
} else { OK "Backend packages OK" }

if (!(Test-Path "$FRONTEND\node_modules")) {
    Write-Host "    Installing frontend packages (~3 min)..."
    Set-Location $FRONTEND
    npm install 2>&1 | Add-Content $LOG
    if ($LASTEXITCODE -ne 0) { ERR "Frontend npm install failed. See $LOG"; Read-Host; exit 1 }
    OK "Frontend packages installed"
} else { OK "Frontend packages OK" }

# STEP 6: Database
Step 6 7 "Setting up database"
if (!(Test-Path "$BACKEND\.seeded")) {
    Write-Host "    Seeding database (first run)..."
    Set-Location $BACKEND
    node src/database/seeders/seed_superadmin.js 2>&1 | Add-Content $LOG
    if ($LASTEXITCODE -eq 0) {
        Set-Content "$BACKEND\.seeded" ""
        OK "Database seeded"
    } else {
        WARN "Seed may have failed. Check $LOG"
    }
} else { OK "Database already seeded" }

# STEP 7: Launch
Step 7 7 "Launching DMS"

Write-Host "    Clearing ports 3000 and 5004..."
Kill-Port 3000
Kill-Port 5004
Start-Sleep 1

# Open browser after 8s
Start-Job -ScriptBlock { Start-Sleep 8; Start-Process "http://localhost:3000" } | Out-Null

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  DMS IS RUNNING!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Admin Panel : http://localhost:3000" -ForegroundColor White
Write-Host "  Network     : http://${localIP}:3000" -ForegroundColor White
Write-Host "  Backend API : http://localhost:5004" -ForegroundColor White
Write-Host "  phpMyAdmin  : http://localhost/phpmyadmin" -ForegroundColor White
Write-Host "  MQTT TCP    : mqtt://localhost:1883" -ForegroundColor White
Write-Host "  MQTT WS     : ws://localhost:9001" -ForegroundColor White
Write-Host ""
Write-Host "  TV App Settings:" -ForegroundColor Yellow
Write-Host "  LOCAL_API_URL=http://${localIP}:5004" -ForegroundColor Yellow
Write-Host "  LOCAL_MQTT_HOST=${localIP}" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Launch backend in new window
$backendCmd = "/k title DMS Backend :5004 && color 0B && cd /d `"$BACKEND`" && node server.js"
Start-Process "cmd.exe" -ArgumentList $backendCmd
Start-Sleep 2

# Launch frontend in new window (dev mode)
$frontendCmd = "/k title DMS Frontend :3000 && color 0E && cd /d `"$FRONTEND`" && npm run dev"
Start-Process "cmd.exe" -ArgumentList $frontendCmd

Log "DMS launched OK $(Get-Date)"
Write-Host "    Servers launched. Browser opens in 8 seconds." -ForegroundColor Cyan
Write-Host "    You can close this window." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close"
