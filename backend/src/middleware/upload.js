// src/middleware/upload.js
import multer from 'multer';
import path   from 'path';
import fs     from 'fs';
import env    from '../config/env.js';

const ALLOWED_EXT  = new Set(['jpeg','jpg','png','gif','webp','mp4','mov','avi','pdf','pptx','ppt']);
const ALLOWED_MIME = new Set([
  'image/jpeg','image/jpg','image/png','image/gif','image/webp',
  'video/mp4','video/quicktime','video/x-msvideo',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

// FIX: Direct-to-TV uploads (POST /api/media-content/direct-upload) are stored
// in tvfiles/{dbName}/ — NOT uploads/{dbName}/{folder}/ — because
// uploadDirectToTv() records file_path as `tvfiles/${dbName}/${filename}`.
// Previously multer saved them under uploads/ while the DB pointed at tvfiles/,
// so every direct-upload image 404'd.
const isDirectTvUpload = (req) =>
  (req.originalUrl || req.url || '').includes('direct-upload');

const resolveDestDir = (req) => {
  if (isDirectTvUpload(req)) {
    return path.join(env.tvfileDir, req.dbName || 'default');
  }
  const folder = (req.body.folder_name || 'general').trim().replace(/\s+/g, '-');
  return path.join(env.uploadDir, req.dbName || 'default', folder);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = resolveDestDir(req);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  // FIX: Keep the original filename instead of forcing "foldername-001.ext".
  // If a file with the same name already exists in this folder, append a
  // short unique suffix (timestamp + random) so nothing gets overwritten —
  // instead of renaming everything to match the folder name.
  filename: (req, file, cb) => {
    const ext   = path.extname(file.originalname);
    // FIX: Keep ORIGINAL filename case exactly as uploaded
    const base = path
      .basename(file.originalname, ext)
      .trim()
      .replace(/[^a-zA-Z0-9\-_.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file';

    const destDir = resolveDestDir(req);

    let finalName = `${base}${ext}`;
    try {
      // Track names used within this same request too (multiple files, same base name)
      if (!req._usedFileNames) req._usedFileNames = new Set();

      const exists = (name) =>
        req._usedFileNames.has(name) || (fs.existsSync(destDir) && fs.existsSync(path.join(destDir, name)));

      if (exists(finalName)) {
        const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        finalName = `${base}-${stamp}${ext}`;
      }
      req._usedFileNames.add(finalName);
    } catch {
      // fall back to original name if anything goes wrong with the FS check
    }

    cb(null, finalName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase().slice(1);
  const mime = file.mimetype.toLowerCase();
  if (ALLOWED_EXT.has(ext) || ALLOWED_MIME.has(mime)) return cb(null, true);
  if (!req.rejectedFiles) req.rejectedFiles = [];
  req.rejectedFiles.push({ name: file.originalname, reason: `Type not allowed: .${ext}` });
  cb(null, false);
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

export const ALLOWED_TYPES_LIST = ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf','pptx','ppt'];