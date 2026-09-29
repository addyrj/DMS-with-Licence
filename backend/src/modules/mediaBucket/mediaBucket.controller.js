// src/modules/mediaBucket/mediaBucket.controller.js
import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc     from './mediaBucket.service.js';

export const listFolders = asyncHandler(async (req, res) => {
  // Media bucket is a shared library — every role sees every folder.
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getFolders(req.dbName, null, { limit, offset });
  paginatedSuccess(res, success, 'folders', rows, total, { page, limit });
});

export const folderFiles = asyncHandler(async (req, res) => {
  // Media bucket is a shared library — every role sees every folder's files.
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getFolderFiles(req.params.name, req.dbName, null, { limit, offset });
  paginatedSuccess(res, success, 'files', rows, total, { page, limit });
});

export const uploadFiles = asyncHandler(async (req, res) => {
  const validFiles    = req.files || [];
  const rejectedFiles = req.rejectedFiles || [];

  if (!validFiles.length && rejectedFiles.length) {
    return res.status(400).json({
      success: false,
      error: `No valid files uploaded. Rejected: ${rejectedFiles.map(f => f.name).join(', ')}`,
      rejected: rejectedFiles,
      allowed_types: ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf','pptx','ppt'],
    });
  }
  if (!validFiles.length) return res.status(400).json({ success: false, error: 'No files received' });

  const data = await svc.uploadFiles(validFiles, req.body.folder_name, req.dbName, req.user.client_id, req.user.id, req.user.username || req.user.admin_username || null);
  success(res, {
    ...data,
    rejected: rejectedFiles,
    warning: rejectedFiles.length
      ? `${rejectedFiles.length} file(s) skipped (unsupported type): ${rejectedFiles.map(f=>f.name).join(', ')}`
      : null,
  }, 201);
});

export const removeFile   = asyncHandler(async (req, res) => success(res, await svc.deleteFile(req.params.id, req.dbName)));
export const removeFolder = asyncHandler(async (req, res) => success(res, await svc.deleteFolder(req.params.name, req.dbName)));
export const reorder      = asyncHandler(async (req, res) => success(res, await svc.reorderFiles(req.body.order, req.dbName)));
export const renameFolder = asyncHandler(async (req, res) => {
  success(res, await svc.renameFolder(req.params.name, req.body.new_name, req.dbName));
});
