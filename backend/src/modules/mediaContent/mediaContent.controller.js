// src/modules/mediaContent/mediaContent.controller.js
import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc     from './mediaContent.service.js';

// FIX: Employee only sees their assigned production line's content (scoped in SQL now)
export const listContent = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const lineId = (req.user?.role === 'EMPLOYEE' && req.user?.production_line_id)
    ? Number(req.user.production_line_id) : null;
  const { rows, total } = await svc.getAllContent(req.dbName, { limit, offset, lineId });
  paginatedSuccess(res, success, 'content', rows, total, { page, limit });
});

export const getFiles = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getContentFiles(req.params.id, req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'files', rows, total, { page, limit });
});

// FIX: pass doc_duration from req.body to updateDuration
export const setDuration = asyncHandler(async (req, res) => {
  const { duration, doc_duration } = req.body;
  success(res, await svc.updateDuration(
    req.params.id,
    Number(duration) || 0,
    doc_duration !== undefined ? Number(doc_duration) : undefined,
    req.dbName
  ));
});

export const setFileSequence = asyncHandler(async (req, res) => success(res, await svc.updateFileSequence(req.params.file_id, req.body.sequence_order, req.dbName)));
export const removeFile      = asyncHandler(async (req, res) => success(res, await svc.deleteMediaFile(req.params.file_id, req.dbName)));
export const getContent      = asyncHandler(async (req, res) => success(res, { content: await svc.getContentById(req.params.id, req.dbName) }));

export const directUpload = asyncHandler(async (req, res) => {
  if (!req.files?.length) return success(res, { error: 'No files received' }, 400);
  const data = await svc.uploadDirectToTv(req.files, req.body, req.dbName, req.user.id);
  success(res, data, 201);
});

export const contentByLine = asyncHandler(async (req, res) => {
  const { getContentByLine } = await import('./mediaContent.service.js');
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await getContentByLine(req.params.lineId, req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'tvs', rows, total, { page, limit });
});