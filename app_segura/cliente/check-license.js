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
