# DMS Digital Signage — Complete Master Guide
## Everything you need to know — read this if you forget anything

---

## Your Project Folder Structure

```
dms/
├── One_click_install/              ← Windows batch files (client gets this)
│   ├── START.bat                   ← main launcher — double-click to run
│   ├── STOP.bat                    ← stop all services
│   ├── START-PROD.bat              ← production mode (faster, no reinstall)
│   ├── setup.ps1 / setup-prod.ps1  ← actual install/launch logic
│   └── HOW-IT-WORKS.md             ← technical reference for these scripts
│
├── app_segura/
│   ├── cliente/                    ← copy this to client PC (part of the main package)
│   │   ├── license.js              ← shared validation logic (used by backend too)
│   │   ├── check-license.js        ← CLI wrapper — `node check-license.js` for a status check
│   │   ├── GET-MAC.bat             ← client runs to get their MAC
│   │   ├── RENEW-LICENSE.bat       ← client runs to see expiry status
│   │   ├── license.key             ← YOU generate this per client — REQUIRED, app won't start without it
│   │   └── license.key.SAMPLE      ← example of what license looks like
│   │
│   └── mi_computadora/             ← YOURS ONLY — never permanently copied into the client package
│       ├── generate-license.js     ← generates license.key for each client (has the SECRET key)
│       ├── SECURE-DB.bat           ← wrapper — run ONCE per client, on the client's PC
│       └── secure-db.ps1           ← actual DB/phpMyAdmin lockdown logic
│
├── backend/                        ← Node.js API server (port 5004)
│   ├── src/
│   ├── server.js                   ← imports app_segura/cliente/license.js directly — see Part 4
│   ├── package.json
│   ├── .env                        ← auto-created by START.bat
│   └── .seeded                     ← auto-created after first DB seed
│
└── dms-frontend/                   ← Next.js web admin (port 3000)
    ├── src/
    ├── next.config.js
    ├── package.json
    └── .env.local                  ← auto-created by START.bat
```

`app_segura/` and `backend/` are coupled on purpose: `backend/server.js` won't
start without `app_segura/cliente/license.js` being present and its
`license.key` being valid for the machine it's running on. See Part 4 and
`One_click_install/HOW-IT-WORKS.md` → "Folder Coupling" for exactly what has
to ship together vs what can be updated independently.

---

## Part 1 — What You Do (Your Machine)

### When you get a NEW client

```
STEP 1 — Give client GET-MAC.bat
─────────────────────────────────
Send client this file:
  app_segura/cliente/GET-MAC.bat

Client double-clicks it → sees their MAC address
Client screenshots it → sends to you via WhatsApp/email

Example MAC: A1-B2-C3-D4-E5-F6


STEP 2 — Generate their license on your machine
─────────────────────────────────────────────
Open a terminal (not piped/scripted — it's interactive):

  cd dms/app_segura/mi_computadora
  node generate-license.js

It will ask you 4 questions:
  ┌─────────────────────────────────────────────────┐
  │ Client MAC Address   → paste what client sent   │
  │ Client Name          → e.g. Jio_Mumbai          │
  │ Max Displays allowed → e.g. 5                   │
  │ License valid days   → e.g. 365 (for 1 year)    │
  └─────────────────────────────────────────────────┘

Script automatically:
  → Creates license_Jio_Mumbai_2026-01-15.key  (your archive copy)
  → Writes it to app_segura/cliente/license.key  (ready to ship)


STEP 3 — Copy project to client PC
─────────────────────────────────────
Copy the ENTIRE dms/ folder (One_click_install/, app_segura/, backend/,
dms-frontend/) to the client PC via USB or network. license.key is already
inside app_segura/cliente/ — nothing extra to do.

Do NOT copy app_segura/mi_computadora/ into what stays permanently on the
client PC — it holds generate-license.js (the SECRET signing key) and
secure-db.ps1. Bring it along temporarily (e.g. on the same USB drive) only
to run SECURE-DB.bat in Step 4, then remove it from the client PC afterward
if you want to be strict about it.


STEP 4 — Secure the database (run ONCE per client, recommended)
────────────────────────────────────────────────────
On the CLIENT PC, run as Administrator:
  app_segura/mi_computadora/SECURE-DB.bat

This will ask for 2 passwords:
  ┌─────────────────────────────────────────────────┐
  │ New MySQL root password    → e.g. Admin@DMS2026 │
  │ DMS database user password → e.g. DmsUser@2026  │
  └─────────────────────────────────────────────────┘

WRITE THESE DOWN — you will need them if something breaks.

What it does automatically (5 steps):
  → Sets a real MySQL root password (was blank by default)
  → Creates a limited 'dms_user' MySQL account and switches backend/.env
    to use it instead of root (see Part 5 for exactly what it can/can't do)
  → Blocks phpMyAdmin from the network (localhost only)
  → Restricts MySQL itself to localhost only (was reachable from the LAN)
  → Locks backend/.env and dms-frontend/.env.local so only this Windows
    user account can read them

This is a manual step you run yourself — it is NOT part of START.bat and
does not happen automatically. Skipping it leaves MySQL/phpMyAdmin reachable
from any device on the client's LAN with a blank root password.

Restart the app (START-PROD.bat) after running this, so the backend picks
up the new DB user.


STEP 5 — Tell client to run START.bat
───────────────────────────────────────
Client double-clicks:
  One_click_install/START.bat

First run auto-installs everything (~5-10 mins).
Browser opens at http://localhost:3000 ✅
Default login: superadmin / super123 — tell the client to change it.
```

