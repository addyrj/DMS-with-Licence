// src/events/handlers/onDisplayDeleted.js

import eventBus         from '../eventBus.js';
import { executeQuery } from '../../config/database.js';
import logger           from '../../utils/logger.js';

eventBus.on('display.deleted', async ({ display, dbName, clientId }) => {
  try {
    const sysUsername = `display_${display.display_number}`;

    // Remove from master map
    await executeQuery(
      'DELETE FROM user_client_map WHERE username = ? AND db_name = ?',
      [sysUsername, dbName],
      'master'
    );

    // Decrement storage
    await executeQuery(
      'UPDATE clients SET used_storage_gb = GREATEST(0, used_storage_gb - 1) WHERE id = ?',
      [clientId],
      'master'
    );

    logger.info(`✅ [display.deleted] Cleanup done for display ${display.display_number}`);
  } catch (err) {
    logger.error(`❌ [display.deleted] ${err.message}`);
  }
});
