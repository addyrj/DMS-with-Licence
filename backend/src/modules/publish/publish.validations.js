// src/modules/publish/publish.validations.js
import { body } from 'express-validator';

export const publishRules = [
  body('production_line_id').optional({ nullable:true }).toInt().isInt({ min:1 }),
  body('all_lines').optional().isBoolean(),
  body('folder_name').trim().notEmpty().withMessage('folder_name required'),
  body('duration').toInt().isInt({ min:0 }),
  body('doc_duration').optional({ nullable:true }).toInt().isInt({ min:5 }),
  body('display_ids').optional({ nullable:true }).isArray(),
  body('display_ids.*').optional().isInt({ min:1 }),
  body('file_ids').optional({ nullable:true }).isArray(),
  body('file_ids.*').optional().isInt({ min:1 }),
  body('append_mode').optional().isBoolean(),
  body('file_repeats').optional({ nullable:true }).isObject(),  // {fileId: repeatCount}  // ISSUE 7: allow append_mode
];

export const unpublishRules = [
  body('production_line_id').toInt().isInt({ min:1 }).withMessage('production_line_id required'),
];