PS C:\Users\Dell\Desktop\dms\dms> ls


    Directory: C:\Users\Dell\Desktop\dms\dms


Mode                 LastWriteTime         Length Name                                                                
----                 -------------         ------ ----                                                                
d-----         8/20/2026   5:56 PM                app_segura                                                          
d-----         9/15/2026  11:35 AM                backend                                                             
d-----         9/15/2026  11:01 PM                dms-frontend                                                        
d-----         8/20/2026   5:16 PM                One_click_install                                                   
------         7/16/2026  12:20 PM          14340 .DS_Store                                                           
-a----         9/15/2026  11:02 PM           8607 allsoftware.md                                                      
------         8/17/2026   3:10 PM            601 emp-dash-check.js                                                   
------          8/5/2026  11:20 PM          11507 issue.md                                                            
------         8/14/2026   5:00 PM          23503 motherson.md                                                        
------          7/8/2026  12:01 AM            536 mqttsetup.md                                                        


PS C:\Users\Dell\Desktop\dms\dms> 

PS C:\Users\Dell\Desktop\dms\dms> cd app_segura
PS C:\Users\Dell\Desktop\dms\dms\app_segura> ls


    Directory: C:\Users\Dell\Desktop\dms\dms\app_segura


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----         8/19/2026   5:19 PM                cliente
d-----         9/15/2026   9:53 PM                mi_computadora
------         6/29/2026  11:40 PM           8196 .DS_Store                                                           
-a----         8/20/2026   5:56 PM          23455 MASTER-GUIDE.md


PS C:\Users\Dell\Desktop\dms\dms\app_segura> 


    Directory: C:\Users\Dell\Desktop\dms\dms\backend


Mode                 LastWriteTime         Length Name                                                                
----                 -------------         ------ ----                                                                
d-----         8/18/2026   5:24 PM                node_modules                                                        
d-----         8/18/2026   5:09 PM                scripts                                                             
d-----         8/19/2026   5:18 PM                src                                                                 
d-----         9/15/2026  10:21 PM                tvfiles                                                             
d-----         9/15/2026  10:21 PM                uploads                                                             
------         7/30/2026   1:37 PM          16388 .DS_Store                                                           
------         7/30/2026   5:23 PM           4951 .env                                                                
------         5/31/2026   6:16 AM             48 .gitignore                                                          
-a----         9/15/2026  11:35 AM              2 .seeded                                                             
------          6/3/2026  11:33 AM          10519 folderstr.md                                                        
------         7/19/2026  11:32 AM           4842 local.env                                                           
-a----         8/18/2026   5:24 PM         104481 package-lock.json                                                   
------         7/19/2026   1:30 AM            890 package.json                                                        
------         7/29/2026  11:13 PM           5398 scripts.zip                                                         
-a----         8/20/2026   5:15 PM           2666 server.js                                                           
------         7/24/2026  11:28 AM           3446 server.md                                                           


PS C:\Users\Dell\Desktop\dms\dms\backend> 
PS C:\Users\Dell\Desktop\dms\dms\app_segura> cd mi_computadora
PS C:\Users\Dell\Desktop\dms\dms\app_segura\mi_computadora> ls


    Directory: C:\Users\Dell\Desktop\dms\dms\app_segura\mi_computadora


Mode                 LastWriteTime         Length Name                                                                
----                 -------------         ------ ----                                                                
------         6/29/2026  11:38 PM           4799 generate-license.js                                                 
-a----         9/15/2026   5:18 PM            142 license_Ambrane_india_pvt.ltd_2026-09-15.key                        
-a----         9/15/2026   9:53 PM            129 license_iot_tech_2026-09-15.key                                     
-a----         9/15/2026   1:44 PM            133 license_unshankar_ji_2026-09-15.key                                 
-a----         8/20/2026   5:54 PM            148 SECURE-DB.bat                                                       
-a----         8/20/2026   5:54 PM           7215 secure-db.ps1                                                       


PS C:\Users\Dell\Desktop\dms\dms\app_segura\mi_computadora> 







// check-license.js
// Lives at: dms/app_segura/cliente/check-license.js
// CLI wrapper around license.js — run standalone to see a human-readable
// license status. The backend now enforces this itself at startup and on
// an interval (see backend/src/config/license.js), so this file is mainly
// for manual checks / troubleshooting on the client PC.

import { validateLicense } from './license.js';

console.log('');

