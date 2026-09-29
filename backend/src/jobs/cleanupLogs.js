// src/jobs/cleanupLogs.js
// Deletes activity_logs older than 30 days — runs every 24 hours
import { executeQuery } from '../config/database.js';
import logger           from '../utils/logger.js';

export const startCleanupJob = () => {
  const run = async () => {
    try {
      // Get all client DBs
      const clients = await executeQuery(
        'SELECT database_name FROM clients WHERE is_active = 1', [], 'master'
      );
      let total = 0;
      for (const c of (Array.isArray(clients) ? clients : [])) {
        try {
          const res = await executeQuery(
            'DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
            [], c.database_name
          );
          total += res.affectedRows || 0;
        } catch (_) {}
      }
      if (total > 0) logger.info(`🧹 Cleanup: removed ${total} log entries older than 30 days`);
    } catch (e) {
      logger.error('Cleanup job error:', e.message);
    }
  };

  // Run once on startup, then every 24h
  run();
  setInterval(run, 24 * 60 * 60 * 1000);
  logger.info('🧹 Log cleanup job started (runs every 24h, removes >30 day logs)');
};
