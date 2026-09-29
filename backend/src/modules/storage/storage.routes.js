// src/modules/storage/storage.routes.js
import { Router }       from 'express';
import asyncHandler     from '../../utils/asyncHandler.js';
import { authorize }    from '../../middleware/authorize.js';
import { ROLES }        from '../../constants/roles.js';
import { executeQuery } from '../../config/database.js';
import { parsePage }    from '../../utils/pagination.js';
import { getStorageSummary } from '../../services/storageCalculator.js';

const router = Router();
const sa     = authorize(ROLES.SUPER_ADMIN);

// GET /api/storage/overview
// FIX: "Used" column now comes from used_media_mb (actual uploaded file sizes),
//      not used_storage_gb (which was a device-slot counter, not a storage metric).
//      usage_pct is (used_media_mb / (total_storage_gb * 1024)) * 100.
router.get('/overview', sa, asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);

  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM clients', [], 'master');

  const clients = await executeQuery(
    `SELECT id, company_name, database_name,
            total_storage_gb, used_media_mb, devices_required, pricing,
            ROUND(
              (used_media_mb / NULLIF(total_storage_gb * 1024, 0)) * 100,
              1
            ) AS usage_pct,
            is_active
     FROM clients
     ORDER BY usage_pct DESC
     LIMIT ? OFFSET ?`,
    [limit, offset], 'master'
  );

  const [totals] = await executeQuery(
    `SELECT SUM(total_storage_gb)              AS total_allocated_gb,
            ROUND(SUM(used_media_mb) / 1024, 3) AS total_used_media_gb,
            SUM(used_media_mb)                  AS total_used_media_mb,
            SUM(pricing)                        AS monthly_revenue,
            COUNT(*)                            AS total_clients,
            SUM(is_active = 1)                  AS active_clients
     FROM clients`,
    [], 'master'
  );

  // Alerts must reflect ALL clients over 80% usage, not just the current page —
  // computed via a separate unpaginated query rather than filtering the page's rows.
  const alerts = await executeQuery(
    `SELECT id, company_name, database_name,
            total_storage_gb, used_media_mb, devices_required, pricing,
            ROUND((used_media_mb / NULLIF(total_storage_gb * 1024, 0)) * 100, 1) AS usage_pct,
            is_active
     FROM clients
     HAVING usage_pct > 80
     ORDER BY usage_pct DESC`,
    [], 'master'
  );

  res.json({
    success: true, totals,
    clients: Array.isArray(clients) ? clients : [],
    alerts:  Array.isArray(alerts)  ? alerts  : [],
    page, limit, total, totalPages: Math.ceil(total / limit) || 0,
  });
}));

// GET /api/storage/client/:id
// Individual client — live query against their media_bucket for accurate totals.
router.get('/client/:id', sa, asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);

  const rows = await executeQuery(
    `SELECT id, company_name, database_name,
            total_storage_gb, used_media_mb, devices_required, pricing
     FROM clients WHERE id = ?`,
    [req.params.id], 'master'
  );
  const client = Array.isArray(rows) ? rows[0] : rows;
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  // Live accurate summary (queries client DB directly)
  const summary = await getStorageSummary(client.id, client.database_name);

  // Also update the cached column while we're here
  await executeQuery(
    'UPDATE clients SET used_media_mb = ? WHERE id = ?',
    [summary.media_mb, client.id], 'master'
  );

  const [{ total }] = await executeQuery(
    'SELECT COUNT(*) as total FROM (SELECT folder_name FROM media_bucket GROUP BY folder_name) t',
    [], client.database_name
  ).catch(() => [{ total: 0 }]);

  const folders = await executeQuery(
    `SELECT folder_name, COUNT(*) AS file_count,
            ROUND(SUM(file_size_mb), 2) AS total_mb
     FROM media_bucket
     GROUP BY folder_name ORDER BY total_mb DESC
     LIMIT ? OFFSET ?`,
    [limit, offset], client.database_name
  ).catch(() => []);

  res.json({
    success: true, client, summary,
    folders: Array.isArray(folders) ? folders : [],
    page, limit, total, totalPages: Math.ceil(total / limit) || 0,
  });
}));

export default router;
