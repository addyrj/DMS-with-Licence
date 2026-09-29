// src/modules/users/users.controller.js

import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc     from './users.service.js';

export const listUsers          = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const search = (req.query.search || '').trim();
  const type   = (req.query.type || '').trim();
  const { rows, total } = await svc.getAllUsers(req.dbName, { limit, offset, search, type });
  paginatedSuccess(res, success, 'users', rows, total, { page, limit });
});
export const getUser            = asyncHandler(async (req, res) => success(res, { user:  await svc.getUserById(req.params.id, req.dbName) }));
export const createUser         = asyncHandler(async (req, res) => success(res, { user:  await svc.createUser(req.body, req.dbName, req.user.id) }, 201));
export const updateUser         = asyncHandler(async (req, res) => success(res, { user:  await svc.updateUser(req.params.id, req.body, req.dbName) }));
export const removeUser         = asyncHandler(async (req, res) => success(res, await svc.deleteUser(req.params.id, req.dbName)));
export const toggleStatus       = asyncHandler(async (req, res) => success(res, { user:  await svc.toggleUserStatus(req.params.id, req.dbName) }));
export const changePassword     = asyncHandler(async (req, res) => success(res, await svc.changeUserPassword(req.params.id, req.body.new_password, req.dbName)));
