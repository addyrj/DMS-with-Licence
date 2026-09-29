// src/events/handlers/onDisplayCreated.js
import eventBus         from '../eventBus.js';
import { executeQuery } from '../../config/database.js';
import { hashPassword } from '../../utils/hash.js';
import logger           from '../../utils/logger.js';

eventBus.on('display.created', async ({ display, dbName, clientId, plainPassword }) => {
  try {
    const num = display.display_number;

    const passwordToHash = plainPassword || num;
    const hashedPassword = await hashPassword(passwordToHash);

    // Create user entry with display_ prefix
    await executeQuery(
      'INSERT INTO users (username, password, is_active) VALUES (?,?,1) ON DUPLICATE KEY UPDATE password=VALUES(password), is_active=1',
      [`display_${num}`, hashedPassword], dbName
    );

    // Register BOTH forms in master user_client_map:
    // 1. display_<num> — used by admin panel user lookup
    // 2. <num> bare   — used by TV app login (display_number as username)
    await executeQuery(
      'INSERT IGNORE INTO user_client_map (username, db_name) VALUES (?,?)',
      [`display_${num}`, dbName], 'master'
    );
    await executeQuery(
      'INSERT IGNORE INTO user_client_map (username, db_name) VALUES (?,?)',
      [num, dbName], 'master'
    );

    // Update storage count
    await executeQuery(
      'UPDATE clients SET used_storage_gb = used_storage_gb + 1 WHERE id = ?',
      [clientId], 'master'
    );

    logger.info(`✅ [display.created] TV login ready — display="${num}" password="${passwordToHash}" db="${dbName}"`);
  } catch (err) {
    logger.error(`❌ [display.created] ${err.message}`);
  }
});