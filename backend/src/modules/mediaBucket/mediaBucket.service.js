// src/modules/mediaBucket/mediaBucket.service.js
import path   from 'path';
import fs     from 'fs';
import crypto from 'crypto';
import { executeQuery } from '../../config/database.js';
import env              from '../../config/env.js';
import { logActivity }  from '../../utils/activityLog.js';

const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4','.mov','.avi'].includes(ext))                    return 'video';
  if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext))    return 'image';
  if (ext === '.pdf')                                           return 'pdf';
  if (['.pptx','.ppt'].includes(ext))                          return 'presentation';
  return 'image';
};

const computeChecksum = (filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
};

const checkStorageLimit = async (dbName, clientId, newSizeMb) => {
  const clientRows = await executeQuery(
    'SELECT total_storage_gb FROM clients WHERE id = ?', [clientId], 'master'
  );
  const client = Array.isArray(clientRows) ? clientRows[0] : clientRows;
  const limitMb = (client?.total_storage_gb || 0) * 1024;

  const usedRows = await executeQuery(
    'SELECT COALESCE(SUM(file_size_mb), 0) AS used FROM media_bucket', [], dbName
  );
  const used = Array.isArray(usedRows) ? usedRows[0]?.used : 0;

  if (parseFloat(used) + newSizeMb > limitMb)
    throw Object.assign(
      new Error(`Storage limit exceeded. Used: ${parseFloat(used).toFixed(1)} MB / ${limitMb} MB`),
      { statusCode: 413, isOperational: true }
    );
};

// FIX: helper that updates the cached used_media_mb column in master.clients
// so storage stats are correct everywhere without re-querying all client DBs.
const updateUsedMediaMb = async (dbName, deltaMb) => {
  try {
    await executeQuery(
      'UPDATE clients SET used_media_mb = GREATEST(0, used_media_mb + ?) WHERE database_name = ?',
      [deltaMb, dbName], 'master'
    );
  } catch (err) {
    // Non-fatal — worst case the cached value is slightly off until next startup
    console.warn(`[mediaBucket] used_media_mb update failed: ${err.message}`);
  }
};

export const getFolders = async (dbName, userId = null, { limit, offset } = {}) => {
  const where  = userId ? 'WHERE created_by = ?' : '';
  const params = userId ? [userId] : [];

  const [{ total }] = await executeQuery(
    `SELECT COUNT(*) as total FROM (SELECT folder_name FROM media_bucket ${where} GROUP BY folder_name) t`,
    params, dbName
  );
  const rows = await executeQuery(
    `SELECT folder_name, COUNT(*) AS file_count, SUM(file_size_mb) AS total_size_mb
     FROM media_bucket ${where}
     GROUP BY folder_name ORDER BY folder_name
     LIMIT ? OFFSET ?`,
    [...params, limit, offset], dbName
  );
  return { rows, total };
};

export const getFolderFiles = async (folderName, dbName, userId = null, { limit, offset } = {}) => {
  const folder = folderName.trim().replace(/\s+/g, '-');
  const where  = userId ? 'WHERE folder_name = ? AND created_by = ?' : 'WHERE folder_name = ?';
  const params = userId ? [folder, userId] : [folder];

  const [{ total }] = await executeQuery(`SELECT COUNT(*) as total FROM media_bucket ${where}`, params, dbName);
  const rows = await executeQuery(
    `SELECT * FROM media_bucket ${where} ORDER BY sequence LIMIT ? OFFSET ?`,
    [...params, limit, offset], dbName
  );
  return { rows, total };
};

