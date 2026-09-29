// src/modules/publish/publish.controller.js
import asyncHandler         from '../../utils/asyncHandler.js';
import { success }          from '../../utils/response.js';
import { logActivity }      from '../../utils/activityLog.js';
import * as svc             from './publish.service.js';

export const publish = asyncHandler(async (req, res) => {
  const result = await svc.publishContent(req.body, req.dbName);
  await logActivity({
    dbName: req.dbName, userId: req.user.id, username: req.user.username,
    actionType: 'publish', entityType: 'content',
    entityId: req.body.production_line_id,
    detail: `Published folder "${req.body.folder_name}" to ${result.tv_count} TV(s) on line ${req.body.production_line_id}`,
  });
  success(res, result);
});

export const unpublish = asyncHandler(async (req, res) => {
  const result = await svc.unpublishContent(req.body, req.dbName);
  await logActivity({
    dbName: req.dbName, userId: req.user.id, username: req.user.username,
    actionType: 'unpublish', entityType: 'content',
    entityId: req.body.production_line_id,
    detail: `Unpublished content from production line ${req.body.production_line_id}`,
  });
  success(res, result);
});

export const downloadStatus   = asyncHandler(async (req, res) => success(res, await svc.getDownloadStatus(req.params.production_line_id, req.dbName)));
export const downloadComplete = asyncHandler(async (req, res) => success(res, await svc.markDownloadComplete(req.body.tv_id, req.body.production_line_id, req.dbName)));
