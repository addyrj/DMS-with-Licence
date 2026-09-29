// src/modules/dashboard/dashboard.service.js
import { executeQuery } from '../../config/database.js';

export const getSuperAdminOverview = async () => {
  // FIX: used_media_gb derived from used_media_mb (actual uploaded content),
  //      NOT from used_storage_gb (which was a display-device counter).
  const [clientStats] = await executeQuery(
    `SELECT
       COUNT(*) AS total_clients,
       SUM(is_active = 1) AS active_clients,
       SUM(is_active = 0) AS inactive_clients,
       SUM(subscription_end < CURDATE()) AS expired_clients,
       SUM(DATEDIFF(subscription_end, CURDATE()) BETWEEN 1 AND 7) AS expiring_soon,
       SUM(total_storage_gb)             AS total_storage_gb,
       ROUND(SUM(used_media_mb) / 1024, 3) AS used_media_gb,
       SUM(CASE WHEN is_active = 1 THEN pricing ELSE 0 END) AS monthly_revenue,
       SUM(pricing) AS total_contracted_revenue
     FROM clients`, [], 'master'
  );

  const revenueBreakdown = await executeQuery(
    `SELECT id, company_name, pricing, subscription_start, subscription_end,
            is_active,
            DATEDIFF(subscription_end, CURDATE()) AS days_left,
            DATEDIFF(CURDATE(), subscription_start) AS days_active
     FROM clients ORDER BY pricing DESC`, [], 'master'
  );

  const expiringSoon = await executeQuery(
    `SELECT id, company_name, subscription_end,
            DATEDIFF(subscription_end, CURDATE()) AS days_left
     FROM clients
     WHERE DATEDIFF(subscription_end, CURDATE()) BETWEEN 0 AND 7 AND is_active = 1
     ORDER BY days_left ASC`, [], 'master'
  );

  const recentClients = await executeQuery(
    `SELECT id, company_name, is_active, total_storage_gb, used_media_mb,
            pricing, devices_required, subscription_end, created_at
     FROM clients ORDER BY created_at DESC LIMIT 5`, [], 'master'
  );

  // FIX: storage breakdown uses used_media_mb for correct usage percentage
  const storageBreakdown = await executeQuery(
    `SELECT company_name, total_storage_gb, used_media_mb,
            ROUND((used_media_mb / NULLIF(total_storage_gb * 1024, 0)) * 100, 1) AS usage_pct
     FROM clients ORDER BY usage_pct DESC`, [], 'master'
  );

  return {
    stats:             clientStats,
    expiring_soon:     expiringSoon,
    recent_clients:    recentClients,
    storage_breakdown: storageBreakdown,
    revenue_breakdown: revenueBreakdown,
  };
};

export const getClientOverview = async (dbName, clientId) => {
  const [displayStats] = await executeQuery(
    `SELECT COUNT(*) AS total,
            SUM(status = 'ONLINE') AS online,
            SUM(status = 'OFFLINE') AS offline,
            SUM(temperature_status = 'warning') AS temp_warning,
            SUM(temperature_status = 'critical') AS temp_critical
     FROM displays WHERE client_id = ?`,
    [clientId], dbName
  );

  // FIX: exclude display_ accounts from the user count
  const [userStats] = await executeQuery(
    `SELECT COUNT(*) AS total, SUM(is_active = 1) AS active
     FROM users WHERE username NOT LIKE 'display\\_%'`, [], dbName
  );

  const [lineStats] = await executeQuery(
    `SELECT COUNT(*) AS total, SUM(active_line = 1) AS active
     FROM production_lines WHERE client_id = ?`,
    [clientId], dbName
  );

  const [mediaStats] = await executeQuery(
    `SELECT COUNT(*) AS total_files,
            ROUND(SUM(file_size_mb), 2) AS total_size_mb,
            COUNT(DISTINCT folder_name) AS total_folders
     FROM media_bucket`, [], dbName
  );

  const [assignmentStats] = await executeQuery(
    `SELECT COUNT(*) AS total,
            SUM(is_active = 1) AS active,
            SUM(is_active = 0) AS inactive
     FROM content_assignments`, [], dbName
  );

  const [publishStats] = await executeQuery(
    `SELECT COUNT(*) AS total_published FROM media_content WHERE is_published = 1`,
    [], dbName
  );

  const recentMedia = await executeQuery(
    `SELECT id, file_name, file_type, file_size_mb, folder_name, created_at
     FROM media_bucket ORDER BY created_at DESC LIMIT 5`, [], dbName
  );

  const displaysWithContent = await executeQuery(
    `SELECT d.id, d.display_number, d.display_name, d.status, d.volume_level,
            d.last_heartbeat, d.temperature, d.temperature_status,
            d.uptime_today_minutes, d.content_loops_today,
            COUNT(mc.id) AS content_count
     FROM displays d
     LEFT JOIN media_content mc ON mc.display_id = d.id AND mc.is_published = 1
     WHERE d.client_id = ?
     GROUP BY d.id ORDER BY d.display_number`,
    [clientId], dbName
  );

  return {
    displays:              displayStats,
    users:                 userStats,
    lines:                 lineStats,
    media:                 mediaStats,
    assignments:           assignmentStats,
    published:             publishStats,
    recent_media:          Array.isArray(recentMedia) ? recentMedia : [],
    displays_with_content: Array.isArray(displaysWithContent) ? displaysWithContent : [],
  };
};

export const getClientOverviewById = async (clientId) => {
  const rows = await executeQuery(
    'SELECT id, company_name, database_name FROM clients WHERE id = ?',
    [clientId], 'master'
  );
  const client = Array.isArray(rows) ? rows[0] : rows;
  if (!client) throw Object.assign(
    new Error('Client not found'), { statusCode: 404, isOperational: true }
  );
  const data = await getClientOverview(client.database_name, client.id);
  return {
    client: {
      id:            client.id,
      company_name:  client.company_name,
      database_name: client.database_name,
    },
    ...data,
  };
};
