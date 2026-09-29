// src/utils/activityLog.js
import { executeQuery } from '../config/database.js';
import logger           from './logger.js';

export const logActivity = async ({ dbName, userId, username, actionType, entityType, entityId, detail }) => {
  try {
    await executeQuery(
      `INSERT INTO activity_logs (user_id, username, action_type, entity_type, entity_id, detail)
       VALUES (?,?,?,?,?,?)`,
      [userId, username, actionType, entityType || null, String(entityId || ''), detail || null],
      dbName
    );
  } catch (err) {
    logger.warn(`Activity log failed: ${err.message}`);
  }
};

export const getActivityLog = async (dbName, { limit = 100, offset = 0, search = '', type = '' } = {}) => {
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(username LIKE ? OR detail LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (type) {
    conditions.push('action_type = ?');
    params.push(type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await executeQuery(`SELECT COUNT(*) as total FROM activity_logs ${where}`, params, dbName);
  const rows = await executeQuery(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset], dbName
  );
  return { rows: Array.isArray(rows) ? rows : [], total };
};