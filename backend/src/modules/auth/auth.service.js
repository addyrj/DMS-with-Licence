// src/modules/auth/auth.service.js

import { executeQuery }    from '../../config/database.js';
import { comparePassword } from '../../utils/hash.js';
import { generateToken }   from '../../utils/jwt.js';
import { ROLES }           from '../../constants/roles.js';
import env                 from '../../config/env.js';
import logger              from '../../utils/logger.js';

// ── Super Admin login ─────────────────────────────────────────────────────────
export const superAdminLogin = async ({ username, password }) => {
  if (username !== env.superadmin.username)
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });

  // Support both plain text (dev) and bcrypt hash
  const match = await comparePassword(password, env.superadmin.password).catch(() => false);
  const valid = match || (env.nodeEnv !== 'production' && password === env.superadmin.password);

  if (!valid)
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });

  const token = generateToken({ username, role: ROLES.SUPER_ADMIN, client_id: null, db_name: 'master' });
  return { token, user: { username, role: ROLES.SUPER_ADMIN } };
};

// ── Client Admin / Employee login ─────────────────────────────────────────────
export const clientLogin = async ({ username, password }) => {
  // Step 1: resolve which client DB this user belongs to
  const mapRows = await executeQuery(
    'SELECT db_name FROM user_client_map WHERE username = ?',
    [username], 'master'
  );
  const map = Array.isArray(mapRows) ? mapRows[0] : null;
  if (!map) {
    logger.warn(`Login failed — username not in user_client_map: ${username}`);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });
  }

  const dbName = map.db_name;
  logger.info(`Login attempt: ${username} → ${dbName}`);

  // Step 2: verify client is active and subscription valid
  const clientRows = await executeQuery(
    'SELECT id, is_active, subscription_end FROM clients WHERE database_name = ?',
    [dbName], 'master'
  );
  const client = Array.isArray(clientRows) ? clientRows[0] : null;
  if (!client) throw Object.assign(new Error('Client account not found'), { statusCode: 403, isOperational: true });
  if (!client.is_active) throw Object.assign(new Error('Account inactive. Contact administrator.'), { statusCode: 403, isOperational: true });

  const today = new Date().toISOString().slice(0, 10);
  if (client.subscription_end < today)
    throw Object.assign(new Error('Subscription expired. Contact administrator.'), { statusCode: 403, isOperational: true });

  // Step 3: fetch user from client DB
  const userRows = await executeQuery(
    'SELECT id, username, password, is_active FROM users WHERE username = ?',
    [username], dbName
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  if (!user) {
    logger.warn(`Login failed — user not found in ${dbName}: ${username}`);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });
  }
  if (!user.is_active)
    throw Object.assign(new Error('User account is deactivated'), { statusCode: 401, isOperational: true });

  // Step 4: verify password
  const valid = await comparePassword(password, user.password);
  if (!valid) {
    logger.warn(`Login failed — wrong password for ${username} in ${dbName}`);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });
  }

  // Step 5: determine role (employee_users row = employee, else client admin)
  const empRows = await executeQuery(
    'SELECT user_id FROM employee_users WHERE user_id = ?',
    [user.id], dbName
  );
  const emp  = Array.isArray(empRows) ? empRows[0] : null;
  const role = emp ? ROLES.EMPLOYEE : ROLES.CLIENT_ADMIN;

  // CLIENT_ADMIN gets all permissions automatically
  // Step 6: update last login timestamps
  await executeQuery('UPDATE users SET last_login = NOW() WHERE id = ?',   [user.id],   dbName);
  await executeQuery('UPDATE clients SET last_login = NOW() WHERE id = ?', [client.id], 'master');

  // CLIENT_ADMIN always has full permissions
  const permissions = role === ROLES.CLIENT_ADMIN ? {
    perm_delete_content:  true,
    perm_create_lines:    true,
    perm_assign_displays: true,
    perm_upload_files:    true,
    perm_create_users:    true,
  } : {
    perm_delete_content:  emp?.has_delete_permission || client.perm_delete_content  || false,
    perm_create_lines:    false,
    perm_assign_displays: false,
    perm_upload_files:    client.perm_upload_files || true,
    perm_create_users:    false,
  };

  const token = generateToken({ id: user.id, username, role, client_id: client.id, db_name: dbName, ...permissions });
  logger.info(`✅ Login success: ${username} [${role}] → ${dbName}`);
  return { token, user: { id: user.id, username, role, db_name: dbName } };
};

// ── Refresh token ─────────────────────────────────────────────────────────────
export const refreshToken = async (oldDecoded) => {
  if (oldDecoded.client_id) {
    const rows = await executeQuery(
      'SELECT is_active, subscription_end FROM clients WHERE id = ?',
      [oldDecoded.client_id], 'master'
    );
    const client = Array.isArray(rows) ? rows[0] : null;
    if (!client || !client.is_active)
      throw Object.assign(new Error('Account inactive'), { statusCode: 403, isOperational: true });
    const today = new Date().toISOString().slice(0, 10);
    if (client.subscription_end < today)
      throw Object.assign(new Error('Subscription expired'), { statusCode: 403, isOperational: true });
  }
  const { iat, exp, ...payload } = oldDecoded;
  return { token: generateToken(payload) };
};
