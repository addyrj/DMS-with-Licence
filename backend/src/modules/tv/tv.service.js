// src/modules/tv/tv.service.js
import { executeQuery }    from '../../config/database.js';
import { comparePassword } from '../../utils/hash.js';
import env                 from '../../config/env.js';

// ── TV Login ─────────────────────────────────────────────────
export const tvLogin = async ({ username, password, db_name: rawDbName }) => {
  const displayNumber = username.replace(/^display_/, '');
  let dbName = (rawDbName || '').trim();

  // Auto-detect dbName when not provided — search all active clients
  if (!dbName) {
    const allClients = await executeQuery(
      'SELECT id, database_name FROM clients WHERE is_active = 1', [], 'master'
    );
    for (const c of (Array.isArray(allClients) ? allClients : [])) {
      try {
        const [d] = await executeQuery(
          'SELECT id FROM displays WHERE display_number = ?', [displayNumber], c.database_name
        );
        if (d) { dbName = c.database_name; break; }
      } catch (_) {}
    }
    if (!dbName)
      throw Object.assign(
        new Error('Display not found. Try providing the database name manually.'),
        { statusCode: 404, isOperational: true }
      );
  }

  const db_name = dbName;

  const [client] = await executeQuery(
    'SELECT id, is_active, subscription_end FROM clients WHERE database_name = ?',
    [db_name], 'master'
  );
  if (!client || !client.is_active)
    throw Object.assign(new Error('Client inactive'), { statusCode: 403, isOperational: true });

  const today = new Date().toISOString().slice(0, 10);
  if (client.subscription_end < today)
    throw Object.assign(new Error('Subscription expired'), { statusCode: 403, isOperational: true });

  const [display] = await executeQuery(
    'SELECT * FROM displays WHERE display_number = ?',
    [displayNumber], db_name
  );
  if (!display)
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });

  // Password is stored in users table (hashed by onDisplayCreated)
  // Try both username formats: display_jiotest and jiotest
  const [user] = await executeQuery(
    'SELECT * FROM users WHERE (username = ? OR username = ?) AND is_active = 1',
    [`display_${displayNumber}`, displayNumber], db_name
  );

  if (!user)
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });

  const valid = await comparePassword(password, user.password);
  if (!valid)
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true });

  if (user) {
    await executeQuery('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id], db_name);
  }
  await executeQuery(
    "UPDATE displays SET status = 'ONLINE', last_heartbeat = NOW() WHERE id = ?",
    [display?.id], db_name
  );

  const token = user ? (await import('../../utils/jwt.js')).generateToken({
    id: user.id, username: user.username, role: 'DISPLAY',
    db_name, client_id: client.id,
  }) : undefined;

  return {
    success:               true,
    tv_id:                 display?.id,
    tv_name:               display?.display_number,
    volume:                display?.volume_level ?? 0,
    loop_interval_minutes: display?.loop_interval_minutes ?? 15,
    playlist_mode:         display?.playlist_mode ?? 'loop',
    db_name,
    client_id:             client.id,
    token,
  };
};

// ── Normalize file path to full URL ──────────────────────────
const toFileUrl = (filePath) => {
  const clean = (filePath || '')
    .replace(/^\/+/, '')
    .replace(/^upload\//, 'uploads/');
  return `${env.baseUrl}/${clean}`;
};

// ── Get TV files ─────────────────────────────────────────────
// Two paths:
//   1. Production line → media_content → media_files  (publish via admin)
//   2. content_assignments → media_bucket             (assign via employee)
export const getTvFiles = async (tv_id, db_name) => {

  // Path 1: check production line assignment
  const [activeLine] = await executeQuery(
    `SELECT pl.id FROM production_lines pl
     JOIN production_line_displays pld ON pld.production_line_id = pl.id
     WHERE pld.display_id = ? LIMIT 1`,
    [tv_id], db_name
  );

  if (activeLine) {
    const rows = await executeQuery(
      `SELECT mf.id, mf.file_path, mf.file_name, mf.sequence_order,
              mc.duration, mc.loop_interval_minutes, mc.playlist_mode,
              mc.updated_at AS content_updated,
              mf.updated_at AS file_updated,
              d.volume_level, d.updated_at AS display_updated
       FROM media_content mc
       JOIN media_files mf ON mf.media_content_id = mc.id
       JOIN displays d     ON d.id = mc.display_id
       WHERE mc.display_id = ? AND mc.production_line_id = ? AND mc.is_published = 1
       ORDER BY mf.sequence_order ASC`,
      [tv_id, activeLine.id], db_name
    );

    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`[getTvFiles] display ${tv_id} → ${rows.length} files via production line`);
      return rows.map(f => ({
        id:                    f.id,
        tv_id,
        file_url:              toFileUrl(f.file_path),
        file_name:             f.file_name,
        duration:              f.duration,
        sequence:              f.sequence_order,
        volume:                f.volume_level,
        loop_interval_minutes: f.loop_interval_minutes ?? 15,
        playlist_mode:         f.playlist_mode ?? 'loop',
        last_updated: new Date(
          Math.max(
            new Date(f.content_updated),
            new Date(f.file_updated),
            new Date(f.display_updated)
          )
        ).toLocaleString('en-IN', {
          day:'2-digit', month:'2-digit', year:'numeric',
          hour:'2-digit', minute:'2-digit', second:'2-digit',
        }),
      }));
    }
  }

  // Path 2: content_assignments fallback (employee direct assignment)
  console.log(`[getTvFiles] display ${tv_id} → trying content_assignments`);
  const assigned = await executeQuery(
    `SELECT mb.id, mb.file_path, mb.file_name, mb.sequence,
            COALESCE(ca.duration_seconds, 10) AS duration,
            d.volume_level,
            ca.updated_at AS content_updated,
            mb.updated_at AS file_updated,
            d.updated_at  AS display_updated
     FROM content_assignments ca
     JOIN media_bucket mb ON mb.id = ca.media_bucket_id
     JOIN displays d      ON d.id  = ca.display_id
     WHERE ca.display_id = ? AND ca.is_active = 1
       AND ca.start_date <= CURDATE() AND ca.end_date >= CURDATE()
     ORDER BY mb.sequence ASC`,
    [tv_id], db_name
  );

  if (!Array.isArray(assigned) || assigned.length === 0) {
    console.log(`[getTvFiles] display ${tv_id} — no files in either path`);
    return [];
  }

  console.log(`[getTvFiles] display ${tv_id} → ${assigned.length} files via assignments`);
  return assigned.map(f => ({
    id:                    f.id,
    tv_id,
    file_url:              toFileUrl(f.file_path),
    file_name:             f.file_name,
    duration:              f.duration,
    sequence:              f.sequence || 1,
    volume:                f.volume_level || 50,
    loop_interval_minutes: 15,
    playlist_mode:         'loop',
    last_updated:          new Date().toLocaleString('en-IN'),
  }));
};