---

### When client license EXPIRES

```
STEP 1 — Client tells you license expired
  OR
  Client runs RENEW-LICENSE.bat → sees expiry date → tells you
  OR
  Client sees the app return "License invalid or expired" on every
  screen — the backend locks itself automatically when the license goes
  bad (see Part 4)

STEP 2 — You run generate-license.js again
  cd dms/app_segura/mi_computadora
  node generate-license.js

  Use same MAC address (client PC didn't change)
  New expiry days → e.g. 365 more days

STEP 3 — Send new license.key to client
  Found at: app_segura/cliente/license.key
  Send via WhatsApp or email

STEP 4 — Client replaces old license.key
  Old file: app_segura/cliente/license.key  → DELETE
  New file: paste the new license.key here

STEP 5 — Client restarts the app (STOP.bat then START-PROD.bat) → works again ✅
  (A running backend only re-checks the license every 6 hours — a restart
  makes it take effect immediately.)
```

---

### When client wants MORE displays

```
STEP 1 — Client calls you saying they want 5 more displays

STEP 2 — Decide the new total
  e.g. was licensed for 5 → now allow 10

STEP 3 — Generate new license with higher display count
  node generate-license.js
  Same MAC, same client name
  MAX_DISPLAYS → 10
  EXPIRY DAYS  → remaining days on current license

STEP 4 — Send new license.key to client, they replace it and restart → done ✅
```

---

## Part 2 — What Client Does (Their Windows PC)

### First time setup

```
STEP 1 — Double-click One_click_install/START.bat (Run as Administrator)

STEP 2 — Wait for auto-install (~5-10 mins first time)
  Installs: Node.js 20 LTS, XAMPP (MySQL + phpMyAdmin), Mosquitto MQTT, npm packages
  Creates: backend/.env + dms-frontend/.env.local, database tables, superadmin account
  Verifies: license.key is valid for this machine (blocks install if not)

STEP 3 — Browser opens automatically at http://localhost:3000

STEP 4 — Login with the default superadmin account
  Username: superadmin
  Password: super123
  (set in backend/.env → SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD)

STEP 5 — Change the password immediately after first login
```

### Every day usage

```
START the app:   double-click One_click_install/START-PROD.bat
                 (faster than START.bat — skips the install checks)
STOP the app:    double-click One_click_install/STOP.bat
```

### When client sees "LICENSE EXPIRED" or the app returns 403 errors

```
Client runs:  app_segura/cliente/RENEW-LICENSE.bat
              → shows expiry date and days remaining

Client contacts YOU to get a new license.key
Replaces app_segura/cliente/license.key
Restarts the app (STOP.bat then START-PROD.bat) → done ✅
```

### What client CANNOT do (security)

```
❌  Cannot run the app on another PC — backend refuses to start if the
    machine's MAC doesn't match license.key (enforced in backend/server.js
    itself, not just START.bat — can't be bypassed by running node directly)
❌  Cannot edit license.key — HMAC hash check invalidates any tampering
❌  Cannot add more displays than licensed — checked at startup and every 6h
❌  Cannot use the app after the license expires — checked at startup and
    every 6h; the API locks itself (403 on every request) if it goes bad
    mid-run
❌  Cannot see .env passwords — file permissions locked to one Windows
    user (ONLY after you run SECURE-DB.bat — not automatic)
❌  Cannot access MySQL/phpMyAdmin from another device on the LAN
    (ONLY after you run SECURE-DB.bat — not automatic; until then, MySQL
    has a blank root password and is reachable from the network)
```

---

## Part 3 — How START.bat Works (Step by Step)

