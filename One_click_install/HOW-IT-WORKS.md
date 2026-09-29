
cd app_segura 
 cd mi_computadora 
node generate-license.js

# DMS Digital Signage — Setup Guide
## IOTtech Smart Products Pvt. Ltd.

---

## Folder Structure

```
dms/
├── One_click_install/
│   ├── START.bat          ← Double-click to install + run
│   ├── START-PROD.bat     ← Production mode (faster, no reinstall)
│   ├── STOP.bat           ← Stop all services
│   ├── HOW-IT-WORKS.md   ← This file
│   └── logs/              ← Auto-created, install logs here
│
├── app_segura/
│   ├── cliente/
│   │   ├── license.js         ← Validation logic, shared with the backend
│   │   ├── check-license.js   ← CLI wrapper around license.js (manual checks)
│   │   ├── license.key        ← YOU generate per client — REQUIRED, app won't start without it
│   │   └── GET-MAC.bat        ← Client runs to get MAC
│   └── mi_computadora/    ← YOUR machine only, never send
│       └── generate-license.js
│
├── backend/               ← Node.js API (port 5004)
│   ├── server.js
│   ├── .env               ← Auto-created by START.bat on first run
│   └── .seeded             ← Auto-created after first run
│
└── dms-frontend/          ← Next.js UI (port 3000)
    └── .env.local          ← Auto-created by START.bat
```

---

## Folder Coupling — What Ships Together vs What Updates Independently

`app_segura/` and `One_click_install/` are two separate top-level folders,
but they are **not independent** — `backend/server.js` directly imports
`app_segura/cliente/license.js` to enforce licensing (see Licensing below),
and `One_click_install/setup.ps1` calls `app_segura/cliente/check-license.js`
during install. If `app_segura/` is missing, the backend refuses to start
with a clear error (not a crash) telling you to copy the full folder.

**What this means in practice — three different situations:**

**1. New client (need both folders, plus a fresh license)**
```
Full package = backend/ + dms-frontend/ + One_click_install/ + app_segura/
               (everything except app_segura/mi_computadora/, which never
               leaves your machine)
→ Generate a license.key for their specific MAC (see Licensing below)
  before copying the folder over.
```

**2. Code-only update to an EXISTING client — no new license needed**
```
You changed something in backend/, dms-frontend/, or One_click_install/
(a bug fix, a new feature, an installer fix like the ones done in this
project) and just need to push it to a client who's already running.

→ Copy the new backend/, dms-frontend/, and/or One_click_install/ folders
  over the old ones on the client PC.
→ Do NOT touch app_segura/cliente/license.key or backend/.env — those are
  that specific client's identity and settings. Overwriting them would
  either break their license binding or reset their admin password/secrets.
→ Restart with START-PROD.bat.
```

**3. A change to app_segura/cliente/license.js itself**
```
This file is shared code, not per-client data (license.key is the
per-client part). If you ever change the validation logic in license.js,
that change needs to reach every already-deployed client the same way a
backend code update would — it's imported directly by backend/server.js,
so an old license.js on a client PC keeps using old logic until updated.
```

**Rule of thumb:** `license.key` and `backend/.env` are per-client and
never get overwritten by an update. Everything else (`backend/`,
`dms-frontend/`, `One_click_install/`, `app_segura/cliente/license.js` +
`check-license.js`) is shared code that ships identically to every client
and gets replaced wholesale on a code update.

---

## First-Time Client Setup

```
1. REQUIRED — the app will not start without this (see Licensing section)
   Client runs GET-MAC.bat → sends you their MAC address
   You run generate-license.js on YOUR machine → place license.key in app_segura/cliente/

2. Copy full dms/ folder to client PC via USB/drive

3. Client right-clicks START.bat → Run as Administrator

4. First run takes 5-10 mins (downloads + installs):
   [x] Node.js 20 LTS
   [x] XAMPP (MySQL + phpMyAdmin)
   [x] Mosquitto MQTT
   [x] All npm packages
   [x] backend/.env with a random JWT secret + default admin login
   [x] Database tables (auto-created by the backend on first launch)
   [x] Opens browser at http://localhost:3000

5. Log in with the default superadmin account (see "Default Login" below)
   and change the password immediately.
```

