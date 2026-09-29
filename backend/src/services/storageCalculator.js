// src/services/storageCalculator.js
// FIX: "used storage" is now the actual sum of uploaded file sizes from
// media_bucket — NOT the display-device counter (used_storage_gb) which
// only tracked how many displays were created, not how much content exists.

import { executeQuery } from '../config/database.js';

/**
 * Calculate total disk usage for a client's media_bucket in MB.
 * This is the authoritative source — always queries the client DB live.
 */
export const getMediaUsageMb = async (dbName) => {
  const rows = await executeQuery(
    'SELECT COALESCE(SUM(file_size_mb), 0) AS used FROM media_bucket',
    [], dbName
  );
  return parseFloat((Array.isArray(rows) ? rows[0]?.used : 0) || 0);
};

/**
 * Full storage summary for a client.
 * FIX: used_gb is now purely the media file sizes.
 *      The display count (devices_required) is available separately but
 *      is NOT included in the "used" calculation — it is a slot counter,
 *      not a storage metric.
 */
export const getStorageSummary = async (clientId, dbName) => {
  const rows = await executeQuery(
    'SELECT total_storage_gb, devices_required FROM clients WHERE id = ?',
    [clientId], 'master'
  );
  const client = Array.isArray(rows) ? rows[0] : rows;

  const mediaMb      = await getMediaUsageMb(dbName);
  const totalLimitGb = client?.total_storage_gb || 0;
  // FIX: used = media files only, not display count
  const usedGb       = mediaMb / 1024;
  const availableGb  = totalLimitGb - usedGb;
  const usagePct     = totalLimitGb > 0 ? (usedGb / totalLimitGb) * 100 : 0;

  return {
    total_gb:     totalLimitGb,
    devices:      client?.devices_required || 0,
    media_mb:     parseFloat(mediaMb.toFixed(2)),
    used_gb:      parseFloat(usedGb.toFixed(3)),
    available_gb: parseFloat(availableGb.toFixed(3)),
    usage_pct:    parseFloat(usagePct.toFixed(1)),
    warning:      usagePct > 80,
  };
};

/**
 * Check if an upload of `sizeMb` MB would exceed the client's limit.
 * Throws 413 if it would.
 */
export const assertUploadAllowed = async (clientId, dbName, sizeMb) => {
  const summary = await getStorageSummary(clientId, dbName);
  const incomingGb = sizeMb / 1024;

  if (summary.used_gb + incomingGb > summary.total_gb) {
    const err = new Error(
      `Storage limit exceeded. Used ${fmt(summary.used_gb)} GB / ${summary.total_gb} GB. ` +
      `Upload requires ${incomingGb.toFixed(2)} GB more.`
    );
    err.statusCode    = 413;
    err.isOperational = true;
    throw err;
  }
};

const fmt = (n) => n.toFixed(2);