```
Double-click One_click_install/START.bat
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 0: license check deferred │ ← can't run check-license.js before
    │  (needs Node.js first)          │   Node.js exists on a blank PC
    └────────────────────────────────┘
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 1: Node.js 20 LTS        │ ← auto-downloads if missing
    │  License verified right after   │ ← install STOPS here if invalid,
    │  Node installs                  │   before downloading XAMPP/Mosquitto
    └────────────────────────────────┘
                │ ✅ passed
                ▼
    ┌────────────────────────────────┐
    │  STEP 2: MySQL (XAMPP)         │ ← auto-downloads + installs if missing
    │  starts MySQL + Apache          │   Apache isn't a Windows service on a
    │  (phpMyAdmin)                   │   fresh XAMPP install — falls back to
    │                                  │   launching httpd.exe directly
    └────────────────────────────────┘
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 3: Mosquitto MQTT        │ ← auto-downloads if missing
    │  TCP:1883 + WebSocket:9001      │   Always runs with the custom conf
    │                                  │   directly — the installer's own
    │                                  │   Windows service (wrong config) is
    │                                  │   stopped and disabled
    └────────────────────────────────┘
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 4: .env files            │ ← auto-created first run only
    │  backend/.env (random JWT       │
    │  secret, default admin login,   │
    │  LAN-IP based URLs)             │
    │  dms-frontend/.env.local        │
    └────────────────────────────────┘
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 5: npm install           │ ← runs first time only
    │  backend + frontend packages    │   skipped if node_modules exists
    └────────────────────────────────┘
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 6: Database check        │ ← validates SUPERADMIN_USERNAME/
    │  (no seeding needed — tables    │   PASSWORD are set in .env; actual
    │  auto-created by backend)       │   tables are created by the backend
    │                                  │   itself the moment it starts (Step 7)
    └────────────────────────────────┘
                │
                ▼
    ┌────────────────────────────────┐
    │  STEP 7: Launch servers        │ ← backend re-checks the license one
    │  Window 1: backend port 5004    │   more time here, before touching
    │  Window 2: frontend port 3000   │   the DB or opening any port —
    │  Opens browser automatically    │   this is the check that can't be
    │                                  │   bypassed (see Part 4)
    └────────────────────────────────┘
```

Full technical detail on every step lives in `One_click_install/HOW-IT-WORKS.md` —
this guide covers the client-facing workflow, that one covers the scripts.

---

## Part 4 — How License Security Works

```
generate-license.js (YOUR machine)      license.js + check-license.js (CLIENT PC)
──────────────────────────────          ──────────────────────────────
Takes:                                  Same validation logic, checked in
  - MAC address                         THREE places (see below):
  - Client name                           1. File exists?
  - Max displays                          2. MAC matches this PC?
  - Expiry date                           3. Not expired today?
                                          4. KEY hash valid?
Creates HMAC hash:                        5. Display count within limit?
  SHA256(MAC + EXPIRY +
         MAX_DISPLAYS + SECRET)         If ANY check fails:
                                          → clear error message
Saves license.key:                       → exits / refuses to start
  CLIENT=Jio_Mumbai
  MAC=A1-B2-C3-D4-E5-F6              If ALL checks pass:
  MAX_DISPLAYS=5                        → success message, app runs
  ISSUED=2026-01-15
  EXPIRY=2027-01-15
  KEY=A3F2C1D4-B5E6A7F8-...
```

**Where the check actually happens — three layers, not one:**

```
1. One_click_install/setup.ps1, right after Node.js installs
   → Friendly check so an invalid license fails fast, before 5-10 minutes
     of XAMPP/Mosquitto downloads. Runs check-license.js.

2. backend/server.js, at the very top of startup — THE REAL GATE
   → Calls enforceLicenseOrExit() before touching the database or opening
     any port. Invalid license = the Node process exits immediately.
   → This runs even if someone skips START.bat entirely and launches the
     backend directly with `node server.js` or `npm start` — there is no
     way to start the API without a valid, machine-matched license.key.

3. backend/src/jobs/licenseWatch.js, every 6 hours while running
   → Re-validates in case of expiry, exceeding the display limit, or the
     license.key file being edited/deleted mid-run.
   → If it goes invalid, the API locks itself — every request gets HTTP
     403 "License invalid or expired" until it's fixed and restarted. The
     process itself isn't killed, so it degrades cleanly instead of
     crashing mid-operation.
```

`check-license.js` is still there for manual, human-readable checks
(`node check-license.js` or double-click `RENEW-LICENSE.bat`) — it's a thin
wrapper around the same `license.js` logic the backend uses directly.

---

## Part 5 — What SECURE-DB.bat Actually Locks Down

`SECURE-DB.bat` (→ `secure-db.ps1`) is a manual, run-once-per-client step —
it is NOT part of START.bat and does not run automatically.

