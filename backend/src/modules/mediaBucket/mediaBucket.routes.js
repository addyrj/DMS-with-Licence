// src/modules/mediaBucket/mediaBucket.routes.js
// BUG FIX: rename and reorder now allow anyUser (employee needs these too)
import { Router }          from 'express';
import { authorize }       from '../../middleware/authorize.js';
import { checkPermission } from '../../middleware/permission.js';
import { ROLES }           from '../../constants/roles.js';
import { PERMISSIONS }     from '../../constants/permissions.js';
import { uploadMiddleware } from '../../middleware/upload.js';
import * as ctrl from './mediaBucket.controller.js';

const router  = Router();
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);

router.get('/folders',                anyUser, ctrl.listFolders);
router.get('/folders/:name',          anyUser, ctrl.folderFiles);
router.post('/upload',                anyUser, checkPermission(PERMISSIONS.UPLOAD_FILES), uploadMiddleware.array('files', 50), ctrl.uploadFiles);

// FIX: changed admin → anyUser for sequence and rename
// Employee needs to reorder and rename their own folders
router.patch('/sequence',             anyUser, ctrl.reorder);
router.patch('/folders/:name/rename', anyUser, ctrl.renameFolder);

router.delete('/:id',                 anyUser, checkPermission(PERMISSIONS.DELETE_CONTENT), ctrl.removeFile);
router.delete('/folders/:name',       anyUser, ctrl.removeFolder);

export default router;
