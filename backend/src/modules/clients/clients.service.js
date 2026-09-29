// src/modules/clients/clients.service.js
import { executeQuery, createDatabase, dropDatabase } from '../../config/database.js';
import { runClientMigrations }   from '../../database/migrationRunner.js';
import { hashPassword }          from '../../utils/hash.js';
import { slugify }               from '../../utils/slugify.js';
import eventBus                  from '../../events/eventBus.js';
import logger                    from '../../utils/logger.js';
import fs                        from 'fs';
import path                      from 'path';
import env                       from '../../config/env.js';

export const getAllClients = async ({ limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM clients', [], 'master');
  const rows = await executeQuery(
    `SELECT id, company_name, database_name, admin_username, admin_email, company_logo,
            contact_phone, requirement, pricing, devices_required,
            total_storage_gb, used_storage_gb, used_media_mb,
            ROUND((used_media_mb / NULLIF(total_storage_gb * 1024, 0)) * 100, 1) AS media_usage_pct,
            subscription_start, subscription_end, is_active,
            perm_delete_content, perm_create_lines, perm_assign_displays,
            perm_upload_files, perm_create_users, created_at, last_login,
            DATEDIFF(subscription_end, CURDATE()) AS days_left
     FROM clients ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset], 'master'
  );
  return { rows, total };
};

export const getClientById = async (id) => {
  const rows = await executeQuery(
    `SELECT *, DATEDIFF(subscription_end, CURDATE()) AS days_left,
            ROUND((used_media_mb / NULLIF(total_storage_gb * 1024, 0)) * 100, 1) AS media_usage_pct
     FROM clients WHERE id = ?`,
    [id], 'master'
  );
  const client = Array.isArray(rows) ? rows[0] : rows;
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404, isOperational: true });
  return client;
};

export const createClient = async (data) => {
  const {
    company_name, admin_username, admin_password, admin_email,
    contact_phone, requirement = 'normal', pricing = 0,
    devices_required = 1, total_storage_gb = 5,
    subscription_days = 30, permissions = {},
  } = data;

  const dbName   = slugify(company_name);
  const hashedPw = await hashPassword(admin_password);
  const subStart = new Date().toISOString().slice(0, 10);
  const subEnd   = new Date(Date.now() + subscription_days * 86400000).toISOString().slice(0, 10);

  const existing = await executeQuery('SELECT id FROM clients WHERE admin_username = ?', [admin_username], 'master');
  if (Array.isArray(existing) && existing.length > 0)
    throw Object.assign(new Error('admin_username already taken'), { statusCode: 409, isOperational: true });

  const existingDb = await executeQuery('SELECT id FROM clients WHERE database_name = ?', [dbName], 'master');
  if (Array.isArray(existingDb) && existingDb.length > 0)
    throw Object.assign(new Error(`Database name "${dbName}" already exists`), { statusCode: 409, isOperational: true });

  const insertResult = await executeQuery(
    `INSERT INTO clients
       (company_name, database_name, admin_username, admin_password, admin_email,
        contact_phone, requirement, pricing, devices_required, total_storage_gb,
        subscription_start, subscription_end,
        perm_delete_content, perm_create_lines, perm_assign_displays,
        perm_upload_files, perm_create_users)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [company_name, dbName, admin_username, hashedPw, admin_email || null,
     contact_phone || null, requirement, pricing, devices_required, total_storage_gb,
     subStart, subEnd,
     permissions.perm_delete_content  ?? 1,
     permissions.perm_create_lines    ?? 1,
     permissions.perm_assign_displays ?? 1,
     permissions.perm_upload_files    ?? 1,
     permissions.perm_create_users    ?? 1],
    'master'
  );
  const clientId = insertResult.insertId;

  await executeQuery('INSERT IGNORE INTO user_client_map (username, db_name) VALUES (?,?)', [admin_username, dbName], 'master');
  await executeQuery(
    `INSERT INTO subscription_logs (client_id, action, plan_days, new_end_date) VALUES (?, 'CREATED', ?, ?)`,
    [clientId, subscription_days, subEnd], 'master'
  );

  try {
    await createDatabase(dbName);
    await runClientMigrations(dbName);
    const adminHashed = await hashPassword(admin_password);
    await executeQuery('INSERT INTO users (username, password, email, is_active) VALUES (?,?,?,1)',
      [admin_username, adminHashed, admin_email || null], dbName);
    fs.mkdirSync(path.join(process.cwd(), env.uploadDir, dbName), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), env.tvfileDir, dbName), { recursive: true });
    logger.info(`✅ Client provisioned: ${company_name} [${dbName}]`);
  } catch (err) {
    logger.error(`❌ Client provisioning failed for [${dbName}]: ${err.message}`);
  }

  return getClientById(clientId);
};