```
Before SECURE-DB.bat:
  MySQL root password : blank
  MySQL reachable from : any device on the client's LAN (bind-address unset)
  phpMyAdmin reachable from : any device on the client's LAN
  backend/.env : readable by any Windows user on the PC

After SECURE-DB.bat:
  MySQL root password : set by you, on the spot
  App's own DB user   : 'dms_user' — can create/drop/alter/read/write DMS's
                         own databases, but CANNOT manage MySQL users, grant
                         privileges, read files, or shut the server down
  MySQL reachable from : localhost only (this PC)
  phpMyAdmin reachable from : localhost only (this PC)
  backend/.env, dms-frontend/.env.local : locked to one Windows user via icacls
```

Why `dms_user` needs broad-looking grants (`CREATE, DROP, ALTER, ... ON *.*`)
despite being called "limited": DMS creates a brand new MySQL database for
every client it onboards, and re-runs schema migrations against master_db +
every client database on every backend start — all under one DB user. A user
scoped to only `master_db.*` would make client creation fail and lock the
app out of every existing client's own data the moment it replaced root in
`.env`. What actually makes it "limited" is what it's missing: `GRANT
OPTION`, `SUPER`, `FILE`, `PROCESS`, `SHUTDOWN`, `RELOAD`, and any user or
replication administration — it cannot touch the MySQL server itself, only
DMS's own application data.

---

## Part 6 — Service URLs Quick Reference

```
Web Admin Panel   →   http://localhost:3000
Network (WiFi)    →   http://YOUR_IP:3000
Backend API       →   http://localhost:5004
phpMyAdmin        →   http://localhost/phpmyadmin
MQTT TCP          →   mqtt://localhost:1883
MQTT WebSocket    →   ws://localhost:9001
```

TV App `.env` settings (shown every time START.bat runs):
```
LOCAL_API_URL=http://YOUR_IP:5004
LOCAL_MQTT_HOST=YOUR_IP
LOCAL_MQTT_PORT=9001
```

---

## Part 7 — Troubleshooting

```
Problem                          Fix
──────────────────────────────────────────────────────────────────
LICENSE NOT FOUND                Put license.key in
                                 app_segura/cliente/ folder

LICENSE INVALID — Wrong Machine  Client copied app to a different PC
                                 Generate new license for their MAC

LICENSE EXPIRED                  Generate new license.key
                                 Send to client to replace old one

DISPLAY LIMIT EXCEEDED           Generate new license with higher
                                 MAX_DISPLAYS number

App returns 403 "License         The 6-hourly re-check failed while
invalid or expired" on           running. Run check-license.js to see
every request                    why, fix it, restart with START-PROD.bat

Backend won't start at all,      app_segura/ folder is missing or
error mentions "license.js       incomplete — the backend refuses to run
could not be loaded"             standalone. Copy the full dms/ folder.

MySQL won't start                Open C:\xampp\xampp-control.exe
                                 Click Start on MySQL manually

Port 3000 in use                 Change PORT in dms-frontend/.env.local

Port 5004 in use                 Change PORT in backend/.env

npm install failed               Delete node_modules/ in backend/
                                 or dms-frontend/ then re-run START.bat

Database not seeded              Delete backend/.seeded
                                 Run START.bat again

TV app cannot connect            Note IP shown in START.bat output
                                 Set LOCAL_API_URL=http://THAT_IP:5004

Can't open phpMyAdmin            Expected ONLY after you've run
from another device               SECURE-DB.bat on that client — before
                                  that, it's reachable from the LAN

Forgot MySQL password            Run SECURE-DB.bat again to reset
                                 (only meaningful after it's been run once)
```

---

## Part 8 — Files You Must NEVER Share with Client

```
app_segura/mi_computadora/generate-license.js  ← contains the SECRET key
app_segura/mi_computadora/secure-db.ps1        ← contains DB admin commands
app_segura/mi_computadora/SECURE-DB.bat        ← wrapper for the above
```

If a client gets `generate-license.js` they can generate their own license
keys and remove all display limits and expiry. Bring `mi_computadora/` along
only to run `SECURE-DB.bat` on-site; it doesn't need to stay on the client
PC afterward.

---

## Part 9 — Your Checklist for Each New Client

```
Before delivery:
  □ Got client MAC address (from GET-MAC.bat)
  □ Ran generate-license.js with correct MAX_DISPLAYS
  □ license.key is in app_segura/cliente/
  □ Tested START.bat works on client PC — license check passes, app runs
  □ Ran SECURE-DB.bat on client PC (recommended, not automatic)
  □ Browser opens at http://localhost:3000
  □ Login works with superadmin / super123
  □ Told client to change the password
  □ Noted license expiry date in your calendar

After delivery:
  □ Saved license archive in mi_computadora/
    (file named license_ClientName_Date.key)
  □ Saved MySQL passwords (from SECURE-DB.bat) somewhere safe
  □ Set calendar reminder 30 days before expiry
```

---

*DMS — IOTtech Smart Products Pvt. Ltd.*
*Node.js 20 LTS + Next.js + MySQL (XAMPP) + Mosquitto MQTT*
