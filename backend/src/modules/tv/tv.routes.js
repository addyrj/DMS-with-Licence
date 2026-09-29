// src/modules/tv/tv.routes.js
// UPDATED: Adds /api/tv/announcements/:tv_id endpoint
// FIX D: file_url built from req.protocol + req.get('host') — correct regardless of BASE_URL in .env

import { Router }       from 'express';
import asyncHandler     from '../../utils/asyncHandler.js';
import { executeQuery } from '../../config/database.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import jwt              from 'jsonwebtoken';
import env              from '../../config/env.js';

const router = Router();

// ── POST /api/tv/login ──────────────────────────────────────────────────────
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password, db_name } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  let dbName = db_name;
  if (!dbName) {
    const maps = await executeQuery(
      'SELECT db_name FROM user_client_map WHERE username = ?', [username], 'master'
    );
    const map = Array.isArray(maps) ? maps[0] : maps;
    if (!map) return res.status(401).json({ error: 'Display not found' });
    dbName = map.db_name;
  }

  const clients = await executeQuery(
    'SELECT id, is_active FROM clients WHERE database_name = ?', [dbName], 'master'
  );
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client || !client.is_active)
    return res.status(403).json({ error: 'Client inactive or not found' });

  const users = await executeQuery(
    'SELECT id, username, password, is_active FROM users WHERE username = ?',
    [username], dbName
  );
  const user = Array.isArray(users) ? users[0] : users;
  if (!user || !user.is_active)
    return res.status(401).json({ error: 'Display account not found or inactive' });

  const ok = await comparePassword(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const displays = await executeQuery(
    `SELECT d.*, pl.production_line_name
     FROM displays d
     LEFT JOIN production_line_displays pld ON pld.display_id = d.id
     LEFT JOIN production_lines pl          ON pl.id = pld.production_line_id
     WHERE d.display_number = ?`,
    [username.replace('display_', '')], dbName
  );
  const display = Array.isArray(displays) ? displays[0] : displays;

  const token = jwt.sign(
    { tv_id: display?.id, db_name: dbName, username, client_id: client.id },
    env.jwtSecret,
    { expiresIn: '365d' }
  );

  res.json({
    success: true,
    tv_id:   display?.id || 0,
    tv_name: display?.display_name || username,
    volume:  display?.volume_level || 50,
    loop_interval_minutes: 15,
    playlist_mode: 'sequence',
    db_name: dbName,
    client_id: client.id,
    token,
  });
}));