export const updateClient = async (id, updates) => {
  const allowed = [
    'company_name', 'admin_email', 'contact_phone', 'requirement',
    'devices_required', 'total_storage_gb', 'pricing',
    'subscription_start', 'subscription_end',
  ];
  const fields = Object.keys(updates).filter(k => allowed.includes(k) && updates[k] !== undefined && updates[k] !== '');
  if (!fields.length) throw Object.assign(new Error('No valid fields to update'), { statusCode: 400, isOperational: true });

  if (updates.devices_required !== undefined && updates.pricing === undefined) {
    const client     = await getClientById(id);
    const newDevices = Number(updates.devices_required);
    const storage    = Number(updates.total_storage_gb) || client.total_storage_gb;
    const newPrice   = storage * 200;
    fields.push('pricing');
    updates.pricing = newPrice;
    if (!fields.includes('total_storage_gb') && client.total_storage_gb < newDevices) {
      fields.push('total_storage_gb');
      updates.total_storage_gb = newDevices;
    }
  }

  const set = fields.map(f => `${f} = ?`).join(', ');
  await executeQuery(`UPDATE clients SET ${set} WHERE id = ?`, [...fields.map(f => updates[f]), id], 'master');
  return getClientById(id);
};

export const updatePermissions = async (id, perms) => {
  const fields = ['perm_delete_content','perm_create_lines','perm_assign_displays','perm_upload_files','perm_create_users']
    .filter(k => perms[k] !== undefined);
  if (!fields.length) throw Object.assign(new Error('No permission fields provided'), { statusCode: 400, isOperational: true });
  const set = fields.map(f => `${f} = ?`).join(', ');
  await executeQuery(`UPDATE clients SET ${set} WHERE id = ?`, [...fields.map(f => perms[f] ? 1 : 0), id], 'master');
  return getClientById(id);
};

export const toggleClientStatus = async (id) => {
  await executeQuery('UPDATE clients SET is_active = NOT is_active WHERE id = ?', [id], 'master');
  return getClientById(id);
};

export const upgradeStorage = async (id, additional_gb) => {
  const client    = await getClientById(id);
  const newStorage = (client.total_storage_gb || 0) + Number(additional_gb);
  const newPrice   = newStorage * 200;
  await executeQuery('UPDATE clients SET total_storage_gb = ?, pricing = ? WHERE id = ?', [newStorage, newPrice, id], 'master');
  return getClientById(id);
};

// FIX: renewal adds days to current end date (not today) so active plans extend correctly
export const updateSubscription = async (id, days) => {
  const client = await getClientById(id);
  const base   = new Date(client.subscription_end) > new Date()
    ? new Date(client.subscription_end)
    : new Date();
  const newEnd = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
  await executeQuery(
    'UPDATE clients SET subscription_end=?, is_active=1 WHERE id=?',
    [newEnd, id], 'master'
  );
  await executeQuery(
    `INSERT INTO subscription_logs (client_id, action, plan_days, old_end_date, new_end_date)
     VALUES (?, 'RENEWED', ?, ?, ?)`,
    [id, days, client.subscription_end, newEnd], 'master'
  );
  return getClientById(id);
};

export const getSubscriptionLogs = async (id, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM subscription_logs WHERE client_id = ?', [id], 'master');
  const rows = await executeQuery(
    'SELECT * FROM subscription_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [id, limit, offset], 'master'
  );
  return { rows, total };
};

export const deleteClient = async (id) => {
  const client = await getClientById(id);
  await executeQuery('DELETE FROM clients WHERE id = ?', [id], 'master');
  eventBus.emit('client.deleted', { client });
  return { message: `Client ${client.company_name} deleted successfully` };
};