export const uploadFiles = async (files, folderName, dbName, clientId, userId, username = null) => {
  const folder  = folderName.trim().replace(/\s+/g, '-');
  const totalMb = files.reduce((sum, f) => sum + f.size / (1024 * 1024), 0);
  await checkStorageLimit(dbName, clientId, totalMb);

  const saved = await Promise.all(
    files.map(async (file, idx) => {
      const sizeMb   = file.size / (1024 * 1024);
      const fileType = getFileType(file.originalname);
      const filePath = `uploads/${dbName}/${folder}/${file.filename}`;
      const checksum = computeChecksum(file.path);

      await executeQuery(
        `INSERT INTO media_bucket
           (folder_name, file_name, file_path, file_size_mb, file_type, sequence, file_checksum, created_by)
         VALUES (?,?,?,?,?,?,?,?)`,
        [folder, file.filename, filePath, sizeMb.toFixed(2), fileType, idx + 1, checksum, userId],
        dbName
      );
      return {
        file_name:    file.filename,
        file_path:    filePath,
        file_size_mb: sizeMb.toFixed(2),
        file_type:    fileType,
        checksum,
      };
    })
  );

  // FIX: update cached media storage counter
  await updateUsedMediaMb(dbName, totalMb);

  await logActivity({
    dbName, userId, username: username || `user_${userId}`,
    actionType: 'upload_file', entityType: 'folder', entityId: folder,
    detail: `Uploaded ${saved.length} file(s) to folder "${folder}": ${saved.map(f=>f.file_name).join(', ')}`,
  });

  return { folder, uploaded: saved };
};

export const deleteFile = async (id, dbName) => {
  const rows = await executeQuery('SELECT * FROM media_bucket WHERE id = ?', [id], dbName);
  const file = Array.isArray(rows) ? rows[0] : rows;
  if (!file) throw Object.assign(new Error('File not found'), { statusCode: 404, isOperational: true });

  const fullPath = path.join(
    env.uploadDir.replace('./', ''),
    file.file_path.replace(`uploads/${dbName}/`, '')
  );
  try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch {}

  await executeQuery('DELETE FROM media_bucket WHERE id = ?', [id], dbName);

  // FIX: subtract this file's size from the cached counter
  await updateUsedMediaMb(dbName, -(parseFloat(file.file_size_mb) || 0));

  return { message: `File ${file.file_name} deleted`, file_name: file.file_name };
};

export const deleteFolder = async (folderName, dbName) => {
  const folder = folderName.trim().replace(/\s+/g, '-');

  // FIX: get total size BEFORE deleting so we can subtract it
  const rows = await executeQuery(
    'SELECT COALESCE(SUM(file_size_mb), 0) AS total FROM media_bucket WHERE folder_name = ?',
    [folder], dbName
  );
  const totalMb = parseFloat((Array.isArray(rows) ? rows[0]?.total : 0) || 0);

  const dirPath = path.join(env.uploadDir, dbName, folder);
  try { if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true }); } catch {}

  await executeQuery('DELETE FROM media_bucket WHERE folder_name = ?', [folder], dbName);

  // FIX: subtract folder's total size from cached counter
  await updateUsedMediaMb(dbName, -totalMb);

  return { message: `Folder '${folder}' deleted` };
};

export const reorderFiles = async (order, dbName) => {
  await Promise.all(
    order.map(({ id, sequence }) =>
      executeQuery('UPDATE media_bucket SET sequence = ? WHERE id = ?', [sequence, id], dbName)
    )
  );
  return { message: 'Sequence updated' };
};

export const renameFolder = async (oldName, newName, dbName) => {
  const oldFolder = oldName.trim().replace(/\s+/g, '-');
  const newFolder = newName.trim().replace(/\s+/g, '-');
  const oldPath   = path.join(env.uploadDir, dbName, oldFolder);
  const newPath   = path.join(env.uploadDir, dbName, newFolder);
  try { if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath); } catch {}
  await executeQuery(
    'UPDATE media_bucket SET folder_name = ? WHERE folder_name = ?',
    [newFolder, oldFolder], dbName
  );
  await executeQuery(
    `UPDATE media_bucket SET file_path = REPLACE(file_path, ?, ?) WHERE folder_name = ?`,
    [`uploads/${dbName}/${oldFolder}/`, `uploads/${dbName}/${newFolder}/`, newFolder], dbName
  );
  return { message: `Folder renamed: ${oldFolder} → ${newFolder}` };
};