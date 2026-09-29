import { getActivityLog } from '../../utils/activityLog.js';
// src/modules/dashboard/dashboard.controller.js

import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import { paginatedSuccess } from '../../utils/pagination.js';
import { ROLES }     from '../../constants/roles.js';
import * as svc      from './dashboard.service.js';

export const superAdminOverview = asyncHandler(async (req, res) => {
  const data = await svc.getSuperAdminOverview();
  success(res, data);
});

export const clientOverview = asyncHandler(async (req, res) => {
  const data = await svc.getClientOverview(req.dbName, req.user.client_id);
  success(res, data);
});

// Smart dispatcher — returns right overview based on role
export const overview = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.SUPER_ADMIN) {
    const data = await svc.getSuperAdminOverview();
    return success(res, { role: 'SUPER_ADMIN', ...data });
  }
  const data = await svc.getClientOverview(req.dbName, req.user.client_id);
  success(res, { role: req.user.role, ...data });
});

export const specificClientOverview = asyncHandler(async (req, res) => {
  const { getClientOverviewById } = await import('./dashboard.service.js');
  success(res, await getClientOverviewById(req.params.id));
});

export const activityLog = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(500, parseInt(req.query.limit) || 100);
  const offset = (page - 1) * limit;
  const search = (req.query.search || '').trim();
  const type   = (req.query.type || '').trim();
  const { rows, total } = await getActivityLog(req.dbName, { limit, offset, search, type });
  paginatedSuccess(res, success, 'logs', rows, total, { page, limit });
});