// ── GET /api/tv/files/:tv_id ─────────────────────────────────────────────────
// FIX D: URL built from request host, not .env BASE_URL
router.get('/files/:tv_id', asyncHandler(async (req, res) => {
  const { tv_id }  = req.params;
  const { db_name } = req.query;
  if (!db_name) return res.status(400).json({ error: 'db_name required' });

  // FIX: Use env.baseUrl (from .env BASE_URL) instead of req.protocol/host
  // Apache proxy sends req.host as 127.0.0.1:5004, producing broken file URLs
  const baseUrl = env.baseUrl || `${req.protocol}://${req.get('host')}`;

  // Path 1: ALL published content for this display (any production line)
  // FIX: removed fragile activeLine LIMIT 1 lookup — display plays all its published content
  {
    const rows = await executeQuery(
      `SELECT mf.id, mf.file_path, mf.file_name, mf.sequence_order,
              mc.duration, mc.doc_duration_seconds, mc.loop_interval_minutes, mc.playlist_mode,
              mc.updated_at AS content_updated, mf.updated_at AS file_updated,
              d.volume_level, d.updated_at AS display_updated
       FROM media_content mc
       JOIN media_files mf ON mf.media_content_id = mc.id
       JOIN displays d     ON d.id = mc.display_id
       WHERE mc.display_id = ? AND mc.is_published = 1
       ORDER BY mf.sequence_order ASC`,
      [tv_id], db_name
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return res.json(rows.map(f => ({
        id:                    f.id,
        tv_id,
        file_url:              `${baseUrl}/${f.file_path.replace(/^\//, '')}`,
        file_name:             f.file_name,
        duration:              f.duration,
        doc_duration_seconds:  f.doc_duration_seconds || 50,
        sequence:              f.sequence_order,
        volume:                f.volume_level || 50,
        loop_interval_minutes: f.loop_interval_minutes ?? 15,
        playlist_mode:         f.playlist_mode ?? 'loop',
        last_updated: new Date(Math.max(
          new Date(f.content_updated), new Date(f.file_updated), new Date(f.display_updated)
        )).toISOString(),
      })));
    }
  }

  // Path 2: content_assignments fallback
  const assigned = await executeQuery(
    `SELECT mb.id, mb.file_path, mb.file_name, mb.sequence,
            COALESCE(ca.duration_seconds, 10) AS duration,
            d.volume_level, ca.updated_at, mb.updated_at AS file_updated, d.updated_at AS display_updated
     FROM content_assignments ca
     JOIN media_bucket mb ON mb.id = ca.media_bucket_id
     JOIN displays d      ON d.id  = ca.display_id
     WHERE ca.display_id = ? AND ca.is_active = 1
       AND ca.start_date <= CURDATE() AND ca.end_date >= CURDATE()
     ORDER BY mb.sequence ASC`,
    [tv_id], db_name
  );

  if (!Array.isArray(assigned) || assigned.length === 0) {
    return res.json([]);
  }

  res.json(assigned.map(f => ({
    id:                   f.id,
    tv_id,
    file_url:             `${baseUrl}/${f.file_path.replace(/^\//, '')}`,
    file_name:            f.file_name,
    duration:             f.duration,
    doc_duration_seconds: 50,
    sequence:             f.sequence || 1,
    volume:               f.volume_level || 50,
    loop_interval_minutes: 15,
    playlist_mode:         'loop',
    last_updated:          new Date().toISOString(),
  })));
}));

// ── POST /api/tv/status ─────────────────────────────────────────────────────
router.post('/status', asyncHandler(async (req, res) => {
  const { tv_id, status, db_name, temperature, uptime_minutes, content_loops } = req.body;
  if (!tv_id || !db_name) return res.status(400).json({ error: 'tv_id and db_name required' });
  try {
    await executeQuery(
      `UPDATE displays SET
         status = ?, last_heartbeat = NOW(),
         temperature = COALESCE(?, temperature),
         uptime_today_minutes = COALESCE(?, uptime_today_minutes),
         content_loops_today  = COALESCE(?, content_loops_today)
       WHERE id = ?`,
      [status || 'ONLINE', temperature || null, uptime_minutes || null, content_loops || null, tv_id],
      db_name
    );
  } catch {
    await executeQuery(
      'UPDATE displays SET status = ?, last_heartbeat = NOW() WHERE id = ?',
      [status || 'ONLINE', tv_id], db_name
    );
  }
  res.json({ success: true });
}));

// ── POST /api/tv/storage ────────────────────────────────────────────────────
router.post('/storage', asyncHandler(async (req, res) => {
  const { tv_id, db_name, storage_available } = req.body;
  if (!tv_id || !db_name) return res.status(400).json({ error: 'tv_id and db_name required' });
  await executeQuery('UPDATE displays SET storage_available = ? WHERE id = ?', [storage_available, tv_id], db_name);
  res.json({ success: true });
}));

// ── POST /api/tv/download-complete ──────────────────────────────────────────
router.post('/download-complete', asyncHandler(async (req, res) => {
  const { tv_id, db_name, production_line_id } = req.body;
  if (!tv_id || !db_name) return res.status(400).json({ error: 'tv_id and db_name required' });
  try {
    await executeQuery('UPDATE displays SET last_heartbeat = NOW() WHERE id = ?', [tv_id], db_name);
    // FIX D: Mark publish_status as completed
    await executeQuery(
      "UPDATE publish_status SET status = 'completed' WHERE display_id = ? AND status = 'pending'",
      [tv_id], db_name
    );
  } catch {}
  res.json({ success: true });
}));

