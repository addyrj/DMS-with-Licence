// src/modules/displays/displays.routes.js
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import validate      from '../../middleware/validate.js';
import { body }      from 'express-validator';
import { createDisplayRules, volumeRules } from './displays.validations.js';
import * as ctrl from './displays.controller.js';

const router  = Router();
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);

router.get('/limit',              admin,   ctrl.getLimit);
router.get('/',                   anyUser, ctrl.listDisplays);
router.get('/:id',                anyUser, ctrl.getDisplay);
router.get('/:id/status',         anyUser, ctrl.getStatus);
// FIX: employee needs to see file errors to manage their line's content
router.get('/:id/errors',         anyUser, ctrl.getErrors);
router.post('/',                  admin, createDisplayRules, validate, ctrl.createDisplay);
router.patch('/:id',              admin, ctrl.editDisplay);
router.patch('/:id/volume',       anyUser, volumeRules, validate, ctrl.updateVolume);
router.patch('/:id/reset-password', admin,
  [body('new_password').isLength({ min: 6 }).withMessage('Password min 6 chars')], validate,
  ctrl.resetPassword);
router.delete('/:id',             admin, ctrl.removeDisplay);

export default router;