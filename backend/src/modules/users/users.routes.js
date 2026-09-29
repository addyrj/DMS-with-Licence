// src/modules/users/users.routes.js
// src/modules/users/users.routes.js
import { Router }              from 'express';
import { authorize }           from '../../middleware/authorize.js';
import { checkPermission }     from '../../middleware/permission.js';
import { ROLES }               from '../../constants/roles.js';
import { PERMISSIONS }         from '../../constants/permissions.js';
import { body }                from 'express-validator';
import validate                from '../../middleware/validate.js';
import { createUserRules, updateUserRules } from './users.validations.js';
import * as ctrl               from './users.controller.js';

const router       = Router();
const adminOrSuper = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);
const anyUser      = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);

// Employees can READ (needed for employee dashboard to show their own display info)
router.get('/',                         anyUser,      ctrl.listUsers);
router.get('/:id',                      anyUser,      ctrl.getUser);

// Only admins can create/edit/delete
router.post('/',                        adminOrSuper, checkPermission(PERMISSIONS.CREATE_USERS), createUserRules, validate, ctrl.createUser);
router.patch('/:id',                    adminOrSuper, updateUserRules, validate, ctrl.updateUser);
router.patch('/:id/toggle-status',      adminOrSuper, ctrl.toggleStatus);
router.patch('/:id/password',           adminOrSuper,
  [body('new_password').isLength({ min: 8 }).withMessage('Password min 8 chars')], validate,
  ctrl.changePassword);
router.delete('/:id',                   adminOrSuper, ctrl.removeUser);

export default router;