const result = validateLicense();

if (!result.valid) {
  switch (result.reason) {
    case 'LICENSE_NOT_FOUND':
      console.error('  ❌  LICENSE NOT FOUND');
      console.error('      Place license.key in app_segura/cliente/ folder.');
      break;
    case 'LICENSE_CORRUPTED':
      console.error('  ❌  LICENSE FILE CORRUPTED');
      break;
    case 'MAC_UNREADABLE':
      console.error('  ❌  Cannot read MAC address.');
      break;
    case 'WRONG_MACHINE':
      console.error('  ❌  LICENSE INVALID — Wrong Machine');
      console.error(`      Licensed for : ${result.detail.licensed}`);
      console.error(`      This machine : ${result.detail.actual}`);
      break;
    case 'EXPIRED':
      console.error('  ❌  LICENSE EXPIRED');
      console.error(`      Expired on : ${result.detail.expiry}`);
      break;
    case 'TAMPERED':
      console.error('  ❌  LICENSE TAMPERED — Key is invalid');
      break;
    case 'DISPLAY_LIMIT_EXCEEDED':
      console.error('  ❌  DISPLAY LIMIT EXCEEDED');
      console.error(`      Licensed for : ${result.detail.maxDisplays} displays`);
      console.error(`      Currently    : ${result.detail.displayCount} displays active`);
      break;
    default:
      console.error(`  ❌  LICENSE INVALID (${result.reason})`);
  }
  console.error('      Contact: IOTtech Smart Products Pvt. Ltd.');
  console.error('');
  process.exit(1);
}

const { client, expiry, daysLeft, maxDisplays, displayCount } = result.info;
const displayInfo = displayCount >= 0 ? `${displayCount} used / ${maxDisplays} allowed` : `max ${maxDisplays} allowed`;

console.log('  ✅  License Valid');
console.log(`      Client   : ${client}`);
console.log(`      Expires  : ${expiry} (${daysLeft} days left)`);
console.log(`      Displays : ${displayInfo}`);
console.log('');
process.exit(0);




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




// license.js
// Shared license validation logic — used by check-license.js (CLI) AND
// backend/server.js (runtime enforcement). Never call process.exit() here;
// callers decide what to do with the result.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── MUST MATCH generate-license.js exactly ───────────────
const SECRET = 'DMS_IOTTECH_SALT_2024_PRIVATE_KEEP_SAFE';

// license.key sits next to this file in app_segura/cliente/
const LICENSE_FILE = path.join(__dirname, 'license.key');

// backend/.env is at dms/backend/.env — __dirname = dms/app_segura/cliente/
const DB_ENV_FILE = path.join(__dirname, '..', '..', 'backend', '.env');

const readEnv = (file) => {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
      .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
  );
};

const getDisplayCount = () => {
  try {
    const env  = readEnv(DB_ENV_FILE);
    const host = env.DB_HOST || 'localhost';
    const port = env.DB_PORT || '3306';
    const user = env.DB_USER || 'root';
    const pass = env.DB_PASSWORD || '';
    const db   = env.DB_NAME || 'master_db';
    const passArg = pass ? `-p${pass}` : '';
    const cmd = `C:\\xampp\\mysql\\bin\\mysql.exe -h${host} -P${port} -u${user} ${passArg} -s -N -e "SELECT COUNT(*) FROM displays WHERE is_active=1;" ${db}`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
    return parseInt(result) || 0;
  } catch {
    return -1; // DB not ready — skip display check
  }
};

const getMAC = () => {
  try {
    const out = execSync('getmac /fo list', { encoding: 'utf8', timeout: 5000 });
    const match = out.match(/Physical Address[:\s]+([A-Fa-f0-9]{2}[-][A-Fa-f0-9]{2}[-][A-Fa-f0-9]{2}[-][A-Fa-f0-9]{2}[-][A-Fa-f0-9]{2}[-][A-Fa-f0-9]{2})/);
    if (match) return match[1].toUpperCase();
    return null;
  } catch { return null; }
};

