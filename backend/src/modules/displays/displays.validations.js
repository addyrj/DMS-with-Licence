// src/modules/displays/displays.validations.js
import { body, param } from 'express-validator';

export const createDisplayRules = [
  body('display_name').trim().notEmpty().withMessage('Display name is required'),
  body('display_number').trim().notEmpty().withMessage('Display number is required'),
  body('display_password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
];
export const volumeRules = [
  param('id').isInt(),
  body('volume_level').isInt({ min: 0, max: 100 }).withMessage('Volume must be 0–100'),
];
