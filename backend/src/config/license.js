// src/config/license.js
// Enforces the license.key check (app_segura/cliente/license.js) at
// backend startup and on a recurring interval — cannot be bypassed by
// skipping START.bat, since server.js itself refuses to run without it.
//
// backend/ and app_segura/ are two separate top-level folders that MUST
// travel together — this module is what makes that a hard requirement.
// If app_segura/ is ever missing (e.g. someone copies just backend/ and
// dms-frontend/ on their own), loadLicenseModule() below turns Node's raw
// "Cannot find module" crash into a clear, actionable error instead.
import logger from '../utils/logger.js';

let locked = false;
export const isLicenseLocked = () => locked;

let cachedModule = null;
const loadLicenseModule = async () => {
  if (cachedModule) return cachedModule;
  try {
    cachedModule = await import('../../../app_segura/cliente/license.js');
    return cachedModule;
  } catch (err) {
    throw new Error(
      'app_segura/cliente/license.js could not be loaded ' +
      `(${err.message.split('\n')[0]}). This backend cannot run standalone — ` +
      'it requires the full dms/ folder, including app_segura/. ' +
      'Copy the complete project folder, not just backend/.'
    );
  }
};

const describe = (result) => {
  if (result.valid) {
    const { client, expiry, daysLeft } = result.info;
    return `License OK - ${client}, expires ${expiry} (${daysLeft}d left)`;
  }
  switch (result.reason) {
    case 'LICENSE_NOT_FOUND':      return 'License file not found - place license.key in app_segura/cliente/';
    case 'LICENSE_CORRUPTED':      return 'License file corrupted';
    case 'MAC_UNREADABLE':         return "Cannot read this machine's MAC address";
    case 'WRONG_MACHINE':          return `License is for MAC ${result.detail.licensed}, this machine is ${result.detail.actual}`;
    case 'EXPIRED':                return `License expired on ${result.detail.expiry}`;
    case 'TAMPERED':               return 'License key does not match - file has been tampered with';
    case 'DISPLAY_LIMIT_EXCEEDED': return `Display limit exceeded - licensed for ${result.detail.maxDisplays}, currently ${result.detail.displayCount}`;
    default:                       return `License invalid (${result.reason})`;
  }
};

export const checkLicense = async () => {
  try {
    const { validateLicense } = await loadLicenseModule();
    const result = validateLicense();
    locked = !result.valid;
    return { result, message: describe(result) };
  } catch (err) {
    locked = true;
    return { result: { valid: false, reason: 'LICENSE_MODULE_MISSING' }, message: err.message };
  }
};

export const enforceLicenseOrExit = async () => {
  const { result, message } = await checkLicense();
  if (!result.valid) {
    logger.error(`License check failed: ${message}`);
    logger.error('Contact IOTtech Smart Products Pvt. Ltd. - server will not start.');
    process.exit(1);
  }
  logger.info(message);
};
