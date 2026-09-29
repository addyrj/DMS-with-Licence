// src/modules/subscription/subscription.routes.js
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import * as svc from './subscription.service.js';

const router  = Router();
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);

router.get('/status', anyUser, asyncHandler(async (req, res) => {
  const clientId = req.clientId || req.user?.client_id;
  success(res, await svc.getSubscriptionStatus(clientId));
}));

export default router;
