// src/jobs/offlineDetector.js
import { executeQuery } from '../config/database.js';
import logger           from '../utils/logger.js';

let timer = null;

const check = async () => {
  try {
    const clients = await executeQuery(
      'SELECT database_name FROM clients WHERE is_active = 1',
      [], 'master'
    );
    await Promise.all(
      clients.map(async ({ database_name }) => {
        try {
          const result = await executeQuery(
            `UPDATE displays SET status = 'OFFLINE'
             WHERE last_heartbeat < NOW() - INTERVAL 5 MINUTE AND status = 'ONLINE'`,
            [], database_name
          );
          if (result.affectedRows > 0)
            logger.info(`📺 Offline detector [${database_name}]: ${result.affectedRows} TV(s) marked offline`);
        } catch {
          // Client DB might not exist yet — ignore
        }
      })
    );
  } catch (err) {
    logger.warn(`📺 Offline detector check failed: ${err.message}`);
  }
};

export const startOfflineDetector = () => {
  setTimeout(check, 10_000);          // ← delay 10s, NOT immediate
  timer = setInterval(check, 30_000);
  logger.info('📺 Offline detector job started (30s interval)');
};

export const stopOfflineDetector = () => {
  if (timer) clearInterval(timer);
};
