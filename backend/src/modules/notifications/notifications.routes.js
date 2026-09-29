// src/modules/notifications/notifications.routes.js
import { Router }    from 'express';
import { body }      from 'express-validator';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import validate      from '../../middleware/validate.js';
import * as ctrl     from './notifications.controller.js';

const router  = Router();
const sa      = authorize(ROLES.SUPER_ADMIN);
const client  = authorize(ROLES.CLIENT_ADMIN, ROLES.EMPLOYEE);
const anyAuth = authorize(ROLES.SUPER_ADMIN, ROLES.CLIENT_ADMIN, ROLES.EMPLOYEE);

router.get('/admin',        sa,     ctrl.listNotifs);
router.post('/admin',       sa,     [body('title').trim().notEmpty(), body('message').trim().notEmpty()], validate, ctrl.createNotif);
router.delete('/admin/:id', sa,     ctrl.deleteNotif);
router.get('/my',           client, ctrl.myNotifs);
router.get('/my/unread',    anyAuth, ctrl.unreadCount);
router.patch('/my/read-all', client, ctrl.markAllRead);
router.patch('/my/:id/read', client, ctrl.markRead);

export default router;