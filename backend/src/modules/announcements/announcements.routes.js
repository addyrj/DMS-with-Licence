// src/modules/announcements/announcements.routes.js
// UPDATED: EMPLOYEE role now allowed (restricted to their line in service)
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import { body }      from 'express-validator';
import validate      from '../../middleware/validate.js';
import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import { executeQuery } from '../../config/database.js';
import * as svc      from './announcements.service.js';

const router  = Router();
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE);

// GET all (admin sees all, employee sees their line's)
router.get('/', anyUser, asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getAnnouncements(req.dbName, { limit, offset });
  paginatedSuccess(res, success, 'announcements', rows, total, { page, limit });
}));

router.get('/active', asyncHandler(async (req, res) => {
  const dbName = req.query.db_name || req.dbName;
  if (!dbName) return res.status(400).json({ error: 'db_name required' });
  success(res, { announcements: await svc.getActiveAnnouncements(dbName) });
}));

// POST — admin can target all/line/display; employee auto-restricted to their line
router.post('/', anyUser,
  [
    body('message').trim().notEmpty().withMessage('Message required'),
    body('type').isIn(['good-news','alert','info']).withMessage('Invalid type'),
    body('duration_minutes').isInt({ min:1, max:480 }).withMessage('Duration 1–480 min'),
    body('target_type').optional().isIn(['all','line','display']),
    body('target_line_id').optional({ nullable:true }).isInt({ min:1 }),
    body('target_display_id').optional({ nullable:true }).isInt({ min:1 }),
  ], validate,
  asyncHandler(async (req, res) => {
    let { target_type, target_line_id, target_display_id } = req.body;

    // EMPLOYEE restriction: can only target their assigned line or a display in it
    if (req.user.role === ROLES.EMPLOYEE) {
      const empRows = await executeQuery(
        'SELECT production_line_id FROM employee_users WHERE user_id = ?', [req.user.id], req.dbName
      );
      const emp = Array.isArray(empRows) ? empRows[0] : null;
      if (!emp?.production_line_id)
        return res.status(403).json({ success: false, error: 'No production line assigned — cannot send announcements' });

      // Force target to their line — no "all" option for employees
      if (!target_type || target_type === 'all') target_type = 'line';
      target_line_id = emp.production_line_id;

      // If targeting a display, verify it's in their line
      if (target_type === 'display' && target_display_id) {
        const [inLine] = await executeQuery(
          `SELECT d.id FROM displays d
           JOIN production_line_displays pld ON pld.display_id = d.id
           WHERE d.id = ? AND pld.production_line_id = ?`,
          [target_display_id, emp.production_line_id], req.dbName
        );
        if (!inLine)
          return res.status(403).json({ success: false, error: 'Display not in your production line' });
      }
    }

    const ann = await svc.createAnnouncement(
      { ...req.body, target_type, target_line_id, target_display_id },
      req.dbName
    );
    success(res, ann, 201);
  })
);

router.delete('/:id', admin, asyncHandler(async (req, res) => {
  success(res, await svc.deleteAnnouncement(req.params.id, req.dbName));
}));

export default router;
