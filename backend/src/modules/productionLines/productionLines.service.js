// src/modules/productionLines/productionLines.service.js
import { executeQuery } from '../../config/database.js';
import { publish }      from '../../config/mqtt.js';
import logger           from '../../utils/logger.js';

export const getLines = async (dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM production_lines', [], dbName);
  const rows = await executeQuery(
    `SELECT pl.*,
            GROUP_CONCAT(d.display_number ORDER BY d.id SEPARATOR ',') AS display_numbers
     FROM production_lines pl
     LEFT JOIN production_line_displays pld ON pld.production_line_id = pl.id
     LEFT JOIN displays d ON d.id = pld.display_id
     GROUP BY pl.id
     ORDER BY pl.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset], dbName
  );
  return { rows: Array.isArray(rows) ? rows : [], total };
};

export const getLineById = async (id, dbName) => {
  const rows = await executeQuery(
    `SELECT pl.*,
            GROUP_CONCAT(d.display_number ORDER BY d.id SEPARATOR ',') AS display_numbers
     FROM production_lines pl
     LEFT JOIN production_line_displays pld ON pld.production_line_id = pl.id
     LEFT JOIN displays d ON d.id = pld.display_id
     WHERE pl.id = ?
     GROUP BY pl.id`,
    [id], dbName
  );
  const line = Array.isArray(rows) ? rows[0] : rows;
  if (!line) return null;
  return line;
};

export const createLine = async ({ production_line_name, description }, dbName, userId, clientId) => {
  const res = await executeQuery(
    'INSERT INTO production_lines (client_id, production_line_name, description, created_by, active_line) VALUES (?,?,?,?,1)',
    [clientId, production_line_name, description || null, userId || null], dbName
  );
  return { id: res.insertId, production_line_name, description, active_line: 1 };
};

export const updateLine = async (id, body, dbName) => {
  const { production_line_name, description, tv_order, active_line } = body;
  // Build dynamic update to avoid undefined params
  const fields = [];
  const vals   = [];
  if (production_line_name !== undefined) { fields.push('production_line_name=?'); vals.push(production_line_name); }
  if (description           !== undefined) { fields.push('description=?');           vals.push(description || null); }
  if (tv_order              !== undefined) { fields.push('tv_order=?');              vals.push(Array.isArray(tv_order) ? JSON.stringify(tv_order) : tv_order); }
  if (active_line           !== undefined) { fields.push('active_line=?');           vals.push(active_line ? 1 : 0); }
  if (fields.length === 0) return getLineById(id, dbName);
  vals.push(id);
  await executeQuery(`UPDATE production_lines SET ${fields.join(', ')} WHERE id=?`, vals, dbName);
  return getLineById(id, dbName);
};

export const deleteLine = async (id, dbName) => {
  await executeQuery('DELETE FROM production_line_displays WHERE production_line_id=?', [id], dbName);
  await executeQuery('DELETE FROM production_lines WHERE id=?', [id], dbName);
  return { message: 'Production line deleted' };
};

// ── Toggle active/inactive ──────────────────────────────────────────────────
// FIX: When line goes inactive → unpublish all content + fire MQTT to all TVs
//      When line goes active   → republish all content + fire MQTT to all TVs
export const toggleActiveLine = async (id, dbName) => {
  const line = await getLineById(id, dbName);
  if (!line) throw Object.assign(new Error('Production line not found'), { statusCode:404, isOperational:true });

  const newActive = line.active_line ? 0 : 1;

  // 1. Update the line status
  await executeQuery(
    'UPDATE production_lines SET active_line=? WHERE id=?',
    [newActive, id], dbName
  );

  // 2. Update all media_content for this line
  await executeQuery(
    'UPDATE media_content SET is_published=? WHERE production_line_id=?',
    [newActive, id], dbName
  );

  // 3. Get all display IDs in this line from tv_order
  let tvIds = [];
  try {
    tvIds = JSON.parse(line.tv_order || '[]').filter(Boolean).map(Number);
  } catch {}

  // Also get from production_line_displays as fallback
  if (tvIds.length === 0) {
    const plds = await executeQuery(
      'SELECT display_id FROM production_line_displays WHERE production_line_id=?',
      [id], dbName
    );
    tvIds = (Array.isArray(plds) ? plds : []).map(r => r.display_id);
  }

  // 4. Fire MQTT to each TV immediately
  const action = newActive ? 'resumed' : 'stopped';
  for (const tvId of tvIds) {
    try {
      await publish(`tv/${tvId}/command`, 'true', { retain: false });
      logger.info(`[Line ${id}] MQTT fired → tv/${tvId} (${action})`);
    } catch (err) {
      logger.warn(`[Line ${id}] MQTT failed for tv/${tvId}: ${err.message}`);
    }
  }

  logger.info(`[Line ${id}] "${line.production_line_name}" → ${newActive ? 'ACTIVE' : 'INACTIVE'} (${tvIds.length} TVs notified)`);

  return {
    id,
    active_line:            newActive,
    production_line_name:   line.production_line_name,
    tvs_notified:           tvIds.length,
    action,
  };
};

// ── Display management ──────────────────────────────────────────────────────
export const addDisplayToLine = async (lineId, displayId, dbName) => {
  await executeQuery(
    'INSERT IGNORE INTO production_line_displays (production_line_id, display_id) VALUES (?,?)',
    [lineId, displayId], dbName
  );
  return { line_id: lineId, display_id: displayId };
};

export const removeDisplayFromLine = async (lineId, displayId, dbName) => {
  await executeQuery(
    'DELETE FROM production_line_displays WHERE production_line_id=? AND display_id=?',
    [lineId, displayId], dbName
  );
  return { message: 'Display removed from line' };
};

export const getDisplaysByLine = async (lineId, dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery(
    'SELECT COUNT(*) as total FROM displays d JOIN production_line_displays pld ON pld.display_id = d.id WHERE pld.production_line_id = ?',
    [lineId], dbName
  );
  const rows = await executeQuery(
    `SELECT d.*, pld.production_line_id
     FROM displays d
     JOIN production_line_displays pld ON pld.display_id = d.id
     WHERE pld.production_line_id = ?
     ORDER BY d.display_number
     LIMIT ? OFFSET ?`,
    [lineId, limit, offset], dbName
  );
  return { rows: Array.isArray(rows) ? rows : [], total };
};

// Returns assigned displays with their production line name
// Frontend expects: { assigned: [{ display_id, production_line_name }] }
export const getAssignedDisplayIds = async (dbName) => {
  const rows = await executeQuery(
    `SELECT pld.display_id, pl.production_line_name
     FROM production_line_displays pld
     JOIN production_lines pl ON pl.id = pld.production_line_id`,
    [], dbName
  );
  return { assigned: Array.isArray(rows) ? rows : [] };
};

// Remove all displays from a line (used before re-adding)
export const clearLineDisplays = async (lineId, dbName) => {
  await executeQuery(
    'DELETE FROM production_line_displays WHERE production_line_id=?',
    [lineId], dbName
  );
};