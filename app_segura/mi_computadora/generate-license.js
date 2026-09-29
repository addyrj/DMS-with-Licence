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
