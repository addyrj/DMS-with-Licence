// src/events/handlers/onClientCreated.js
// Fired when a new client row is inserted — handles all post-creation side effects

import eventBus              from '../eventBus.js';
import { createDatabase }    from '../../config/database.js';
import { runClientMigrations } from '../../database/migrationRunner.js';
import { executeQuery }      from '../../config/database.js';
import { hashPassword }      from '../../utils/hash.js';
import logger                from '../../utils/logger.js';
import fs                    from 'fs';
import path                  from 'path';
import env                   from '../../config/env.js';

eventBus.on('client.created', async ({ client, plainPassword }) => {
  try {
    const { database_name, admin_username, admin_email } = client;

    // 1. Create MySQL database
    await createDatabase(database_name);

    // 2. Run schema migrations
    await runClientMigrations(database_name);

    // 3. Create admin user inside client DB
    const hashed = await hashPassword(plainPassword);
    await executeQuery(
      'INSERT INTO users (username, password, email, is_active) VALUES (?,?,?,1)',
      [admin_username, hashed, admin_email || null],
      database_name
    );

    // 4. Ensure file dirs exist
    fs.mkdirSync(path.join(env.uploadDir, database_name), { recursive: true });
    fs.mkdirSync(path.join(env.tvfileDir, database_name), { recursive: true });

    logger.info(`✅ [client.created] All side effects complete for [${database_name}]`);
  } catch (err) {
    logger.error(`❌ [client.created] Side effect failed: ${err.message}`);
  }
});
