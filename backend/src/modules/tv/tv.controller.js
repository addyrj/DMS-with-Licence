// src/modules/tv/tv.controller.js
import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import * as svc     from './tv.service.js';
import { markDownloadComplete } from '../publish/publish.service.js';

export const login          = asyncHandler(async (req, res) => success(res, await svc.tvLogin(req.body)));
export const getFiles       = asyncHandler(async (req, res) => res.json(await svc.getTvFiles(req.params.tv_id, req.query.db_name)));
export const heartbeat      = asyncHandler(async (req, res) => success(res, await svc.updateStatus(req.body)));
export const reportStorage  = asyncHandler(async (req, res) => success(res, await svc.saveStorageReport(req.body)));
export const getVolume      = asyncHandler(async (req, res) => success(res, await svc.getDisplayVolume(req.params.tv_id, req.query.db_name)));
export const reportError    = asyncHandler(async (req, res) => success(res, await svc.logError(req.body)));
export const getStats       = asyncHandler(async (req, res) => success(res, await svc.getDisplayStats(req.params.tv_id, req.query.db_name)));
export const downloadComplete = asyncHandler(async (req, res) => {
  const { tv_id, production_line_id, db_name } = req.body;
  const dbName = req.dbName || db_name;
  const { executeQuery } = await import('../../config/database.js');

  // Always resolve production_line_id from production_line_displays
  // App sends 0 or wrong value — backend looks it up from display_id
  const rows = await executeQuery(
    `SELECT pld.production_line_id
     FROM production_line_displays pld
     JOIN production_lines pl ON pl.id = pld.production_line_id
     WHERE pld.display_id = ?
     ORDER BY pl.active_line DESC
     LIMIT 1`,
    [Number(tv_id)], dbName
  );

  const lineId = (Array.isArray(rows) && rows[0])
    ? rows[0].production_line_id
    : Number(production_line_id);

  if (!lineId) {
    console.warn(`[downloadComplete] Could not resolve production_line_id for tv_id=${tv_id}`);
    return success(res, { message: 'No production line found for this display' });
  }

  console.log(`[downloadComplete] tv_id=${tv_id} → lineId=${lineId} db=${dbName}`);
  success(res, await markDownloadComplete(tv_id, lineId, dbName));
});
