// src/modules/contentAssignments/contentAssignments.validations.js
import { body, param } from 'express-validator';

export const createAssignmentRules = [
  body('media_bucket_id').optional({ nullable:true }).isInt({ min: 1 }),
  // display_id (single) OR display_ids (array) — at least one must be present
  body('display_id').optional({ nullable:true }).isInt({ min: 1 }),
  body('display_ids').optional({ nullable:true }).isArray(),
  body('display_ids.*').optional().isInt({ min: 1 }),
  // FIX: duration 0 is valid (means natural/no-limit); backend converts 0 → null
  body('duration_seconds').optional({ nullable:true }).isInt({ min: 0 }),
];

export const updateAssignmentRules = [
  param('id').isInt().withMessage('Invalid assignment ID'),
  body('is_active').optional().isBoolean(),
  body('duration_seconds').optional({ nullable:true }).isInt({ min: 0 }),
];
