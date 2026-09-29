// src/modules/displays/displays.service.js
// FIX: Per-display storage now uses media_files.file_size_mb (accurate, not filename matching)
import { executeQuery } from '../../config/database.js';
import { hashPassword } from '../../utils/hash.js';
import eventBus         from '../../events/eventBus.js';
import { publish }      from '../../config/mqtt.js';
import { tvTopic }      from '../../constants/mqttConstants.js';
import { logActivity }  from '../../utils/activityLog.js';

// ACCURATE: Sum file sizes from media_files where display_id matches via media_content
const MEDIA_STORAGE_SUBQUERY = `
  COALESCE((
    SELECT SUM(mf.file_size_mb)
    FROM media_content mc
    JOIN media_files mf ON mf.media_content_id = mc.id
    WHERE mc.display_id = d.id AND mc.is_published = 1
  ), 0) AS media_storage_mb
`;

export const getDisplays = async (dbName, clientId, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM displays d WHERE d.client_id = ?', [clientId], dbName);
  const rows = await executeQuery(
    `SELECT d.id, d.display_name, d.display_number, d.status,
            d.last_heartbeat, d.volume_level, d.storage_available,
            d.temperature, d.temperature_status, d.uptime_today_minutes,
            d.content_loops_today, d.total_play_time_min, d.created_at,
            ${MEDIA_STORAGE_SUBQUERY}
     FROM displays d WHERE d.client_id = ? ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [clientId, limit, offset], dbName
  );
  return { rows, total };
};

export const getDisplayById = async (id, dbName) => {
  const rows = await executeQuery(
    `SELECT d.*, ${MEDIA_STORAGE_SUBQUERY} FROM displays d WHERE d.id = ?`, [id], dbName
  );
  const d = Array.isArray(rows) ? rows[0] : rows;
  if (!d) throw Object.assign(new Error('Display not found'), { statusCode:404, isOperational:true });
  return d;
};

export const getDisplayStatus = async (id, dbName) => {
  const rows = await executeQuery(
    `SELECT d.id, d.display_number, d.status, d.last_heartbeat, d.volume_level,
            d.storage_available, d.temperature, d.temperature_status,
            d.uptime_today_minutes, d.content_loops_today, d.total_play_time_min,
            ${MEDIA_STORAGE_SUBQUERY}
     FROM displays d WHERE d.id = ?`, [id], dbName
  );
  const d = Array.isArray(rows) ? rows[0] : rows;
  if (!d) throw Object.assign(new Error('Display not found'), { statusCode:404, isOperational:true });
  return d;
};

export const getDisplaysByLine = async (lineId, dbName, clientId) =>
  executeQuery(
    `SELECT d.id, d.display_name, d.display_number, d.status,
            d.last_heartbeat, d.volume_level, d.storage_available,
            d.temperature, d.temperature_status, d.uptime_today_minutes,
            d.content_loops_today, d.total_play_time_min, d.created_at,
            ${MEDIA_STORAGE_SUBQUERY}
     FROM displays d
     JOIN production_line_displays pld ON pld.display_id = d.id
     WHERE pld.production_line_id = ?
     ORDER BY d.display_number`,
    [lineId], dbName
  );

export const getDisplayLimit = async (clientId, dbName) => {
  const clientRows = await executeQuery(
    'SELECT devices_required, total_storage_gb, used_storage_gb FROM clients WHERE id = ?', [clientId], 'master'
  );
  const client = Array.isArray(clientRows) ? clientRows[0] : clientRows;
  const countRows = await executeQuery('SELECT COUNT(*) AS cnt FROM displays WHERE client_id = ?', [clientId], dbName);
  const current = Number(Array.isArray(countRows) ? (countRows[0]?.cnt||0) : 0);
  return { current, max: client?.devices_required||0, canAdd: current < (client?.devices_required||0) };
};

export const createDisplay = async ({ display_name, display_number, display_password }, dbName, clientId) => {
  const clientRows = await executeQuery(
    'SELECT devices_required, total_storage_gb, used_storage_gb FROM clients WHERE id = ?', [clientId], 'master'
  );
  const client = Array.isArray(clientRows) ? clientRows[0] : clientRows;
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode:404, isOperational:true });
  const countRows = await executeQuery('SELECT COUNT(*) AS cnt FROM displays WHERE client_id = ?', [clientId], dbName);
  const currentCount = Number(Array.isArray(countRows) ? (countRows[0]?.cnt||0) : 0);
  if (currentCount >= client.devices_required)
    throw Object.assign(new Error(`Display limit reached (${currentCount}/${client.devices_required}).`), { statusCode:403, isOperational:true });
  const existRows = await executeQuery(
    'SELECT id, display_name FROM displays WHERE display_number = ? AND client_id = ?', [display_number, clientId], dbName
  );
  if (Array.isArray(existRows) && existRows[0])
    throw Object.assign(new Error(`Display number "${display_number}" already used.`), { statusCode:409, isOperational:true });
  const hashed = await hashPassword(display_password);
  const res = await executeQuery(
    'INSERT INTO displays (client_id, display_name, display_number, display_password, volume_level) VALUES (?,?,?,?,?)',
    [clientId, display_name, display_number, hashed, 50], dbName
  );
  const display = await getDisplayById(res.insertId, dbName);
  eventBus.emit('display.created', { display, dbName, clientId, plainPassword: display_password });
  await logActivity({ dbName, userId: clientId, username: 'admin', actionType:'create_display',
    entityType:'display', entityId:display.id, detail:`Created display "${display_name}" (${display_number})` });
  return display;
};

export const updateDisplay = async (id, { display_name }, dbName) => {
  if (!display_name) throw Object.assign(new Error('display_name required'), { statusCode:400, isOperational:true });
  await executeQuery('UPDATE displays SET display_name = ? WHERE id = ?', [display_name, id], dbName);
  return getDisplayById(id, dbName);
};

export const setVolume = async (id, volume_level, dbName) => {
  await executeQuery('UPDATE displays SET volume_level = ? WHERE id = ?', [volume_level, id], dbName);
  try { await publish(tvTopic(id), JSON.stringify({ type:'volume', volume:volume_level }), { retain:true }); } catch {}
  return { display_id: Number(id), volume_level };
};

export const resetDisplayPassword = async (id, new_password, dbName) => {
  const display = await getDisplayById(id, dbName);
  const hashed  = await hashPassword(new_password);
  await executeQuery('UPDATE displays SET display_password = ? WHERE id = ?', [hashed, id], dbName);
  await executeQuery(
    'INSERT INTO users (username, password, is_active) VALUES (?,?,1) ON DUPLICATE KEY UPDATE password=VALUES(password), is_active=1',
    [`display_${display.display_number}`, hashed], dbName
  );
  return { display_id:Number(id), display_number:display.display_number, message:'Password updated' };
};

export const deleteDisplay = async (id, dbName, clientId) => {
  const display = await getDisplayById(id, dbName);
  await executeQuery('DELETE FROM displays WHERE id = ?', [id], dbName);
  eventBus.emit('display.deleted', { display, dbName, clientId });
  await logActivity({ dbName, userId:clientId, username:'admin', actionType:'delete_display',
    entityType:'display', entityId:id, detail:`Deleted display "${display.display_name}" (${display.display_number})` });
  return { message:`Display ${display.display_number} deleted` };
};

export const getDisplayErrors = async (id, dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM display_error_logs WHERE display_id = ?', [id], dbName);
  const rows = await executeQuery(
    'SELECT * FROM display_error_logs WHERE display_id = ? ORDER BY occurred_at DESC LIMIT ? OFFSET ?',
    [id, limit, offset], dbName
  );
  return { rows, total };
};
