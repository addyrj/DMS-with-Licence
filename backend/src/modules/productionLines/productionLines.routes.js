// src/modules/productionLines/productionLines.routes.js
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import validate      from '../../middleware/validate.js';
import { body }      from 'express-validator';
import { executeQuery } from '../../config/database.js';
import * as ctrl     from './productionLines.controller.js';

const router  = Router();
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);

const lineRules = [
  body('production_line_name').trim().notEmpty().withMessage('Name required'),
  body('description').optional({ nullable:true }).trim(),
];

router.get('/',             anyUser, ctrl.getLines);
router.get('/assigned',     anyUser, ctrl.getAssignedDisplayIds);

// FIX: Use media_content as source of truth — works even if production_line_displays is empty
router.get('/by-display/:displayId', anyUser, asyncHandler(async (req, res) => {
  const displayId = Number(req.params.displayId);
  if (!displayId) return success(res, { line: null });

  try {
    // Primary: check media_content (most reliable — always set when publishing)
    const rows = await executeQuery(
      `SELECT pl.* FROM production_lines pl
       JOIN media_content mc ON mc.production_line_id = pl.id
       WHERE mc.display_id = ?
       LIMIT 1`,
      [displayId], req.dbName
    );
    const line = Array.isArray(rows) && rows[0] ? rows[0] : null;

    if (line) return success(res, { line });

    // Fallback: check production_line_displays join table
    const rows2 = await executeQuery(
      `SELECT pl.* FROM production_lines pl
       JOIN production_line_displays pld ON pld.production_line_id = pl.id
       WHERE pld.display_id = ?
       LIMIT 1`,
      [displayId], req.dbName
    );
    const line2 = Array.isArray(rows2) && rows2[0] ? rows2[0] : null;
    return success(res, { line: line2 });

  } catch (err) {
    // If any query fails — return null gracefully (no 500)
    return success(res, { line: null });
  }
}));

router.get('/:id',              anyUser, ctrl.getLineById);
router.get('/:id/displays',     anyUser, ctrl.getDisplaysByLine);

router.post('/',                admin, lineRules, validate, ctrl.createLine);
router.patch('/:id',            admin, ctrl.updateLine);
router.patch('/:id/active',     admin, ctrl.toggleActiveLine);
router.patch('/:id/displays',   admin, ctrl.updateLineDisplays);
router.patch('/:id/tv-order',   admin, ctrl.updateTvOrder);
router.delete('/:id',           admin, ctrl.deleteLine);

export default router;