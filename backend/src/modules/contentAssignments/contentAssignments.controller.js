// src/modules/contentAssignments/contentAssignments.controller.js
import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import { ROLES }    from '../../constants/roles.js';
import * as svc     from './contentAssignments.service.js';

// Employees see only their own assignments; admins see all
export const listAssignments = asyncHandler(async (req, res) => {
  const userId = req.user.role === ROLES.EMPLOYEE ? req.user.id : null;
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getAssignments(req.dbName, userId, { limit, offset });
  paginatedSuccess(res, success, 'assignments', rows, total, { page, limit });
});

export const listByDisplay = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getAssignmentsByDisplay(req.params.display_id, req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'assignments', rows, total, { page, limit });
});

export const getAssignment = asyncHandler(async (req, res) =>
  success(res, { assignment: await svc.getAssignmentById(req.params.id, req.dbName) }));

export const createAssignment = asyncHandler(async (req, res) =>
  success(res, { assignment: await svc.createAssignment(req.body, req.dbName, req.user.id) }, 201));

export const updateAssignment = asyncHandler(async (req, res) =>
  success(res, { assignment: await svc.updateAssignment(req.params.id, req.body, req.dbName) }));

export const toggleAssignment = asyncHandler(async (req, res) =>
  success(res, { assignment: await svc.toggleAssignment(req.params.id, req.dbName) }));

export const removeAssignment = asyncHandler(async (req, res) =>
  success(res, await svc.deleteAssignment(req.params.id, req.dbName)));
