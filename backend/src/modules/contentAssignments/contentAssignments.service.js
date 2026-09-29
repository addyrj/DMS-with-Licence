// src/modules/contentAssignments/contentAssignments.service.js
// FIX: Fire MQTT after createAssignment so TV syncs immediately
// This was missing — TV never got notified about new direct assignments
import { executeQuery }  from '../../config/database.js';
import { publish }       from '../../config/mqtt.js';
import { tvTopic }       from '../../constants/mqttConstants.js';
import logger            from '../../utils/logger.js';

export const getAssignments = async (dbName, userId = null, { limit, offset } = {}) => {
  const where  = userId ? 'WHERE ca.created_by = ?' : '';
  const params = userId ? [userId] : [];

  const [{ total }] = await executeQuery(`SELECT COUNT(*) as total FROM content_assignments ca ${where}`, params, dbName);

  const rows = await executeQuery(
    `SELECT ca.id, ca.is_active, ca.created_at, ca.duration_seconds, ca.created_by,
            mb.id AS media_bucket_id, mb.file_name, mb.file_type, mb.file_size_mb, mb.folder_name,
            d.id AS display_id, d.display_number, d.display_name, d.status AS display_status
     FROM content_assignments ca
     JOIN media_bucket mb ON mb.id = ca.media_bucket_id
     JOIN displays d      ON d.id  = ca.display_id
     ${where}
     ORDER BY ca.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset], dbName
  );
  return { rows, total };
};

export const getAssignmentsByDisplay = async (displayId, dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery(
    `SELECT COUNT(*) as total FROM content_assignments ca
     WHERE ca.display_id = ? AND ca.is_active = 1
       AND ca.start_date <= CURDATE() AND ca.end_date >= CURDATE()`,
    [displayId], dbName
  );
  const rows = await executeQuery(
    `SELECT ca.*, mb.file_name, mb.file_type, mb.file_path, mb.file_size_mb
     FROM content_assignments ca
     JOIN media_bucket mb ON mb.id = ca.media_bucket_id
     WHERE ca.display_id = ? AND ca.is_active = 1
       AND ca.start_date <= CURDATE() AND ca.end_date >= CURDATE()
     ORDER BY ca.created_at DESC
     LIMIT ? OFFSET ?`,
    [displayId, limit, offset], dbName
  );
  return { rows, total };
};

export const getAssignmentById = async (id, dbName) => {
  const rows = await executeQuery(
    `SELECT ca.*, mb.file_name, mb.file_type, d.display_number, d.id AS display_id
     FROM content_assignments ca
     JOIN media_bucket mb ON mb.id = ca.media_bucket_id
     JOIN displays d      ON d.id  = ca.display_id
     WHERE ca.id = ?`,
    [id], dbName
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw Object.assign(new Error('Assignment not found'), { statusCode: 404, isOperational: true });
  return row;
};

export const createAssignment = async (
  { media_bucket_id, display_id, display_ids, duration_seconds },
  dbName, createdBy
) => {
  const sDate = new Date().toISOString().slice(0, 10);
  const eDate = '2099-12-31';
  const dur = duration_seconds && Number(duration_seconds) > 0 ? Number(duration_seconds) : null;

  const targets = display_ids?.length ? display_ids : display_id ? [display_id] : [];
  if (targets.length === 0)
    throw Object.assign(new Error('display_id or display_ids required'), { statusCode: 400, isOperational: true });

  const mediaRows = await executeQuery('SELECT id FROM media_bucket WHERE id = ?', [media_bucket_id], dbName);
  if (!Array.isArray(mediaRows) || !mediaRows[0])
    throw Object.assign(new Error('Media file not found'), { statusCode: 404, isOperational: true });

  const created = [];
  for (const did of targets) {
    const dispRows = await executeQuery('SELECT id FROM displays WHERE id = ?', [did], dbName);
    if (!Array.isArray(dispRows) || !dispRows[0]) continue;

    const res = await executeQuery(
      `INSERT INTO content_assignments
         (media_bucket_id, display_id, start_date, end_date, is_active, created_by, duration_seconds)
       VALUES (?,?,?,?,1,?,?)`,
      [media_bucket_id, did, sDate, eDate, createdBy, dur], dbName
    );
    const asg = await getAssignmentById(res.insertId, dbName);
    created.push(asg);

    // KEY FIX: Fire MQTT so TV triggers a sync immediately
    // Without this, TV only gets new content on next restart or manual sync
    try {
      await publish(tvTopic(did), 'true', { retain: false });
      logger.info(`[Assignment] MQTT sync triggered for display ${did}`);
    } catch (err) {
      logger.warn(`[Assignment] MQTT trigger failed for display ${did}: ${err.message}`);
    }
  }

  return targets.length === 1 ? { assignment: created[0] } : { assignments: created };
};

export const updateAssignment = async (id, { is_active, duration_seconds }, dbName) => {
  const dur = duration_seconds !== undefined
    ? (Number(duration_seconds) > 0 ? Number(duration_seconds) : null)
    : undefined;
  await executeQuery(
    `UPDATE content_assignments
     SET is_active = COALESCE(?, is_active),
         duration_seconds = COALESCE(?, duration_seconds)
     WHERE id = ?`,
    [is_active !== undefined ? (is_active ? 1 : 0) : null, dur !== undefined ? dur : null, id],
    dbName
  );
  return getAssignmentById(id, dbName);
};

export const toggleAssignment = async (id, dbName) => {
  await executeQuery('UPDATE content_assignments SET is_active = NOT is_active WHERE id = ?', [id], dbName);
  return getAssignmentById(id, dbName);
};

export const deleteAssignment = async (id, dbName) => {
  await getAssignmentById(id, dbName);
  await executeQuery('DELETE FROM content_assignments WHERE id = ?', [id], dbName);
  return { message: 'Assignment deleted' };
};
