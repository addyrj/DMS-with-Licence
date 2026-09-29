// src/events/handlers/onClientDeleted.js

import eventBus           from '../eventBus.js';
import { dropDatabase }   from '../../config/database.js';
import { executeQuery }   from '../../config/database.js';
import logger             from '../../utils/logger.js';
import fs                 from 'fs';
import path               from 'path';
import env                from '../../config/env.js';

eventBus.on('client.deleted', async ({ client }) => {
  try {
    const { id, database_name } = client;

    // 1. Remove all user_client_map entries for this DB
    await executeQuery(
      'DELETE FROM user_client_map WHERE db_name = ?',
      [database_name],
      'master'
    );

    // 2. Drop the database
    await dropDatabase(database_name);

    // 3. Delete upload + tvfile directories
    const uploadDir = path.join(env.uploadDir, database_name);
    const tvDir     = path.join(env.tvfileDir,  database_name);
    if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true });
    if (fs.existsSync(tvDir))     fs.rmSync(tvDir,     { recursive: true });

    logger.info(`✅ [client.deleted] Cleanup complete for [${database_name}]`);
  } catch (err) {
    logger.error(`❌ [client.deleted] Cleanup failed: ${err.message}`);
  }
});
