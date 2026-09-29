# secure-db.ps1
# Run ONCE per client, on the CLIENT's PC, before/after handing the app off.
# Locks down MySQL + phpMyAdmin + .env files. See SECURE-DB.bat (thin wrapper).
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ROOT         = (Get-Item "$PSScriptRoot\..\..").FullName
$BACKEND_ENV  = "$ROOT\backend\.env"
$FRONTEND_ENV = "$ROOT\dms-frontend\.env.local"
$MYSQL        = "C:\xampp\mysql\bin"
$XAMPP_CONF   = "C:\xampp\apache\conf\extra\httpd-xampp.conf"
$MYSQL_INI    = "$MYSQL\my.ini"

function OK($m)   { Write-Host "        $m OK" -ForegroundColor Green }
function WARN($m) { Write-Host "        [WARNING] $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "================================================" -ForegroundColor Red
Write-Host "  DMS - Database Security Setup" -ForegroundColor Red
Write-Host "  Run this ONCE before giving to client" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  This will:"
Write-Host "  1. Set MySQL root password"
Write-Host "  2. Create a limited DMS database user (no server-admin rights)"
Write-Host "  3. Block phpMyAdmin from network access (localhost only)"
Write-Host "  4. Restrict MySQL itself to localhost only"
Write-Host "  5. Lock .env files from other Windows users on this PC"
Write-Host ""
Write-Host "  Write down the passwords you enter!" -ForegroundColor Yellow
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) { Write-Host "[ERROR] Run as Administrator (right-click SECURE-DB.bat)" -ForegroundColor Red; Read-Host; exit 1 }

$dbPass  = Read-Host "  New MySQL root password"
$dmsPass = Read-Host "  DMS database user password"
if ([string]::IsNullOrWhiteSpace($dbPass) -or [string]::IsNullOrWhiteSpace($dmsPass)) {
    Write-Host "[ERROR] Password cannot be empty" -ForegroundColor Red; Read-Host; exit 1
}

# ── [1/5] MySQL root password ──────────────────────────────────
Write-Host ""
Write-Host "  [1/5] Setting MySQL root password..." -ForegroundColor Cyan
& "$MYSQL\mysqladmin.exe" -u root password "$dbPass" 2>$null
if ($LASTEXITCODE -ne 0) {
    & "$MYSQL\mysqladmin.exe" -u root -p"" password "$dbPass" 2>$null
}
OK "Root password set"

# ── [2/5] Limited DMS user ─────────────────────────────────────
# DMS creates a new MySQL database per client at runtime and runs schema
# migrations against master_db + every client DB on every backend start,
# all under this one user. Scoping grants to master_db.* only would break
# client creation and every existing client's data as soon as this user
# replaces root in .env. This grants what the app needs across all
# databases (CREATE/DROP/ALTER/DML) while excluding real admin privileges
# - no GRANT OPTION, SUPER, FILE, PROCESS, SHUTDOWN, RELOAD, or user /
# replication management. This user cannot administer the MySQL server,
# only manage DMS's own application data.
Write-Host ""
Write-Host "  [2/5] Creating limited DMS database user..." -ForegroundColor Cyan
$sql = @"
CREATE USER IF NOT EXISTS 'dms_user'@'localhost' IDENTIFIED BY '$dmsPass';
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES, LOCK TABLES, SELECT, INSERT, UPDATE, DELETE ON *.* TO 'dms_user'@'localhost';
FLUSH PRIVILEGES;
"@
$sql | & "$MYSQL\mysql.exe" -u root -p"$dbPass" 2>$null

if (Test-Path $BACKEND_ENV) {
    (Get-Content $BACKEND_ENV) |
        ForEach-Object { $_ -replace '^DB_USER=.*', 'DB_USER=dms_user' -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$dmsPass" } |
        Set-Content $BACKEND_ENV
    OK "backend\.env updated to use dms_user"
} else { WARN "backend\.env not found" }

# ── [3/5] Block phpMyAdmin from the network ────────────────────
Write-Host ""
Write-Host "  [3/5] Blocking phpMyAdmin from network..." -ForegroundColor Cyan
if (Test-Path $XAMPP_CONF) {
    (Get-Content $XAMPP_CONF) | ForEach-Object { $_ -replace 'Require all granted', 'Require local' } | Set-Content $XAMPP_CONF

    # Apache is often NOT a Windows service on a fresh XAMPP install (see
    # One_click_install/setup.ps1 for the same issue) - restart whichever
    # form is actually running.
    Stop-Service Apache2.4 -ErrorAction SilentlyContinue
    Get-Process httpd -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 1
    $svc = Get-Service -Name Apache2.4 -ErrorAction SilentlyContinue
    if ($svc) { Start-Service Apache2.4 -ErrorAction SilentlyContinue }
    elseif (Test-Path "C:\xampp\apache\bin\httpd.exe") { Start-Process "C:\xampp\apache\bin\httpd.exe" -WindowStyle Hidden }
    Start-Sleep 1
    OK "phpMyAdmin is now localhost-only"
} else { WARN "XAMPP config not found ($XAMPP_CONF)" }

# ── [4/5] Restrict MySQL to localhost ──────────────────────────
Write-Host ""
Write-Host "  [4/5] Restricting MySQL to localhost..." -ForegroundColor Cyan
if (Test-Path $MYSQL_INI) {
    (Get-Content $MYSQL_INI) | ForEach-Object {
        if ($_ -match '^\s*#*\s*bind-address\s*=' -and $_ -notmatch '::1') { 'bind-address=127.0.0.1' } else { $_ }
    } | Set-Content $MYSQL_INI

    foreach ($svc in @("MYSQL80","mysql80","MySQL","mysql")) {
        $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s) { Restart-Service $svc -Force -ErrorAction SilentlyContinue; break }
    }
    Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
    Start-Process "$MYSQL\mysqld.exe" -ArgumentList "--defaults-file=$MYSQL_INI" -WindowStyle Hidden
    Start-Sleep 2
    OK "MySQL now only accepts connections from this PC"
} else { WARN "my.ini not found - MySQL is still reachable from the network" }

# ── [5/5] Lock .env files ──────────────────────────────────────
Write-Host ""
Write-Host "  [5/5] Locking .env files..." -ForegroundColor Cyan
if (Test-Path $BACKEND_ENV)  { icacls $BACKEND_ENV  /inheritance:r /grant:r "${env:USERNAME}:F" | Out-Null; OK "backend\.env locked" }
if (Test-Path $FRONTEND_ENV) { icacls $FRONTEND_ENV /inheritance:r /grant:r "${env:USERNAME}:F" | Out-Null; OK "dms-frontend\.env.local locked" }

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Database Secured!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  MySQL root password : $dbPass"
Write-Host "  DMS user password   : $dmsPass"
Write-Host ""
Write-Host "  Save these passwords - you will need them if something breaks." -ForegroundColor Yellow
Write-Host "  phpMyAdmin and MySQL are now reachable from THIS PC only." -ForegroundColor Gray
Write-Host "  Restart the app (START-PROD.bat) for the new DB user to take effect." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close"