---

## What START.bat Does (Step by Step)

```
[0/7] License check     → Enforced. Blocks install if license.key is missing/invalid (see Licensing below)
[1/7] Node.js           → Installs v20 LTS if missing
[2/7] XAMPP/MySQL       → Installs if missing, starts MySQL + Apache (phpMyAdmin)
[3/7] Mosquitto         → Installs if missing, starts MQTT (TCP:1883, WS:9001)
[4/7] Config files      → Creates backend/.env and dms-frontend/.env.local if missing
[5/7] npm packages      → Installs backend + frontend (first time only)
[6/7] Database check    → Validates SUPERADMIN_USERNAME/PASSWORD are set in .env
[7/7] Launch            → Starts backend (5004) + frontend (3000, dev mode)
```

**Note on Step 6:** DMS doesn't store the superadmin in the database — the admin
account comes straight from `.env` (`SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`).
Step 6 just confirms those are set. The actual database tables (master + per-client)
are created automatically the moment the backend starts in Step 7 — no manual
import or seed step needed.

**Note on Step 2/3 (Apache & Mosquitto on a truly blank PC):** XAMPP's silent
installer does not register Apache as a Windows service, and Mosquitto's
installer registers its service pointed at its own default config (no
anonymous access, no websocket listener). The scripts account for this:
Apache falls back to launching `httpd.exe` directly if no service is running,
and Mosquitto always runs directly with the custom `mosquitto-dms.conf`
(the auto-installed service is stopped and disabled so it can't silently
take over port 1883 with the wrong config). `STOP.bat` kills `httpd.exe` /
`mysqld.exe` / `mosquitto.exe` directly as well as the Windows services, so
it works regardless of which path started them.

**Note on Step 4 (`backend/.env` — only created if missing):**
- `JWT_SECRET` is randomly generated per install (not shared across clients).
- `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` default to `superadmin` / `super123`
  — change this after first login.
- `MQTT_BROKER` is set to `localhost`, `BASE_URL` and (in `dms-frontend/.env.local`)
  `NEXT_PUBLIC_API_URL` are set to the machine's detected LAN IP, so TV displays
  and other devices on the network can reach the server (not just `localhost`).
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` and `SMTP_USER` / `SMTP_PASS` are left
  as placeholders — fill these in manually in `backend/.env` if the client needs
  online payments or outgoing email, then restart via `START-PROD.bat`.

If `backend/.env` already exists (e.g. you're re-running START.bat, or restoring
a previous install), Step 4 leaves it untouched — nothing above is regenerated.

---

## Default Login

```
URL      : http://localhost:3000
Username : superadmin
Password : super123
```

These come from `backend/.env` (`SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`).
**Change the password in `.env` right after first login**, then restart with
`START-PROD.bat` for it to take effect.

---

## Services and Ports

```
Admin Panel   → http://localhost:3000
Backend API   → http://localhost:5004
phpMyAdmin    → http://localhost/phpmyadmin
MQTT TCP      → mqtt://localhost:1883
MQTT WS       → ws://localhost:9001
```

---

## TV App Settings (React Native)

Find your PC's IP in the START.bat output, then in the TV app .env:
```
LOCAL_API_URL=http://YOUR_PC_IP:5004
LOCAL_MQTT_HOST=YOUR_PC_IP
LOCAL_MQTT_PORT=9001
```

---

## Troubleshooting

**MySQL not starting**
→ Open XAMPP Control Panel (C:\xampp\xampp-control.exe)
→ Click START next to MySQL

**Port already in use**
→ Run STOP.bat first, then START.bat again

**MQTT WebSocket failing**
→ Check C:\Program Files\Mosquitto\mosquitto-dms.conf exists
→ Run STOP.bat then START.bat

**Backend exits immediately on launch**
→ Check the console window titled "DMS Backend" for the exact error - it's one of two things:
  1. Missing .env variable: open backend/.env and confirm JWT_SECRET, DB_*, and
     SUPERADMIN_USERNAME/PASSWORD are all set.
  2. Invalid license: run `node app_segura\cliente\check-license.js` for the exact
     reason (not found / wrong machine / expired / tampered / display limit exceeded).

**API returns 403 "License invalid or expired" on every request**
→ The server is running but the 6-hourly license re-check failed (see Licensing below).
→ Run `node app_segura\cliente\check-license.js` to see why, fix it (renew/replace
  license.key), then restart with START-PROD.bat.

**Can't reach the admin panel or TV media from another device on the network**
→ Confirm backend/.env BASE_URL and dms-frontend/.env.local NEXT_PUBLIC_API_URL
  use the server PC's LAN IP, not localhost.
→ If the server's IP changes (DHCP), these need to be updated and the frontend
  rebuilt (delete dms-frontend/.next, run START-PROD.bat again). A static/reserved
  IP for the server PC avoids this.

**Check install log**
→ Open One_click_install\logs\ folder
→ Latest .log file has full details

**npm install fails**
→ Delete backend\node_modules and dms-frontend\node_modules
→ Run START.bat again

---

## Licensing (Enforced)

`app_segura/cliente/license.js` holds the MAC-lock + expiry + display-limit +
tamper-hash validation logic. It's checked in **three places**, so it can't
be skipped by avoiding `START.bat`:

```
1. setup.ps1 (Step 0, right after Node.js installs)
   → Friendly check before spending 5-10 min downloading XAMPP/Mosquitto.
   → Runs `node app_segura/cliente/check-license.js`; install stops if it fails.

