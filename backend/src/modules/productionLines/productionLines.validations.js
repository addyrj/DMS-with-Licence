// src/modules/productionLines/productionLines.validations.js
import { body, param } from 'express-validator';

export const createLineRules = [
  body('production_line_name').trim().notEmpty().withMessage('Line name is required'),
  body('display_ids').optional().isArray(),
];
export const updateOrderRules = [
  param('id').isInt(),
  body('tv_order').isArray().withMessage('tv_order must be an array'),
];
