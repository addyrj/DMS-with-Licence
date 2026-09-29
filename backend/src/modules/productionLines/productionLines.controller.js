// src/modules/productionLines/productionLines.controller.js
import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc     from './productionLines.service.js';

export const getLines    = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getLines(req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'lines', rows, total, { page, limit });
});
export const getLineById = asyncHandler(async (req, res) => {
  const line = await svc.getLineById(req.params.id, req.dbName);
  if (!line) return res.status(404).json({ error: 'Not found' });
  success(res, { line });
});

export const createLine  = asyncHandler(async (req, res) => {
  // FIX: pass clientId so production_lines.client_id is set
  const clientId = req.clientId || req.user?.client_id;
  const userId   = req.user?.id;
  success(res, await svc.createLine(req.body, req.dbName, userId, clientId), 201);
});

export const updateLine  = asyncHandler(async (req, res) => success(res, await svc.updateLine(req.params.id, req.body, req.dbName)));
export const deleteLine  = asyncHandler(async (req, res) => success(res, await svc.deleteLine(req.params.id, req.dbName)));

export const toggleActiveLine = asyncHandler(async (req, res) =>
  success(res, await svc.toggleActiveLine(req.params.id, req.dbName))
);

export const getAssignedDisplayIds = asyncHandler(async (req, res) =>
  success(res, await svc.getAssignedDisplayIds(req.dbName))
);

export const updateLineDisplays = asyncHandler(async (req, res) => {
  const { display_ids } = req.body;
  const lineId = req.params.id;
  // Remove all existing, then add new ones
  await svc.clearLineDisplays(lineId, req.dbName);
  for (const dId of (display_ids || [])) {
    await svc.addDisplayToLine(lineId, dId, req.dbName);
  }
  success(res, { line_id: lineId, display_ids });
});

export const updateTvOrder = asyncHandler(async (req, res) => {
  const { tv_order } = req.body;
  await svc.updateLine(req.params.id, { tv_order }, req.dbName);
  success(res, { line_id: req.params.id, tv_order });
});

export const getDisplaysByLine = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getDisplaysByLine(req.params.id, req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'displays', rows, total, { page, limit });
});