// ── POST /api/tv/error ──────────────────────────────────────────────────────
router.post('/error', asyncHandler(async (req, res) => {
  const { tv_id, db_name, error_type, error_message } = req.body;
  if (!tv_id || !db_name) return res.status(400).json({ success: false });
  try {
    await executeQuery(
      `INSERT INTO display_error_logs (display_id, error_type, error_message)
       VALUES (?, ?, ?)`,
      [tv_id, error_type || 'other', error_message || ''], db_name
    );
  } catch {}
  res.json({ success: true });
}));

// ── GET /api/tv/volume/:tv_id ───────────────────────────────────────────────
router.get('/volume/:tv_id', asyncHandler(async (req, res) => {
  const { tv_id }   = req.params;
  const { db_name } = req.query;
  if (!db_name) return res.status(400).json({ error: 'db_name required' });
  const rows = await executeQuery('SELECT volume_level FROM displays WHERE id = ?', [tv_id], db_name);
  const row  = Array.isArray(rows) ? rows[0] : rows;
  res.json({ volume_level: row?.volume_level ?? 50 });
}));

// ── GET /api/tv/announcements/:tv_id ────────────────────────────────────────
// TV polls this every 60s to get active ticker announcements
router.get('/announcements/:tv_id', asyncHandler(async (req, res) => {
  const { db_name } = req.query;
  if (!db_name) return res.json({ announcements: [] });
  try {
    const rows = await executeQuery(
      `SELECT id, message, type, duration_minutes, expires_at, created_at
       FROM display_announcements
       WHERE expires_at > NOW() AND is_active = 1
       ORDER BY created_at DESC
       LIMIT 5`,
      [], db_name
    );
    res.json({ announcements: Array.isArray(rows) ? rows : [] });
  } catch {
    res.json({ announcements: [] });
  }
}));

export default router;



// // src/modules/tv/tv.routes.js
// // UPDATED: Adds /api/tv/announcements/:tv_id endpoint
// // FIX D: file_url built from req.protocol + req.get('host') — correct regardless of BASE_URL in .env

// import { Router }       from 'express';
// import asyncHandler     from '../../utils/asyncHandler.js';
// import { executeQuery } from '../../config/database.js';
// import { hashPassword, comparePassword } from '../../utils/hash.js';
// import jwt              from 'jsonwebtoken';
// import env              from '../../config/env.js';

// const router = Router();

// // ── POST /api/tv/login ──────────────────────────────────────────────────────
// router.post('/login', asyncHandler(async (req, res) => {
//   const { username, password, db_name } = req.body;
//   if (!username || !password)
//     return res.status(400).json({ error: 'username and password required' });

//   let dbName = db_name;
//   if (!dbName) {
//     const maps = await executeQuery(
//       'SELECT db_name FROM user_client_map WHERE username = ?', [username], 'master'
//     );
//     const map = Array.isArray(maps) ? maps[0] : maps;
//     if (!map) return res.status(401).json({ error: 'Display not found' });
//     dbName = map.db_name;
//   }

//   const clients = await executeQuery(
//     'SELECT id, is_active FROM clients WHERE database_name = ?', [dbName], 'master'
//   );
//   const client = Array.isArray(clients) ? clients[0] : clients;
//   if (!client || !client.is_active)
//     return res.status(403).json({ error: 'Client inactive or not found' });

//   const users = await executeQuery(
//     'SELECT id, username, password, is_active FROM users WHERE username = ?',
//     [username], dbName
//   );
//   const user = Array.isArray(users) ? users[0] : users;
//   if (!user || !user.is_active)
//     return res.status(401).json({ error: 'Display account not found or inactive' });

//   const ok = await comparePassword(password, user.password);
//   if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

//   const displays = await executeQuery(
//     `SELECT d.*, pl.production_line_name
//      FROM displays d
//      LEFT JOIN production_line_displays pld ON pld.display_id = d.id
//      LEFT JOIN production_lines pl          ON pl.id = pld.production_line_id
//      WHERE d.display_number = ?`,
//     [username.replace('display_', '')], dbName
//   );
//   const display = Array.isArray(displays) ? displays[0] : displays;

