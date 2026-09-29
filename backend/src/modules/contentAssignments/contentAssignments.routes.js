// src/modules/contentAssignments/contentAssignments.routes.js
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import validate      from '../../middleware/validate.js';
import { createAssignmentRules, updateAssignmentRules } from './contentAssignments.validations.js';
import * as ctrl from './contentAssignments.controller.js';

const router  = Router();
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);

router.get('/',                    anyUser, ctrl.listAssignments);
router.get('/display/:display_id', anyUser, ctrl.listByDisplay);
router.get('/:id',                 anyUser, ctrl.getAssignment);

// Employees CAN create/update/delete their own assignments
// No checkPermission() — role check (authorize) is sufficient
router.post('/',            anyUser, createAssignmentRules, validate, ctrl.createAssignment);
router.patch('/:id',        anyUser, updateAssignmentRules, validate, ctrl.updateAssignment);
router.patch('/:id/toggle', anyUser, ctrl.toggleAssignment);
router.delete('/:id',       anyUser, ctrl.removeAssignment);

export default router;
