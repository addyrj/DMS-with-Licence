// src/modules/publish/publish.service.js
import { executeQuery } from '../../config/database.js';
import { publish as mqttPublish } from '../../config/mqtt.js';
import { tvTopic }                from '../../constants/mqttConstants.js';
import logger                     from '../../utils/logger.js';

const matchFilesToTvs = (files, tvs, displayIds = null) => {
  const isAllDisplays = !displayIds || displayIds.length === 0;
  if (isAllDisplays) return tvs.map(tv => ({ tv, files }));
  const strict = tvs.map(tv => ({
    tv,
    files: files.filter(f =>
      f.file_name.includes(tv.display_number) ||
      f.file_path.includes(tv.display_number)
    ),
  }));
  const anyStrictMatch = strict.some(p => p.files.length > 0);
  if (anyStrictMatch) return strict;
  return tvs.map(tv => ({ tv, files }));
};

const publishToLine = async (lineId, bucketFiles, duration, docDuration, displayIds, dbName, appendMode = false, fileRepeats = {}) => {
  const lines = await executeQuery('SELECT * FROM production_lines WHERE id = ?', [lineId], dbName);
  const line  = Array.isArray(lines) ? lines[0] : lines;
  if (!line) throw Object.assign(new Error('Production line not found'), { statusCode: 404, isOperational: true });

  let tvOrder = [];
  try { tvOrder = JSON.parse(line.tv_order || '[]'); } catch {}
  tvOrder = tvOrder.filter(x => x && String(x).trim() !== '').map(String);

  if (tvOrder.length === 0)
    throw Object.assign(new Error('Production line has no TVs attached.'), { statusCode: 400, isOperational: true });

  const allTvs = await executeQuery(
    `SELECT id, display_number FROM displays WHERE id IN (${tvOrder.map(() => '?').join(',')})`,
    tvOrder, dbName
  );

  let orderedTvs = tvOrder
    .map(id => (Array.isArray(allTvs) ? allTvs : []).find(t => String(t.id) === id))
    .filter(Boolean);

  if (Array.isArray(displayIds) && displayIds.length > 0) {
    orderedTvs = orderedTvs.filter(tv => displayIds.includes(tv.id) || displayIds.includes(String(tv.id)));
  }

  if (orderedTvs.length === 0)
    throw Object.assign(new Error('No matching displays found in this line.'), { statusCode: 400, isOperational: true });

  const tvFilePairs = matchFilesToTvs(bucketFiles, orderedTvs, displayIds);

  await Promise.all(
    tvFilePairs.map(async ({ tv, files: tvFiles }) => {
      const existing = await executeQuery(
        'SELECT id FROM media_content WHERE production_line_id=? AND display_id=?',
        [lineId, tv.id], dbName
      );
      const existRow = Array.isArray(existing) ? existing[0] : null;

      let contentId;
      if (existRow) {
        contentId = existRow.id;
        await executeQuery(
          'UPDATE media_content SET duration=?, doc_duration_seconds=?, is_published=1 WHERE id=?',
          [duration, docDuration || 50, contentId], dbName
        );
        if (!appendMode) await executeQuery('DELETE FROM media_files WHERE media_content_id=?', [contentId], dbName);
      } else {
        const res = await executeQuery(
          'INSERT INTO media_content (production_line_id, display_id, duration, doc_duration_seconds, is_published) VALUES (?,?,?,?,1)',
          [lineId, tv.id, duration, docDuration || 50], dbName
        );
        contentId = res.insertId;
      }

      let startSeq = 1;
      if (appendMode) {
        const [maxRow] = await executeQuery(
          'SELECT COALESCE(MAX(sequence_order),0) AS mx FROM media_files WHERE media_content_id=?',
          [contentId], dbName
        );
        startSeq = (maxRow?.mx || 0) + 1;
      }

      let seqIdx = 0;
      for (let i = 0; i < tvFiles.length; i++) {
        const f   = tvFiles[i];
        const rpt = Math.max(1, Math.min(10, fileRepeats[f.id] || fileRepeats[f.bucket_id] || 1));
        for (let r = 0; r < rpt; r++) {
          await executeQuery(
            'INSERT INTO media_files (media_content_id, file_path, file_name, sequence_order, file_size_mb) VALUES (?,?,?,?,?)',
            [contentId, f.file_path, f.file_name, startSeq + seqIdx, f.file_size_mb || 0], dbName
          );
          seqIdx++;
        }
      }

      await executeQuery(
        `INSERT INTO publish_status (production_line_id, display_id, status) VALUES (?,?,'pending')
         ON DUPLICATE KEY UPDATE status='pending'`,
        [lineId, tv.id], dbName
      );

      await executeQuery(
        'UPDATE displays SET volume_level = CASE WHEN volume_level = 0 THEN 50 ELSE volume_level END WHERE id = ?',
        [tv.id], dbName
      );

      await mqttPublish(tvTopic(tv.id), 'true', { retain: false });
    })
  );

  return orderedTvs.length;
};