//   const token = jwt.sign(
//     { tv_id: display?.id, db_name: dbName, username, client_id: client.id },
//     env.jwtSecret,
//     { expiresIn: '365d' }
//   );

//   res.json({
//     success: true,
//     tv_id:   display?.id || 0,
//     tv_name: display?.display_name || username,
//     volume:  display?.volume_level || 50,
//     loop_interval_minutes: 15,
//     playlist_mode: 'sequence',
//     db_name: dbName,
//     client_id: client.id,
//     token,
//   });
// }));

// // ── GET /api/tv/files/:tv_id ─────────────────────────────────────────────────
// // FIX D: URL built from request host, not .env BASE_URL
// router.get('/files/:tv_id', asyncHandler(async (req, res) => {
//   const { tv_id }  = req.params;
//   const { db_name } = req.query;
//   if (!db_name) return res.status(400).json({ error: 'db_name required' });

//   const baseUrl = `${req.protocol}://${req.get('host')}`;

//   // Path 1: ALL published content for this display (any production line)
//   // FIX: removed fragile activeLine LIMIT 1 lookup — display plays all its published content
//   {
//     const rows = await executeQuery(
//       `SELECT mf.id, mf.file_path, mf.file_name, mf.sequence_order,
//               mc.duration, mc.doc_duration_seconds, mc.loop_interval_minutes, mc.playlist_mode,
//               mc.updated_at AS content_updated, mf.updated_at AS file_updated,
//               d.volume_level, d.updated_at AS display_updated
//        FROM media_content mc
//        JOIN media_files mf ON mf.media_content_id = mc.id
//        JOIN displays d     ON d.id = mc.display_id
//        WHERE mc.display_id = ? AND mc.is_published = 1
//        ORDER BY mf.sequence_order ASC`,
//       [tv_id], db_name
//     );

//     if (Array.isArray(rows) && rows.length > 0) {
//       return res.json(rows.map(f => ({
//         id:                    f.id,
//         tv_id,
//         file_url:              `${baseUrl}/${f.file_path.replace(/^\//, '')}`,
//         file_name:             f.file_name,
//         duration:              f.duration,
//         doc_duration_seconds:  f.doc_duration_seconds || 50,
//         sequence:              f.sequence_order,
//         volume:                f.volume_level || 50,
//         loop_interval_minutes: f.loop_interval_minutes ?? 15,
//         playlist_mode:         f.playlist_mode ?? 'loop',
//         last_updated: new Date(Math.max(
//           new Date(f.content_updated), new Date(f.file_updated), new Date(f.display_updated)
//         )).toISOString(),
//       })));
//     }
//   }

//   // Path 2: content_assignments fallback
//   const assigned = await executeQuery(
//     `SELECT mb.id, mb.file_path, mb.file_name, mb.sequence,
//             COALESCE(ca.duration_seconds, 10) AS duration,
//             d.volume_level, ca.updated_at, mb.updated_at AS file_updated, d.updated_at AS display_updated
//      FROM content_assignments ca
//      JOIN media_bucket mb ON mb.id = ca.media_bucket_id
//      JOIN displays d      ON d.id  = ca.display_id
//      WHERE ca.display_id = ? AND ca.is_active = 1
//        AND ca.start_date <= CURDATE() AND ca.end_date >= CURDATE()
//      ORDER BY mb.sequence ASC`,
//     [tv_id], db_name
//   );

//   if (!Array.isArray(assigned) || assigned.length === 0) {
//     return res.json([]);
//   }

//   res.json(assigned.map(f => ({
//     id:                   f.id,
//     tv_id,
//     file_url:             `${baseUrl}/${f.file_path.replace(/^\//, '')}`,
//     file_name:            f.file_name,
//     duration:             f.duration,
//     doc_duration_seconds: 50,
//     sequence:             f.sequence || 1,
//     volume:               f.volume_level || 50,
//     loop_interval_minutes: 15,
//     playlist_mode:         'loop',
//     last_updated:          new Date().toISOString(),
//   })));
// }));

