import { logActivity } from '../../utils/activityLog.js';
// src/modules/users/users.service.js
// Employee CRUD — runs on client DB

import { executeQuery, executeTransaction } from '../../config/database.js';
import { hashPassword }                     from '../../utils/hash.js';

// ── List all employees (paginated, optional search + type filter) ─────────────
export const getAllUsers = async (dbName, { limit, offset, search = '', type = '' } = {}) => {
  const joins = `FROM users u
     LEFT JOIN employee_users eu ON eu.user_id = u.id
     LEFT JOIN production_lines pl ON pl.id = eu.production_line_id
     LEFT JOIN displays d ON d.id = eu.assigned_display_id`;

  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(u.username LIKE ? OR u.email LIKE ? OR pl.production_line_name LIKE ? OR d.display_number LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (type === 'employee') conditions.push("u.username NOT LIKE 'display\\_%'");
  else if (type === 'display') conditions.push("u.username LIKE 'display\\_%'");
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await executeQuery(`SELECT COUNT(*) as total ${joins} ${where}`, params, dbName);

  const rows = await executeQuery(
    `SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.last_login,
            eu.production_line_id, pl.production_line_name,
            eu.assigned_display_id, d.display_number,
            eu.has_delete_permission, eu.created_by
     ${joins} ${where}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
    dbName
  );

  return { rows, total };
};

// ── Get single user ───────────────────────────────────────────────────────────
export const getUserById = async (id, dbName) => {
  const [user] = await executeQuery(
    `SELECT u.*, eu.production_line_id, pl.production_line_name,
            eu.assigned_display_id, d.display_number, eu.has_delete_permission
     FROM users u
     LEFT JOIN employee_users eu ON eu.user_id = u.id
     LEFT JOIN production_lines pl ON pl.id = eu.production_line_id
     LEFT JOIN displays d ON d.id = eu.assigned_display_id
     WHERE u.id = ?`,
    [id],
    dbName
  );
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404, isOperational: true });
  return user;
};

// ── Create employee ───────────────────────────────────────────────────────────
export const createUser = async (data, dbName, createdBy) => {
  const { username, password, email, production_line_id, assigned_display_id, has_delete_permission = false } = data;

  // Multiple employees allowed per production line — no restriction

  // Check username unique in this DB
  const [existing] = await executeQuery('SELECT id FROM users WHERE username = ?', [username], dbName);
  if (existing) throw Object.assign(new Error('Username already exists'), { statusCode: 409, isOperational: true });

  const hashedPw = await hashPassword(password);

  const userId = await executeTransaction(async (conn) => {
    const [res] = await conn.execute(
      'INSERT INTO users (username, password, email) VALUES (?,?,?)',
      [username, hashedPw, email || null]
    );
    const uid = res.insertId;

    await conn.execute(
      `INSERT INTO employee_users
         (user_id, production_line_id, assigned_display_id, has_delete_permission, created_by)
       VALUES (?,?,?,?,?)`,
      [uid, production_line_id || null, assigned_display_id || null, has_delete_permission ? 1 : 0, createdBy]
    );

    return uid;
  }, dbName);

  // Register in master user_client_map
  await executeQuery(
    'INSERT IGNORE INTO user_client_map (username, db_name) VALUES (?,?)',
    [username, dbName],
    'master'
  );

  return getUserById(userId, dbName);
};

// ── Update employee ───────────────────────────────────────────────────────────
export const updateUser = async (id, updates, dbName) => {
  const { password, email, production_line_id, assigned_display_id, has_delete_permission, is_active } = updates;

  // Update password
  if (password) {
    const hashed = await hashPassword(password);
    await executeQuery('UPDATE users SET password = ? WHERE id = ?', [hashed, id], dbName);
  }

  // Update email — always update if provided (including setting to null)
  if (email !== undefined) {
    await executeQuery(
      'UPDATE users SET email = ? WHERE id = ?',
      [email || null, id], dbName
    );
  }

  // Update active status
  if (is_active !== undefined)
    await executeQuery('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id], dbName);

  // Update employee_users table
  await executeQuery(
    `UPDATE employee_users
     SET production_line_id    = COALESCE(?, production_line_id),
         assigned_display_id   = COALESCE(?, assigned_display_id),
         has_delete_permission = COALESCE(?, has_delete_permission)
     WHERE user_id = ?`,
    [
      production_line_id  ?? null,
      assigned_display_id ?? null,
      has_delete_permission !== undefined ? (has_delete_permission ? 1 : 0) : null,
      id
    ],
    dbName
  );

  return getUserById(id, dbName);
};

// ── Delete employee ───────────────────────────────────────────────────────────
export const deleteUser = async (id, dbName, deletedBy = 0, deletedByUsername = null) => {
  const user = await getUserById(id, dbName);

  // Cascade handled by FK — deleting user removes employee_users row
  await executeQuery('DELETE FROM users WHERE id = ?', [id], dbName);

  // Clean up master map
  await executeQuery(
    'DELETE FROM user_client_map WHERE username = ? AND db_name = ?',
    [user.username, dbName],
    'master'
  );

  await logActivity({ dbName, userId: deletedBy, username: deletedByUsername || `user_${deletedBy}`, actionType: 'delete_user', entityType: 'user', entityId: id, detail: `Deleted user "${user.username}"` });
  return { message: `User ${user.username} deleted` };
};

// ── Toggle user active status ─────────────────────────────────────────────────
export const toggleUserStatus = async (id, dbName) => {
  await executeQuery('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id], dbName);
  return getUserById(id, dbName);
};

// ── Change password only ──────────────────────────────────────────────────────
export const changeUserPassword = async (id, new_password, dbName) => {
  const hashed = await hashPassword(new_password);
  await executeQuery('UPDATE users SET password = ? WHERE id = ?', [hashed, id], dbName);
  return { user_id: id, message: 'Password changed successfully' };
};
