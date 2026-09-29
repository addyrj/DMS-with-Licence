// src/modules/mediaBucket/mediaBucket.validations.js
import { body } from 'express-validator';

export const uploadRules = [
  body('folder_name').trim().notEmpty().withMessage('folder_name is required'),
];
export const sequenceRules = [
  body('order').isArray({ min: 1 }).withMessage('order must be a non-empty array'),
  body('order.*.id').isInt(),
  body('order.*.sequence').isInt({ min: 1 }),
];