// // ── POST /api/tv/status ─────────────────────────────────────────────────────
// router.post('/status', asyncHandler(async (req, res) => {
//   const { tv_id, status, db_name, temperature, uptime_minutes, content_loops } = req.body;
//   if (!tv_id || !db_name) return res.status(400).json({ error: 'tv_id and db_name required' });
//   try {
//     await executeQuery(
//       `UPDATE displays SET
//          status = ?, last_heartbeat = NOW(),
//          temperature = COALESCE(?, temperature),
//          uptime_today_minutes = COALESCE(?, uptime_today_minutes),
//          content_loops_today  = COALESCE(?, content_loops_today)
//        WHERE id = ?`,
//       [status || 'ONLINE', temperature || null, uptime_minutes || null, content_loops || null, tv_id],
//       db_name
//     );
//   } catch {
//     await executeQuery(
//       'UPDATE displays SET status = ?, last_heartbeat = NOW() WHERE id = ?',
//       [status || 'ONLINE', tv_id], db_name
//     );
//   }
//   res.json({ success: true });
// }));

// // ── POST /api/tv/storage ────────────────────────────────────────────────────
// router.post('/storage', asyncHandler(async (req, res) => {
//   const { tv_id, db_name, storage_available } = req.body;
//   if (!tv_id || !db_name) return res.status(400).json({ error: 'tv_id and db_name required' });
//   await executeQuery('UPDATE displays SET storage_available = ? WHERE id = ?', [storage_available, tv_id], db_name);
//   res.json({ success: true });
// }));

// // ── POST /api/tv/download-complete ──────────────────────────────────────────
// router.post('/download-complete', asyncHandler(async (req, res) => {
//   const { tv_id, db_name, production_line_id } = req.body;
//   if (!tv_id || !db_name) return res.status(400).json({ error: 'tv_id and db_name required' });
//   try {
//     await executeQuery('UPDATE displays SET last_heartbeat = NOW() WHERE id = ?', [tv_id], db_name);
//     // FIX D: Mark publish_status as completed
//     await executeQuery(
//       "UPDATE publish_status SET status = 'completed' WHERE display_id = ? AND status = 'pending'",
//       [tv_id], db_name
//     );
//   } catch {}
//   res.json({ success: true });
// }));

// // ── POST /api/tv/error ──────────────────────────────────────────────────────
// router.post('/error', asyncHandler(async (req, res) => {
//   const { tv_id, db_name, error_type, error_message } = req.body;
//   if (!tv_id || !db_name) return res.status(400).json({ success: false });
//   try {
//     await executeQuery(
//       `INSERT INTO display_error_logs (display_id, error_type, error_message)
//        VALUES (?, ?, ?)`,
//       [tv_id, error_type || 'other', error_message || ''], db_name
//     );
//   } catch {}
//   res.json({ success: true });
// }));

// // ── GET /api/tv/volume/:tv_id ───────────────────────────────────────────────
// router.get('/volume/:tv_id', asyncHandler(async (req, res) => {
//   const { tv_id }   = req.params;
//   const { db_name } = req.query;
//   if (!db_name) return res.status(400).json({ error: 'db_name required' });
//   const rows = await executeQuery('SELECT volume_level FROM displays WHERE id = ?', [tv_id], db_name);
//   const row  = Array.isArray(rows) ? rows[0] : rows;
//   res.json({ volume_level: row?.volume_level ?? 50 });
// }));

// // ── GET /api/tv/announcements/:tv_id ────────────────────────────────────────
// // TV polls this every 60s to get active ticker announcements
// router.get('/announcements/:tv_id', asyncHandler(async (req, res) => {
//   const { db_name } = req.query;
//   if (!db_name) return res.json({ announcements: [] });
//   try {
//     const rows = await executeQuery(
//       `SELECT id, message, type, duration_minutes, expires_at, created_at
//        FROM display_announcements
//        WHERE expires_at > NOW() AND is_active = 1
//        ORDER BY created_at DESC
//        LIMIT 5`,
//       [], db_name
//     );
//     res.json({ announcements: Array.isArray(rows) ? rows : [] });
//   } catch {
//     res.json({ announcements: [] });
//   }
// }));

// export default router;