2. backend/server.js, at the top of startup — the real gate
   → Calls enforceLicenseOrExit() (backend/src/config/license.js) BEFORE
     touching the database or opening any port.
   → Invalid license = the Node process exits immediately (code 1) and never
     listens on 5004. This runs even if someone launches the backend
     directly with `node server.js` or `npm start`, bypassing START.bat
     entirely — there is no way to start the API without a valid license.key
     matching the machine's MAC address.
   → If app_segura/ itself is missing (e.g. only backend/ + dms-frontend/
     were copied somewhere), this fails with a clear message telling you to
     copy the full dms/ folder — not a raw "module not found" crash.

3. backend/src/jobs/licenseWatch.js, every 6 hours while running
   → Re-validates in case of expiry, a display count exceeding the license,
     or the license.key file being edited/deleted mid-run.
   → If it goes invalid, backend/src/app.js locks the API — every request
     gets HTTP 403 "License invalid or expired" until it's fixed and the
     server is restarted. The process itself is NOT killed (avoids an
     abrupt crash mid-operation); it just stops serving anything useful.
```

`check-license.js` still exists as a plain CLI wrapper around `license.js`
for manual troubleshooting on the client PC (`node check-license.js` prints
a human-readable status) — it's no longer the only thing doing the checking.

**Generating a license for a new client:**
```
1. Client runs GET-MAC.bat → sends you their MAC address
2. You run on YOUR machine:
   cd dms/app_segura/mi_computadora
   node generate-license.js
   → Enter MAC, client name, max displays, expiry days
   → Creates license_ClientName.key AND writes it to app_segura/cliente/license.key
3. Copy the whole dms/ folder (with that license.key already in place) to the client PC
```

Note: `generate-license.js` uses interactive prompts (`readline`) — run it in
a normal terminal, not piped/scripted, or the prompts won't receive input.

## Security Layers

```
MAC lock      → Enforced — backend refuses to start on a machine whose MAC doesn't match license.key
Expiry        → Enforced — checked at startup and every 6h while running
Display limit → Enforced — checked at startup and every 6h (skipped gracefully if DB not ready yet)
Hash verify   → Enforced — license.key content is HMAC-signed, editing it invalidates the key
DB locked     → NOT yet done. MySQL currently has a blank root password and (on this dev
                machine's XAMPP config) bind-address is not restricted to localhost, so any
                device on the client's LAN could reach MySQL/phpMyAdmin with root/no-password.
                Locking this down (real MySQL password, bind-address=127.0.0.1, firewall rules,
                phpMyAdmin auth) is a separate pending task — not covered by the license work above.
```