// ─────────────────────────────────────────────────────────
// validateLicense() — pure function, no process.exit, no console output.
// Returns { valid: true, info } or { valid: false, reason, detail }
// ─────────────────────────────────────────────────────────
export const validateLicense = () => {
  if (!fs.existsSync(LICENSE_FILE)) {
    return { valid: false, reason: 'LICENSE_NOT_FOUND' };
  }

  const lines = fs.readFileSync(LICENSE_FILE, 'utf8').trim().split('\n');
  const lic = {};
  lines.forEach(l => {
    const eq = l.indexOf('=');
    if (eq > -1) lic[l.substring(0, eq).trim()] = l.substring(eq + 1).trim();
  });

  const { CLIENT, MAC, MAX_DISPLAYS, EXPIRY, KEY } = lic;

  if (!CLIENT || !MAC || !MAX_DISPLAYS || !EXPIRY || !KEY) {
    return { valid: false, reason: 'LICENSE_CORRUPTED' };
  }

  const realMAC = getMAC();
  if (!realMAC) {
    return { valid: false, reason: 'MAC_UNREADABLE' };
  }
  if (realMAC !== MAC) {
    return { valid: false, reason: 'WRONG_MACHINE', detail: { licensed: MAC, actual: realMAC } };
  }

  const today = new Date().toISOString().split('T')[0];
  if (today > EXPIRY) {
    return { valid: false, reason: 'EXPIRED', detail: { expiry: EXPIRY } };
  }

  const expectedKey = crypto
    .createHmac('sha256', SECRET)
    .update(`${MAC}|${EXPIRY}|${MAX_DISPLAYS}|${SECRET}`)
    .digest('hex')
    .toUpperCase()
    .substring(0, 32)
    .match(/.{1,8}/g).join('-');

  if (expectedKey !== KEY) {
    return { valid: false, reason: 'TAMPERED' };
  }

  const displayCount = getDisplayCount();
  if (displayCount >= 0 && displayCount > parseInt(MAX_DISPLAYS)) {
    return {
      valid: false,
      reason: 'DISPLAY_LIMIT_EXCEEDED',
      detail: { maxDisplays: parseInt(MAX_DISPLAYS), displayCount },
    };
  }

  const daysLeft = Math.ceil((new Date(EXPIRY) - new Date()) / 86400000);
  return {
    valid: true,
    info: {
      client: CLIENT,
      expiry: EXPIRY,
      daysLeft,
      maxDisplays: parseInt(MAX_DISPLAYS),
      displayCount, // -1 means DB wasn't ready yet, not counted
    },
  };
};



// generate-license.js
// Location: dms/app_segura/mi_computadora/generate-license.js
// ⚠️  KEEP ON YOUR MAC ONLY — NEVER SEND TO CLIENT
// Run: node generate-license.js

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── YOUR SECRET — NEVER CHANGE, NEVER SHARE ──────────────
const SECRET = 'DMS_IOTTECH_SALT_2024_PRIVATE_KEEP_SAFE';

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