// ── Heartbeat ────────────────────────────────────────────────
export const updateStatus = async ({
  tv_id, status, db_name,
  temperature, uptime_minutes, content_loops,
}) => {
  let tempStatus = null;
  if (temperature) {
    const t = parseFloat(temperature);
    tempStatus = t > 80 ? 'critical' : t > 60 ? 'warning' : 'normal';
  }

  // Only update columns that exist in the base schema
  // Extra metric columns (play_time_today_minutes etc.) are added by migration
  try {
    await executeQuery(
      `UPDATE displays
       SET status = ?, last_heartbeat = NOW(),
           temperature        = COALESCE(?, temperature),
           temperature_status = COALESCE(?, temperature_status)
       WHERE id = ?`,
      [status, temperature ?? null, tempStatus, tv_id],
      db_name
    );
  } catch (e) {
    // Fallback: minimal update — just status + heartbeat
    await executeQuery(
      'UPDATE displays SET status = ?, last_heartbeat = NOW() WHERE id = ?',
      [status, tv_id], db_name
    );
  }
  return { success: true };
};

// ── Storage report ───────────────────────────────────────────
export const saveStorageReport = async ({ tv_id, db_name, storage_available }) => {
  await executeQuery(
    'UPDATE displays SET storage_available = ?, last_heartbeat = NOW() WHERE id = ?',
    [storage_available, tv_id], db_name
  );
  return { success: true };
};

// ── Error log ────────────────────────────────────────────────
export const logError = async ({ tv_id, db_name, error_type, error_message }) => {
  await executeQuery(
    `INSERT INTO display_error_logs (display_id, error_type, error_message, created_at)
     VALUES (?, ?, ?, NOW())`,
    [tv_id, error_type, error_message], db_name
  );
  return { success: true };
};

// ── Volume ───────────────────────────────────────────────────
export const getDisplayVolume = async (tv_id, db_name) => {
  const [d] = await executeQuery(
    'SELECT volume_level FROM displays WHERE id = ?', [tv_id], db_name
  );
  return { volume: d?.volume_level ?? 50 };
};

// ── Download complete — auto-resolve production_line_id ──────
export const markDownloadComplete = async (tv_id, production_line_id, db_name) => {
  let lineId = production_line_id;
  if (!lineId) {
    const [row] = await executeQuery(
      `SELECT pld.production_line_id
       FROM production_line_displays pld
       JOIN production_lines pl ON pl.id = pld.production_line_id
       WHERE pld.display_id = ? ORDER BY pl.active_line DESC LIMIT 1`,
      [tv_id], db_name
    );
    lineId = row?.production_line_id;
  }
  if (!lineId) return { message: 'No production line found' };

  await executeQuery(
    `UPDATE publish_status SET status = 'completed', updated_at = NOW()
     WHERE display_id = ? AND production_line_id = ?`,
    [tv_id, lineId], db_name
  );
  console.log(`[downloadComplete] tv_id=${tv_id} → lineId=${lineId} db=${db_name}`);
  return { success: true, message: 'Download marked complete' };
};

// ── Stats ────────────────────────────────────────────────────
export const getDisplayStats = async (tv_id, db_name) => {
  const [d] = await executeQuery(
    `SELECT id, display_number, display_name, status, volume_level,
            temperature, temperature_status, uptime_today_minutes,
            content_loops_today, storage_available, last_heartbeat
     FROM displays WHERE id = ?`,
    [tv_id], db_name
  );
  return { display: d || null };
};

