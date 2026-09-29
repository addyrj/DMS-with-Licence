// src/modules/notifications/notifications.service.js
import { executeQuery } from '../../config/database.js';

export const createNotification = async ({ title, message, type, target, client_ids }) => {
  const res = await executeQuery(
    `INSERT INTO notifications (title, message, type, target, created_by) VALUES (?,?,?,?,'superadmin')`,
    [title, message, type || 'info', target || 'all'], 'master'
  );
  const notifId = res.insertId;
  if (target === 'specific' && Array.isArray(client_ids) && client_ids.length > 0) {
    for (const cid of client_ids) {
      await executeQuery(
        'INSERT IGNORE INTO notification_targets (notification_id, client_id) VALUES (?,?)',
        [notifId, cid], 'master'
      );
    }
  }
  return getNotificationById(notifId);
};

export const getAllNotifications = async ({ limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM notifications', [], 'master');
  const rows = await executeQuery(
    `SELECT n.*,
            (SELECT COUNT(*) FROM notification_reads nr WHERE nr.notification_id = n.id) AS read_count,
            (SELECT COUNT(*) FROM notification_targets nt WHERE nt.notification_id = n.id) AS target_count
     FROM notifications n ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset], 'master'
  );
  return { rows: Array.isArray(rows) ? rows : [], total };
};

export const getNotificationById = async (id) => {
  const rows = await executeQuery('SELECT * FROM notifications WHERE id = ?', [id], 'master');
  const n = Array.isArray(rows) ? rows[0] : rows;
  if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404, isOperational: true });
  return n;
};

export const deleteNotification = async (id) => {
  await executeQuery('DELETE FROM notifications WHERE id = ?', [id], 'master');
  return { message: 'Notification deleted' };
};

export const getClientNotifications = async (clientId, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery(
    `SELECT COUNT(*) as total FROM notifications n
     WHERE n.target = 'all'
        OR EXISTS (SELECT 1 FROM notification_targets nt WHERE nt.notification_id = n.id AND nt.client_id = ?)`,
    [clientId], 'master'
  );
  const rows = await executeQuery(
    `SELECT n.*,
            CASE WHEN nr.client_id IS NOT NULL THEN 1 ELSE 0 END AS is_read,
            nr.read_at
     FROM notifications n
     LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.client_id = ?
     WHERE n.target = 'all'
        OR EXISTS (SELECT 1 FROM notification_targets nt WHERE nt.notification_id = n.id AND nt.client_id = ?)
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [clientId, clientId, clientId, limit, offset], 'master'
  );
  return { rows: Array.isArray(rows) ? rows : [], total };
};

export const getUnreadCount = async (clientId) => {
  const rows = await executeQuery(
    `SELECT COUNT(*) AS cnt FROM notifications n
     WHERE (n.target = 'all'
        OR EXISTS (SELECT 1 FROM notification_targets nt WHERE nt.notification_id = n.id AND nt.client_id = ?))
       AND NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.client_id = ?)`,
    [clientId, clientId], 'master'
  );
  return Number(Array.isArray(rows) ? rows[0]?.cnt || 0 : 0);
};

export const markAsRead = async (notificationId, clientId) => {
  await executeQuery(
    'INSERT IGNORE INTO notification_reads (notification_id, client_id) VALUES (?,?)',
    [notificationId, clientId], 'master'
  );
  return { notification_id: notificationId, client_id: clientId, read: true };
};

export const markAllRead = async (clientId) => {
  const unread = await executeQuery(
    `SELECT n.id FROM notifications n
     WHERE (n.target = 'all'
        OR EXISTS (SELECT 1 FROM notification_targets nt WHERE nt.notification_id = n.id AND nt.client_id = ?))
       AND NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.client_id = ?)`,
    [clientId, clientId], 'master'
  );
  const ids = Array.isArray(unread) ? unread : [];
  for (const { id } of ids) {
    await executeQuery(
      'INSERT IGNORE INTO notification_reads (notification_id, client_id) VALUES (?,?)',
      [id, clientId], 'master'
    );
  }
  return { marked: ids.length };
};