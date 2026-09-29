// src/modules/dashboard/dashboard.routes.js

import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import * as ctrl     from './dashboard.controller.js';

const router = Router();
const all    = authorize(ROLES.SUPER_ADMIN, ROLES.CLIENT_ADMIN, ROLES.EMPLOYEE);
const admin  = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);
const sa     = authorize(ROLES.SUPER_ADMIN);

// GET /api/dashboard — role-aware: SA gets system view, CA gets their own
router.get('/',              all,   ctrl.overview);

// GET /api/dashboard/system — explicit system-wide (SA only)
router.get('/system',        sa,    ctrl.superAdminOverview);

// GET /api/dashboard/client — own client stats (CA) or specify ?client_db=name (SA)
router.get('/client',        admin, ctrl.clientOverview);

// GET /api/dashboard/client/:id — SA views a specific client's dashboard
router.get('/client/:id',    sa,    ctrl.specificClientOverview);

// GET /api/dashboard/activity — activity log (admin sees all, employee sees own)
router.get('/activity',      admin, ctrl.activityLog);

export default router;
