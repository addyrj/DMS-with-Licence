// src/modules/mediaContent/mediaContent.service.js
// FIX: getContentFiles now computes file_type from extension (was missing)
// FIX: removed d.media_storage_mb from getContentByLine
import path from 'path';
import fs   from 'fs';
import { executeQuery } from '../../config/database.js';
import { publish }      from '../../config/mqtt.js';
import { tvTopic }      from '../../constants/mqttConstants.js';

const FILE_TYPE_CASE = `
  CASE
    WHEN mf.file_name REGEXP '\\.(mp4|mov|avi|webm|mkv)$' THEN 'video'
    WHEN mf.file_name REGEXP '\\.(jpg|jpeg|png|gif|webp|bmp)$' THEN 'image'
    WHEN mf.file_name REGEXP '\\.pdf$' THEN 'pdf'
    WHEN mf.file_name REGEXP '\\.(ppt|pptx)$' THEN 'presentation'
    WHEN mf.file_name REGEXP '\\.(doc|docx)$' THEN 'document'
    WHEN mf.file_name REGEXP '\\.(xls|xlsx)$' THEN 'spreadsheet'
    ELSE 'other'
  END AS file_type
`;

// FIX: employee production-line scoping now happens in SQL (was fetch-all + JS filter),
// so COUNT(*)/pagination reflect only the rows the requester can see.
export const getAllContent = async (dbName, { limit, offset, lineId = null } = {}) => {
  const where  = lineId ? 'WHERE mc.production_line_id = ?' : '';
  const params = lineId ? [lineId] : [];

  const [{ total }] = await executeQuery(`SELECT COUNT(*) as total FROM media_content mc ${where}`, params, dbName);

  const rows = await executeQuery(
    `SELECT mc.id, mc.production_line_id, mc.display_id, mc.duration, mc.doc_duration_seconds,
            mc.is_published, mc.created_at, mc.updated_at,
            d.display_number, d.display_name, d.status AS display_status, d.volume_level,
            pl.production_line_name,
            COUNT(mf.id) AS file_count
     FROM media_content mc
     JOIN displays d          ON d.id  = mc.display_id
     JOIN production_lines pl ON pl.id = mc.production_line_id
     LEFT JOIN media_files mf ON mf.media_content_id = mc.id
     ${where}
     GROUP BY mc.id
     ORDER BY mc.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset], dbName
  );
  return { rows, total };
};

// FIX: Added file_type computed from extension
export const getContentFiles = async (id, dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM media_files WHERE media_content_id = ?', [id], dbName);
  const rows = await executeQuery(
    `SELECT mf.id, mf.file_name, mf.file_path, mf.sequence_order,
            mf.created_at, mf.updated_at,
            mc.duration, mc.doc_duration_seconds, mc.is_published,
            ${FILE_TYPE_CASE}
     FROM media_files mf
     JOIN media_content mc ON mc.id = mf.media_content_id
     WHERE mf.media_content_id = ?
     ORDER BY mf.sequence_order ASC
     LIMIT ? OFFSET ?`,
    [id, limit, offset], dbName
  );
  return { rows, total };
};

export const updateDuration = async (id, duration, docDuration, dbName) => {
  if (docDuration !== undefined) {
    await executeQuery('UPDATE media_content SET duration=?, doc_duration_seconds=? WHERE id=?',
      [duration, docDuration, id], dbName);
  } else {
    await executeQuery('UPDATE media_content SET duration=? WHERE id=?', [duration, id], dbName);
  }
  return { media_content_id: id, duration, doc_duration_seconds: docDuration };
};

export const updateFileSequence = async (fileId, sequence_order, dbName) => {
  await executeQuery('UPDATE media_files SET sequence_order=? WHERE id=?', [sequence_order, fileId], dbName);
  return { file_id: fileId, sequence_order };
};

export const deleteMediaFile = async (fileId, dbName) => {
  const rows = await executeQuery('SELECT * FROM media_files WHERE id=?', [fileId], dbName);
  const file = Array.isArray(rows) ? rows[0] : rows;
  if (!file) throw Object.assign(new Error('File not found'), { statusCode:404, isOperational:true });
  const fullPath = path.join(process.cwd(), file.file_path);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  await executeQuery('DELETE FROM media_files WHERE id=?', [fileId], dbName);
  const [{ count }] = await executeQuery('SELECT COUNT(*) AS count FROM media_files WHERE media_content_id=?', [file.media_content_id], dbName);
  if (count === 0) await executeQuery('DELETE FROM media_content WHERE id=?', [file.media_content_id], dbName);

  // FIX 4: Fire MQTT so TV re-syncs immediately (don't wait 5 min)
  try {
    const mc = await executeQuery('SELECT display_id FROM media_content WHERE id=?', [file.media_content_id], dbName);
    const displayId = Array.isArray(mc) ? mc[0]?.display_id : mc?.display_id;
    if (displayId) {
      const { publish } = await import('../../../config/mqtt.js');
      await publish(`tv/${displayId}/command`, 'true', { retain: false });
    }
  } catch (_) {}

  return { message:'File deleted', files_remaining: count };
};

export const uploadDirectToTv = async (files, { production_line_id, display_number, duration=10, doc_duration=50, append_mode='false' }, dbName, userId) => {
  const [display] = await executeQuery('SELECT id FROM displays WHERE display_number=?', [display_number], dbName);
  if (!display) throw Object.assign(new Error('Display not found'), { statusCode:404, isOperational:true });

  // FIX: resolve the display's actual production line from the
  // source-of-truth join table instead of trusting whatever the client
  // sent. production_line_displays is a many-to-many table — the client
  // has no reliable way to know a display's line unless it's fetched
  // through that join, so whatever the frontend guesses here is not
  // trustworthy. If a display genuinely isn't linked to any line yet,
  // fall back to whatever the client sent so uploads still work for
  // brand-new/unassigned displays.
  const [lineRow] = await executeQuery(
    'SELECT production_line_id FROM production_line_displays WHERE display_id=? LIMIT 1',
    [display.id], dbName
  );
  const resolvedLineId = lineRow?.production_line_id || production_line_id;

  const VIDEO_EXTS = ['.mp3','.mp4','.mpeg','.vlc','.mov'];
  const isAppend = append_mode === 'true' || append_mode === true;

  // FIX: the content-row lookup/creation and sequence-number reservation
  // used to run inside Promise.all(files.map(...)) — i.e. once PER FILE,
  // concurrently. With more than one file, every file's task ran the
  // "does a content row already exist" check and the "what's the next
  // sequence number" check at the same time, before any of them had
  // written anything — a classic check-then-act race. Result: uploading
  // several files together could create duplicate media_content rows
  // (first-ever upload to a display) or give every new file the exact
  // same sequence_order (append to a display that already has content).
  // Both of those now happen ONCE, sequentially, before any file is
  // touched — each file then just gets a pre-reserved, distinct slot.
  let [existing] = await executeQuery(
    'SELECT id FROM media_content WHERE production_line_id=? AND display_id=?',
    [resolvedLineId, display.id], dbName
  );

  let contentId;
  if (!existing) {
    // duration/doc_duration are content-level settings (one value covers
    // the whole batch), so the video-vs-not check only needs to look at
    // the first file — matches the original single-file behaviour exactly.
    const firstExt = path.extname(files[0].originalname).toLowerCase();
    const isVideo = VIDEO_EXTS.includes(firstExt);
    const res = await executeQuery(
      'INSERT INTO media_content (production_line_id, display_id, duration, doc_duration_seconds, is_published) VALUES (?,?,?,?,1)',
      [resolvedLineId, display.id, isVideo?0:parseInt(duration), parseInt(doc_duration)], dbName
    );
    contentId = res.insertId;
  } else {
    contentId = existing.id;
    if (!isAppend) {
      await executeQuery('DELETE FROM media_files WHERE media_content_id=?', [contentId], dbName);
    }
  }

  let nextSeq = 0;
  if (isAppend) {
    const [maxRow] = await executeQuery('SELECT COALESCE(MAX(sequence_order),0) AS mx FROM media_files WHERE media_content_id=?', [contentId], dbName);
    nextSeq = (maxRow?.mx || 0) + 1;
  }

  // Safe to run concurrently now — each file gets its own pre-reserved
  // sequence_order (nextSeq + its index), so there's no shared state left
  // for the parallel inserts to race over.
  const saved = await Promise.all(files.map(async (file, i) => {
    const filePath = `tvfiles/${dbName}/${file.filename}`;
    await executeQuery('INSERT INTO media_files (media_content_id, file_path, file_name, sequence_order) VALUES (?,?,?,?)',
      [contentId, filePath, file.originalname, nextSeq + i], dbName);
    return { file_name: file.originalname, file_path: filePath };
  }));

  try { await publish(tvTopic(display.id), 'true', { retain:false }); } catch {}
  return { display_number, production_line_id: resolvedLineId, uploaded: saved };
};

export const getContentByLine = async (lineId, dbName, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery(
    'SELECT COUNT(*) as total FROM displays d JOIN production_line_displays pld ON pld.display_id = d.id WHERE pld.production_line_id = ?',
    [lineId], dbName
  );
  const displays = await executeQuery(
    `SELECT d.id, d.display_name, d.display_number, d.status,
            d.last_heartbeat, d.volume_level, d.storage_available
     FROM displays d
     JOIN production_line_displays pld ON pld.display_id = d.id
     WHERE pld.production_line_id = ?
     ORDER BY d.display_number
     LIMIT ? OFFSET ?`,
    [lineId, limit, offset], dbName);
  const list = Array.isArray(displays)?displays:[];
  const rows = await Promise.all(list.map(async (disp) => {
    const filesRows = await executeQuery(
      `SELECT mf.id, mf.file_name, mf.file_path, mf.sequence_order,
              mc.duration, mc.doc_duration_seconds, mc.is_published, mc.updated_at,
              ${FILE_TYPE_CASE}
       FROM media_content mc
       JOIN media_files mf ON mf.media_content_id = mc.id
       WHERE mc.display_id = ? AND mc.production_line_id = ?
       ORDER BY mf.sequence_order`,
      [disp.id, lineId], dbName);
    return { ...disp, files: Array.isArray(filesRows)?filesRows:[] };
  }));
  return { rows, total };
};

export const getContentById = async (id, dbName) => {
  const rows = await executeQuery(
    `SELECT mc.id, mc.duration, mc.doc_duration_seconds, mc.is_published, mc.created_at, mc.updated_at,
            d.display_number, d.display_name, d.volume_level, pl.production_line_name,
            COUNT(mf.id) AS file_count
     FROM media_content mc
     JOIN displays d ON d.id = mc.display_id
     JOIN production_lines pl ON pl.id = mc.production_line_id
     LEFT JOIN media_files mf ON mf.media_content_id = mc.id
     WHERE mc.id = ? GROUP BY mc.id`,
    [id], dbName);
  const [row] = Array.isArray(rows)?rows:[rows];
  if (!row) throw Object.assign(new Error('Not found'), { statusCode:404, isOperational:true });
  return row;
};