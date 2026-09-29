// src/modules/publish/publish.routes.js
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import validate      from '../../middleware/validate.js';
import { publishRules, unpublishRules } from './publish.validations.js';
import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc from './publish.service.js';

const router  = Router();
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);

// Middleware: if employee, verify they own the production_line_id in body
const checkLineAccess = (req, res, next) => {
  if (req.user?.role === 'EMPLOYEE' && req.user?.production_line_id) {
    const bodyLineId = Number(req.body.production_line_id);
    const userLineId = Number(req.user.production_line_id);
    if (bodyLineId && bodyLineId !== userLineId) {
      return res.status(403).json({ error: 'You can only manage your assigned production line' });
    }
  }
  next();
};

router.post('/', anyUser, publishRules, validate, checkLineAccess, asyncHandler(async (req, res) => {
  const result = await svc.publishContent(req.body, req.dbName, req.user.id);
  success(res, result);
}));

// Pause
router.post('/unpublish', anyUser, unpublishRules, validate, checkLineAccess, asyncHandler(async (req, res) => {
  success(res, await svc.unpublishContent(req.body, req.dbName));
}));

// Resume
router.post('/republish', anyUser, unpublishRules, validate, checkLineAccess, asyncHandler(async (req, res) => {
  success(res, await svc.republishContent(req.body, req.dbName));
}));

// Permanent delete
router.post('/delete', anyUser, unpublishRules, validate, checkLineAccess, asyncHandler(async (req, res) => {
  success(res, await svc.deletePublishedContent(req.body, req.dbName));
}));

router.get('/status/:id', anyUser, asyncHandler(async (req, res) => {
  success(res, await svc.getDownloadStatus(req.params.id, req.dbName));
}));

router.get('/history', anyUser, asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getPublishHistory(req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'history', rows, total, { page, limit });
}));

router.delete('/history/:id', anyUser, asyncHandler(async (req, res) => {
  success(res, await svc.deletePublishHistory(req.params.id, req.dbName));
}));

export default router;