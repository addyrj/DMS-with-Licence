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