(async () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   DMS License Key Generator                      ║');
  console.log('║   IOTtech Smart Products Pvt. Ltd.               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const mac         = (await ask('  Client MAC Address   (from GET-MAC.bat output) : ')).trim().toUpperCase().replace(/:/g, '-');
  const clientName  = (await ask('  Client Name          (e.g. Jio_Mumbai)         : ')).trim().replace(/\s+/g, '_');
  const maxDisplays = (await ask('  Max Displays allowed  (e.g. 5)                 : ')).trim();
  const days        = (await ask('  License valid days    (e.g. 365 for 1 year)    : ')).trim();
  rl.close();

  // Validate MAC format
  if (!/^([A-F0-9]{2}-){5}[A-F0-9]{2}$/.test(mac)) {
    console.error('\n  ❌  Invalid MAC format. Should be: A1-B2-C3-D4-E5-F6\n');
    process.exit(1);
  }

  const issued = new Date().toISOString().split('T')[0];
  const expiry = new Date(Date.now() + parseInt(days) * 86400000).toISOString().split('T')[0];

  // Generate HMAC hash: MAC + expiry + maxDisplays + SECRET
  const hash = crypto
    .createHmac('sha256', SECRET)
    .update(`${mac}|${expiry}|${maxDisplays}|${SECRET}`)
    .digest('hex')
    .toUpperCase()
    .substring(0, 32);

  // Format key as XXXX-XXXX-XXXX-XXXX
  const key = hash.match(/.{1,8}/g).join('-');

  const content = [
    `CLIENT=${clientName}`,
    `MAC=${mac}`,
    `MAX_DISPLAYS=${maxDisplays}`,
    `ISSUED=${issued}`,
    `EXPIRY=${expiry}`,
    `KEY=${key}`,
  ].join('\n');

  // Save with descriptive name in mi_computadora/
  const archiveName = `license_${clientName}_${issued}.key`;
  const archivePath = path.join(__dirname, archiveName);
  fs.writeFileSync(archivePath, content);

  // Also save as license.key ready to copy to cliente/
  const clientePath = path.join(__dirname, '..', 'cliente', 'license.key');
  fs.writeFileSync(clientePath, content);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  ✅  License Generated Successfully!             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Client      : ${clientName.substring(0,33).padEnd(33)} ║`);
  console.log(`║  MAC Address : ${mac.padEnd(33)} ║`);
  console.log(`║  Max Displays: ${maxDisplays.padEnd(33)} ║`);
  console.log(`║  Issued      : ${issued.padEnd(33)} ║`);
  console.log(`║  Expires     : ${expiry.padEnd(33)} ║`);
  console.log(`║  KEY         : ${key.padEnd(33)} ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Files saved:                                    ║');
  console.log(`║  Archive : mi_computadora/${archiveName.substring(0,22).padEnd(22)} ║`);
  console.log('║  Ready   : app_segura/cliente/license.key        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Next steps:                                     ║');
  console.log('║  1. Copy dms/ folder to client PC                ║');
  console.log('║  2. license.key is already in cliente/ ✅        ║');
  console.log('║  3. Client runs One_click_install/START.bat      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
})();


@echo off
title DMS — Secure Database for Client
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0secure-db.ps1"
pause



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



PS C:\Users\Dell\Desktop\dms\dms\dms-frontend> ls


    Directory: C:\Users\Dell\Desktop\dms\dms\dms-frontend


Mode                 LastWriteTime         Length Name                                                                
----                 -------------         ------ ----                                                                
d-----         9/15/2026  10:12 PM                .next                                                               
d-----         8/18/2026   5:40 PM                node_modules                                                        
d-----         8/18/2026   5:37 PM                src                                                                 
------          8/4/2026   9:25 AM          12292 .DS_Store                                                           
------          8/3/2026  12:26 AM            133 .env.local                                                          
------          6/2/2026   9:04 AM             37 .gitignore                                                          
------          6/4/2026   9:28 AM            293 next.config.js                                                      
-a----         8/18/2026   5:33 PM          62715 package-lock.json                                                   
------         7/30/2026   5:14 PM            558 package.json                                                        


PS C:\Users\Dell\Desktop\dms\dms\dms-frontend> 



PS C:\Users\Dell\Desktop\dms\dms> cd One_click_install
PS C:\Users\Dell\Desktop\dms\dms\One_click_install> ls


    Directory: C:\Users\Dell\Desktop\dms\dms\One_click_install


Mode                 LastWriteTime         Length Name                                                                
----                 -------------         ------ ----                                                                
d-----         9/15/2026   9:42 PM                logs                                                                
-a----         9/15/2026   9:54 PM          13132 HOW-IT-WORKS.md                                                     
------         7/10/2026   2:42 PM           9010 One_click_install.zip                                               
-a----         8/19/2026   1:57 PM           6013 setup-prod.ps1                                                      
-a----         8/19/2026   5:18 PM          14662 setup.ps1                                                           
------         7/10/2026   1:50 PM            108 START-PROD.bat                                                      
------         7/10/2026   1:48 PM            103 START.bat                                                           
-a----         8/19/2026   1:58 PM            370 STOP.bat                                                            


PS C:\Users\Dell\Desktop\dms\dms\One_click_install> 



@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { taskkill /f /im node.exe 2>$null; taskkill /f /im mosquitto.exe 2>$null; taskkill /f /im httpd.exe 2>$null; taskkill /f /im mysqld.exe 2>$null; net stop MySQL 2>$null; net stop mysql 2>$null; net stop Apache2.4 2>$null; net stop mosquitto 2>$null; Write-Host 'All DMS services stopped.' }"
pause




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



@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-prod.ps1"
pause


@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause



@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause



@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { taskkill /f /im node.exe 2>$null; taskkill /f /im mosquitto.exe 2>$null; taskkill /f /im httpd.exe 2>$null; taskkill /f /im mysqld.exe 2>$null; net stop MySQL 2>$null; net stop mysql 2>$null; net stop Apache2.4 2>$null; net stop mosquitto 2>$null; Write-Host 'All DMS services stopped.' }"
pause


