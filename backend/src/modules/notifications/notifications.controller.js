// src/modules/notifications/notifications.controller.js
import asyncHandler from '../../utils/asyncHandler.js';
import { success }  from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc     from './notifications.service.js';

export const createNotif = asyncHandler(async (req, res) => success(res, await svc.createNotification(req.body), 201));
export const listNotifs  = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getAllNotifications({ limit, offset });
  paginatedSuccess(res, success, 'notifications', rows, total, { page, limit });
});
export const deleteNotif = asyncHandler(async (req, res) => success(res, await svc.deleteNotification(req.params.id)));
export const myNotifs    = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getClientNotifications(req.user.client_id, { limit, offset });
  paginatedSuccess(res, success, 'notifications', rows, total, { page, limit });
});
export const unreadCount = asyncHandler(async (req, res) => success(res, { count: await svc.getUnreadCount(req.user.client_id) }));
export const markRead    = asyncHandler(async (req, res) => success(res, await svc.markAsRead(req.params.id, req.user.client_id)));
export const markAllRead = asyncHandler(async (req, res) => success(res, await svc.markAllRead(req.user.client_id)));