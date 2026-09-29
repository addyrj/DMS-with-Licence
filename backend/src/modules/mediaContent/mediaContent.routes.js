// src/modules/mediaContent/mediaContent.routes.js
import { Router }           from 'express';
import { authorize }        from '../../middleware/authorize.js';
import { checkPermission }  from '../../middleware/permission.js';
import { uploadMiddleware }  from '../../middleware/upload.js';
import { uploadLimiter }     from '../../middleware/rateLimiter.js';
import { ROLES }             from '../../constants/roles.js';
import { PERMISSIONS }       from '../../constants/permissions.js';
import validate              from '../../middleware/validate.js';
import { durationRules, uploadImageRules } from './mediaContent.validations.js';
import * as ctrl from './mediaContent.controller.js';

const router  = Router();
// FIX: anyUser includes EMPLOYEE so they can manage their production line's content
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);

router.get('/',                           anyUser, ctrl.listContent);
router.get('/by-line/:lineId',            anyUser, ctrl.contentByLine);
router.get('/:id',                        anyUser, ctrl.getContent);
// FIX: employee needs to expand rows → must read files
router.get('/:id/files',                  anyUser, ctrl.getFiles);
router.patch('/:id/duration',             anyUser, durationRules, validate, ctrl.setDuration);
router.patch('/file/:file_id/sequence',   anyUser, ctrl.setFileSequence);
// FIX: employee can delete files from their line's playlist
router.delete('/file/:file_id',           anyUser, ctrl.removeFile);
router.post('/direct-upload',             anyUser, checkPermission(PERMISSIONS.UPLOAD_FILES), uploadLimiter,
            uploadMiddleware.array('images', 20), uploadImageRules, validate, ctrl.directUpload);

export default router;