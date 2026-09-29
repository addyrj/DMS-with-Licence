// src/modules/displays/displays.controller.js
import asyncHandler     from '../../utils/asyncHandler.js';
import { success }      from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import { executeQuery } from '../../config/database.js';
import * as svc from './displays.service.js';

// Helper: get employee's production_line_id from DB
const getEmpLineId = async (userId, dbName) => {
  const rows = await executeQuery(
    'SELECT production_line_id FROM employee_users WHERE user_id = ?',
    [userId], dbName
  );
  const emp = Array.isArray(rows) ? rows[0] : rows;
  return emp?.production_line_id || null;
};

// Helper: get display IDs for a production line
const getLineDisplayIds = async (lineId, dbName) => {
  try {
    // Try production_line_displays join table first
    const rows = await executeQuery(
      'SELECT display_id FROM production_line_displays WHERE production_line_id = ?',
      [lineId], dbName
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map(r => r.display_id);
    }
    // Fallback: use tv_order from production_lines
    const lines = await executeQuery(
      'SELECT tv_order FROM production_lines WHERE id = ?',
      [lineId], dbName
    );
    const line = Array.isArray(lines) ? lines[0] : lines;
    if (line?.tv_order) {
      return JSON.parse(line.tv_order).map(Number).filter(Boolean);
    }
  } catch {}
  return [];
};

export const listDisplays = asyncHandler(async (req, res) => {
  const clientId = req.clientId || req.user?.client_id || 0;
  const { page, limit, offset } = parsePage(req.query);

  if (req.user?.role === 'EMPLOYEE') {
    try {
      const lineId = req.user.production_line_id || await getEmpLineId(req.user.id, req.dbName);
      if (!lineId) return paginatedSuccess(res, success, 'displays', [], 0, { page, limit });

      const [{ total }] = await executeQuery(
        `SELECT COUNT(*) as total FROM displays d
         JOIN production_line_displays pld ON pld.display_id = d.id
         WHERE pld.production_line_id = ?`,
        [lineId], req.dbName
      );

      const displays = await executeQuery(
        `SELECT d.id, d.display_name, d.display_number, d.status,
                d.last_heartbeat, d.volume_level, d.storage_available,
                d.temperature, d.uptime_today_minutes,
                d.content_loops_today, d.total_play_time_min, d.created_at
         FROM displays d
         JOIN production_line_displays pld ON pld.display_id = d.id
         WHERE pld.production_line_id = ?
         ORDER BY d.display_number
         LIMIT ? OFFSET ?`,
        [lineId, limit, offset], req.dbName
      );

      // Fallback via tv_order if the join table itself has no rows for this line
      if (total === 0 && (!Array.isArray(displays) || displays.length === 0)) {
        const ids = await getLineDisplayIds(lineId, req.dbName);
        if (ids.length > 0) {
          const pagedIds = ids.slice(offset, offset + limit);
          const rows = pagedIds.length
            ? await executeQuery(
                `SELECT * FROM displays WHERE id IN (${pagedIds.map(() => '?').join(',')}) ORDER BY display_number`,
                pagedIds, req.dbName
              )
            : [];
          return paginatedSuccess(res, success, 'displays', Array.isArray(rows) ? rows : [], ids.length, { page, limit });
        }
      }
      return paginatedSuccess(res, success, 'displays', Array.isArray(displays) ? displays : [], total, { page, limit });
    } catch (e) {
      console.warn('[Displays] Employee scope error:', e.message);
      return paginatedSuccess(res, success, 'displays', [], 0, { page, limit });
    }
  }

  // Admin / SA — all displays
  const { rows, total } = await svc.getDisplays(req.dbName, clientId, { limit, offset });
  paginatedSuccess(res, success, 'displays', rows, total, { page, limit });
});

export const getDisplay = asyncHandler(async (req, res) => {
  const display = await svc.getDisplayById(req.params.id, req.dbName);

  // Employee: verify this display belongs to their production line
  if (req.user?.role === 'EMPLOYEE') {
    const lineId = req.user.production_line_id || await getEmpLineId(req.user.id, req.dbName);
    if (lineId) {
      const ids = await getLineDisplayIds(lineId, req.dbName);
      if (!ids.includes(Number(req.params.id))) {
        // Display not in their line — return 404 gracefully
        return res.status(404).json({ success:false, error:'Display not found' });
      }
    }
  }

  success(res, { display });
});

export const getStatus     = asyncHandler(async (req, res) => success(res, { display: await svc.getDisplayStatus(req.params.id, req.dbName) }));
export const getLimit      = asyncHandler(async (req, res) => success(res, await svc.getDisplayLimit(req.clientId || req.user?.client_id || 0, req.dbName)));
export const createDisplay = asyncHandler(async (req, res) => success(res, { display: await svc.createDisplay(req.body, req.dbName, req.clientId || req.user?.client_id || 0) }, 201));
export const editDisplay   = asyncHandler(async (req, res) => success(res, { display: await svc.updateDisplay(req.params.id, req.body, req.dbName) }));
export const updateVolume  = asyncHandler(async (req, res) => success(res, await svc.setVolume(req.params.id, req.body.volume_level, req.dbName)));
export const resetPassword = asyncHandler(async (req, res) => success(res, await svc.resetDisplayPassword(req.params.id, req.body.new_password, req.dbName)));
export const removeDisplay = asyncHandler(async (req, res) => success(res, await svc.deleteDisplay(req.params.id, req.dbName, req.clientId || req.user?.client_id || 0)));
export const getErrors     = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getDisplayErrors(req.params.id, req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'errors', rows, total, { page, limit });
});