export const updateClientLogo = async (id, logoPath) => {
  await executeQuery('UPDATE clients SET company_logo = ? WHERE id = ?', [logoPath, id], 'master');
  return getClientById(id);
};

export const resetAdminPassword = async (id, newPassword) => {
  const client = await getClientById(id);
  const hashed = await hashPassword(newPassword);
  await executeQuery('UPDATE clients SET admin_password = ? WHERE id = ?', [hashed, id], 'master');
  await executeQuery('UPDATE users SET password = ? WHERE username = ?', [hashed, client.admin_username], client.database_name);
  return { message: 'Password reset successfully' };
};

export const updateProfile = async (clientId, dbName, adminUsername, updates) => {
  const { admin_email, contact_phone } = updates;
  await executeQuery(
    'UPDATE clients SET admin_email = COALESCE(?, admin_email), contact_phone = COALESCE(?, contact_phone) WHERE id = ?',
    [admin_email ?? null, contact_phone ?? null, clientId], 'master'
  );
  if (admin_email) await executeQuery('UPDATE users SET email = ? WHERE username = ?', [admin_email, adminUsername], dbName);
  return getClientById(clientId);
};

export const upgradeDisplays = async (id, additional_displays) => {
  const client     = await getClientById(id);
  const newDevices = (client.devices_required || 0) + Number(additional_displays);
  const newStorage = (client.total_storage_gb || 0) + Number(additional_displays);
  const newPrice   = newStorage * 200;
  await executeQuery('UPDATE clients SET devices_required = ?, total_storage_gb = ?, pricing = ? WHERE id = ?',
    [newDevices, newStorage, newPrice, id], 'master');
  return getClientById(id);
};

export const getClientLinesWithDisplays = async (id) => {
  const client = await getClientById(id);
  const dbName = client.database_name;
  const lines = await executeQuery('SELECT id, production_line_name, description, active_line, created_at FROM production_lines ORDER BY created_at DESC', [], dbName);
  const allDisplays = await executeQuery('SELECT id, display_name, display_number, status, last_heartbeat FROM displays ORDER BY display_number', [], dbName);
  const linesArr    = Array.isArray(lines) ? lines : [];
  const displaysArr = Array.isArray(allDisplays) ? allDisplays : [];
  const assignedIds = new Set();
  const result = [];
  for (const line of linesArr) {
    const pld = await executeQuery('SELECT display_id FROM production_line_displays WHERE production_line_id = ?', [line.id], dbName);
    const ids = (Array.isArray(pld) ? pld : []).map(r => r.display_id);
    ids.forEach(i => assignedIds.add(i));
    result.push({ ...line, displays: displaysArr.filter(d => ids.includes(d.id)) });
  }
  return { lines: result, unassigned: displaysArr.filter(d => !assignedIds.has(d.id)) };
};

export const deleteClientUser = async (clientId, userId) => {
  const client = await getClientById(clientId);
  const rows   = await executeQuery('SELECT username FROM users WHERE id = ?', [userId], client.database_name);
  const user   = Array.isArray(rows) ? rows[0] : rows;
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404, isOperational: true });
  await executeQuery('DELETE FROM users WHERE id = ?', [userId], client.database_name);
  await executeQuery('DELETE FROM user_client_map WHERE username = ? AND db_name = ?', [user.username, client.database_name], 'master');
  return { message: `User "${user.username}" removed` };
};

export const deleteClientDisplay = async (clientId, displayId) => {
  const client  = await getClientById(clientId);
  const rows    = await executeQuery('SELECT * FROM displays WHERE id = ?', [displayId], client.database_name);
  const display = Array.isArray(rows) ? rows[0] : rows;
  if (!display) throw Object.assign(new Error('Display not found'), { statusCode: 404, isOperational: true });
  await executeQuery('DELETE FROM displays WHERE id = ?', [displayId], client.database_name);
  await executeQuery('DELETE FROM user_client_map WHERE username = ? AND db_name = ?', [`display_${display.display_number}`, client.database_name], 'master');
  await executeQuery('UPDATE clients SET used_storage_gb = GREATEST(0, used_storage_gb - 1) WHERE id = ?', [clientId], 'master');
  return { message: `Display "${display.display_number}" removed` };
};
