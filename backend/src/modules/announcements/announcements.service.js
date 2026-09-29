// src/modules/announcements/announcements.service.js
// ISSUE 1: deleteAnnouncement is now HARD DELETE (permanent)
// Backward compatible with missing targeting columns
import { executeQuery } from '../../config/database.js';
import { publish }      from '../../config/mqtt.js';
import logger           from '../../utils/logger.js';

export const getAnnouncements = async (dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM display_announcements', [], dbName);
  try {
    const rows = await executeQuery(
      `SELECT a.*, pl.production_line_name, d.display_name, d.display_number
       FROM display_announcements a
       LEFT JOIN production_lines pl ON pl.id = a.target_line_id
       LEFT JOIN displays d ON d.id = a.target_display_id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset], dbName);
    return { rows: Array.isArray(rows) ? rows : [], total };
  } catch {
    const rows = await executeQuery(
      'SELECT * FROM display_announcements ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset], dbName);
    return { rows: Array.isArray(rows) ? rows : [], total };
  }
};

export const getActiveAnnouncements = async (dbName) => {
  const rows = await executeQuery(
    'SELECT * FROM display_announcements WHERE expires_at > NOW() AND is_active = 1 ORDER BY created_at DESC',
    [], dbName);
  return Array.isArray(rows) ? rows : [];
};

export const createAnnouncement = async ({
  message, type, duration_minutes,
  target_type = 'all', target_line_id = null, target_display_id = null,
}, dbName) => {
  const expiresAt = new Date(Date.now() + duration_minutes * 60 * 1000);
  let res;
  try {
    res = await executeQuery(
      `INSERT INTO display_announcements
         (message, type, duration_minutes, expires_at, is_active, target_type, target_line_id, target_display_id)
       VALUES (?,?,?,?,1,?,?,?)`,
      [message, type, duration_minutes, expiresAt, target_type, target_line_id||null, target_display_id||null], dbName);
  } catch {
    res = await executeQuery(
      'INSERT INTO display_announcements (message, type, duration_minutes, expires_at, is_active) VALUES (?,?,?,?,1)',
      [message, type, duration_minutes, expiresAt], dbName);
  }
  const ann = await getAnnouncementById(res.insertId, dbName);
  const payload = JSON.stringify({ id:ann.id, message, type, duration_minutes, expires_at:expiresAt.toISOString() });
  try {
    if (target_type === 'all') {
      await publish(`announcements/${dbName}`, payload, { retain:true });
      const displays = await executeQuery("SELECT id FROM displays WHERE status='ONLINE'", [], dbName);
      for (const tv of (Array.isArray(displays)?displays:[])) {
        await publish(`tv/${tv.id}/announcement`, payload, { retain:false });
      }
    } else if (target_type === 'line' && target_line_id) {
      const tvs = await executeQuery(
        'SELECT d.id FROM displays d JOIN production_line_displays pld ON pld.display_id=d.id WHERE pld.production_line_id=?',
        [target_line_id], dbName);
      for (const tv of (Array.isArray(tvs)?tvs:[])) {
        await publish(`tv/${tv.id}/announcement`, payload, { retain:false });
      }
    } else if (target_type === 'display' && target_display_id) {
      await publish(`tv/${target_display_id}/announcement`, payload, { retain:false });
    }
  } catch (err) { logger.warn('[Announcement] MQTT failed:', err.message); }
  return { announcement: ann };
};

export const getAnnouncementById = async (id, dbName) => {
  const rows = await executeQuery('SELECT * FROM display_announcements WHERE id=?', [id], dbName);
  return Array.isArray(rows) ? rows[0] : rows;
};

// ISSUE 1: HARD DELETE — permanent removal
export const deleteAnnouncement = async (id, dbName) => {
  await executeQuery('DELETE FROM display_announcements WHERE id = ?', [id], dbName);
  return { message: 'Announcement permanently deleted' };
};