export const publishContent = async ({
  production_line_id, all_lines, folder_name, duration, doc_duration,
  file_ids, display_ids, append_mode, file_repeats: fileRepeats = {}
}, dbName, userId) => {

  let bucketFiles;
  if (Array.isArray(file_ids) && file_ids.length > 0) {
    const placeholders = file_ids.map(() => '?').join(',');
    bucketFiles = await executeQuery(
      `SELECT * FROM media_bucket WHERE id IN (${placeholders}) AND folder_name = ? ORDER BY sequence`,
      [...file_ids, folder_name.toLowerCase().trim()], dbName
    );
  } else {
    bucketFiles = await executeQuery(
      'SELECT * FROM media_bucket WHERE folder_name = ? ORDER BY sequence',
      [folder_name.toLowerCase().trim()], dbName
    );
  }
  const files = Array.isArray(bucketFiles) ? bucketFiles : [];
  if (files.length === 0)
    throw Object.assign(new Error('No files in selected folder.'), { statusCode: 400, isOperational: true });

  let totalTvCount = 0;

  if (all_lines) {
    const allLines = await executeQuery('SELECT id FROM production_lines WHERE active_line = 1', [], dbName);
    const lineList = Array.isArray(allLines) ? allLines : [];
    if (lineList.length === 0)
      throw Object.assign(new Error('No active production lines found.'), { statusCode: 400, isOperational: true });
    for (const ln of lineList) {
      try {
        // FIX: was hardcoded `false` — every "All Lines" publish ignored
        // append_mode entirely and always replaced, regardless of what
        // was selected in the UI. publishToLine itself handles append vs
        // replace correctly; this call just never forwarded the value.
        const count = await publishToLine(ln.id, files, duration, doc_duration, display_ids, dbName, append_mode, fileRepeats);
        totalTvCount += count;
      } catch (err) {
        logger.warn(`[Publish] Skipped line ${ln.id}: ${err.message}`);
      }
    }
  } else {
    if (!production_line_id)
      throw Object.assign(new Error('production_line_id required'), { statusCode: 400, isOperational: true });
    totalTvCount = await publishToLine(production_line_id, files, duration, doc_duration, display_ids, dbName, append_mode, fileRepeats);
  }

  try {
    await executeQuery(
      `INSERT INTO publish_history (folder_name, production_line_id, display_ids, file_ids, duration, doc_duration, all_lines, tv_count, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [folder_name, production_line_id || null,
       display_ids ? JSON.stringify(display_ids) : null,
       file_ids ? JSON.stringify(file_ids) : null,
       duration || 10, doc_duration || 50, all_lines ? 1 : 0, totalTvCount, userId || null], dbName
    );
  } catch {}

  return { message: `Published to ${totalTvCount} TV(s)`, tv_count: totalTvCount };
};

export const unpublishContent = async ({ production_line_id, display_id }, dbName) => {
  if (display_id) {
    await executeQuery('UPDATE media_content SET is_published=0 WHERE production_line_id=? AND display_id=?', [production_line_id, display_id], dbName);
    try { await mqttPublish(tvTopic(display_id), 'true', { retain:false }); } catch {}
    return { message:'Content paused for display', paused:1 };
  }
  const result = await executeQuery(
    'UPDATE media_content SET is_published = 0 WHERE production_line_id = ? AND is_published = 1',
    [production_line_id], dbName
  );
  try {
    const tvs = await executeQuery(
      'SELECT DISTINCT display_id FROM media_content WHERE production_line_id = ?',
      [production_line_id], dbName
    );
    for (const tv of (Array.isArray(tvs) ? tvs : []))
      await mqttPublish(tvTopic(tv.display_id), 'true', { retain: false });
  } catch {}
  return { message: 'Content paused', paused: result?.affectedRows || 0 };
};

export const republishContent = async ({ production_line_id, display_id }, dbName) => {
  if (display_id) {
    await executeQuery('UPDATE media_content SET is_published=1 WHERE production_line_id=? AND display_id=?', [production_line_id, display_id], dbName);
    try { await mqttPublish(tvTopic(display_id), 'true', { retain:false }); } catch {}
    return { message:'Content resumed for display', resumed:1 };
  }
  const result = await executeQuery(
    'UPDATE media_content SET is_published = 1 WHERE production_line_id = ? AND is_published = 0',
    [production_line_id], dbName
  );
  try {
    const tvs = await executeQuery(
      'SELECT DISTINCT display_id FROM media_content WHERE production_line_id = ?',
      [production_line_id], dbName
    );
    for (const tv of (Array.isArray(tvs) ? tvs : []))
      await mqttPublish(tvTopic(tv.display_id), 'true', { retain: false });
  } catch {}
  return { message: 'Content resumed', resumed: result?.affectedRows || 0 };
};

export const getDownloadStatus = async (production_line_id, dbName) => {
  const tvs = await executeQuery(
    `SELECT ps.display_id, d.display_number, ps.status, ps.updated_at
     FROM publish_status ps
     JOIN displays d ON d.id = ps.display_id
     WHERE ps.production_line_id = ?`,
    [production_line_id], dbName
  );
  const list = Array.isArray(tvs) ? tvs : [];
  return {
    production_line_id,
    total: list.length,
    completed: list.filter(t => t.status === 'completed').length,
    downloading: list.filter(t => t.status === 'downloading').length,
    tvs: list,
  };
};

export const markDownloadComplete = async (tv_id, production_line_id, dbName) => {
  await executeQuery(
    `UPDATE publish_status SET status='completed' WHERE production_line_id=? AND display_id=?`,
    [production_line_id, tv_id], dbName
  );
  return { message: 'Download marked complete' };
};

export const getPublishHistory = async (dbName, { limit, offset } = {}) => {
  try {
    const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM publish_history', [], dbName);
    const rows = await executeQuery(
      `SELECT ph.*, pl.production_line_name
       FROM publish_history ph
       LEFT JOIN production_lines pl ON pl.id = ph.production_line_id
       ORDER BY ph.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset], dbName
    );
    return { rows: Array.isArray(rows) ? rows : [], total };
  } catch { return { rows: [], total: 0 }; }
};

export const deletePublishedContent = async ({ production_line_id, display_id }, dbName) => {
  const contents = await executeQuery(
    display_id
      ? 'SELECT id FROM media_content WHERE production_line_id=? AND display_id=?'
      : 'SELECT id FROM media_content WHERE production_line_id=?',
    display_id ? [production_line_id, display_id] : [production_line_id], dbName
  );
  const ids = (Array.isArray(contents) ? contents : []).map(c => c.id);
  if (ids.length) {
    await executeQuery(`DELETE FROM media_files WHERE media_content_id IN (${ids.map(() => '?').join(',')})`, ids, dbName);
    await executeQuery(`DELETE FROM media_content WHERE id IN (${ids.map(() => '?').join(',')})`, ids, dbName);
  }
  return { message: 'Content permanently deleted', deleted: ids.length };
};

export const deletePublishHistory = async (id, dbName) => {
  await executeQuery('DELETE FROM publish_history WHERE id = ?', [id], dbName);
  return { message: 'History entry deleted' };
};