// src/modules/clients/clients.routes.js
import { Router }   from 'express';
import { body }     from 'express-validator';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }    from '../../constants/roles.js';
import validate     from '../../middleware/validate.js';
import {
  createClientRules, updateClientRules,
  storageUpgradeRules, subscriptionRules,
} from './clients.validations.js';
import * as ctrl from './clients.controller.js';

const router = Router();
const sa     = authorize(ROLES.SUPER_ADMIN);

// ── CRUD ──────────────────────────────────────────────────────────────
router.get('/',                                    sa, ctrl.listClients);
router.get('/:id',                                 sa, ctrl.getClient);
router.post('/',          createClientRules, validate, sa, ctrl.createClient);
router.patch('/:id',      updateClientRules, validate, sa, ctrl.editClient);
router.delete('/:id',                              sa, ctrl.removeClient);

// ── Status / Storage / Subscription / Permissions ─────────────────────
router.patch('/:id/status',                        sa, ctrl.toggleStatus);
router.patch('/:id/storage',   storageUpgradeRules, validate, sa, ctrl.addStorage);
router.patch('/:id/displays',  sa, ctrl.addDisplays);
router.patch('/:id/subscription', subscriptionRules, validate, sa, ctrl.changeSubscription);
router.patch('/:id/permissions',                   sa, ctrl.editPermissions);

// ── Logo upload (SA uploads for any client) ────────────────────────────
router.post('/:id/logo', sa, ctrl.logoUpload.single('logo'), ctrl.uploadLogo);

// ── Reset client admin password ────────────────────────────────────────
router.patch('/:id/reset-password', sa,
  [body('new_password').isLength({ min: 8 }).withMessage('Password min 8 chars')],
  validate, ctrl.resetAdminPassword
);

// ── Sub-resources ──────────────────────────────────────────────────────
router.get('/:id/subscription-logs', sa, ctrl.subscriptionLogs);
router.get('/:id/displays',          sa, ctrl.clientDisplays);
router.get('/:id/users',             sa, ctrl.clientUsers);

// ── FIX: hierarchical line→display view + remove user/display ──────────
router.get('/:id/lines',                       sa, ctrl.linesWithDisplays);
router.delete('/:id/users/:userId',            sa, ctrl.removeClientUser);
router.delete('/:id/displays/:displayId',      sa, ctrl.removeClientDisplay);

export default router;
