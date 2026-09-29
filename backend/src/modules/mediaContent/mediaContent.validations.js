// src/modules/mediaContent/mediaContent.validations.js
import { body, param } from 'express-validator';

export const durationRules = [
  param('id').isInt().withMessage('Invalid ID'),
  body('duration').isInt({ min: 0 }).withMessage('Duration must be >= 0 seconds'),
  // FIX: allow doc_duration for PDF per-page duration
  body('doc_duration').optional({ nullable: true }).isInt({ min: 1 }).withMessage('doc_duration must be >= 1'),
];

export const volumeRules = [
  param('id').isInt().withMessage('Invalid ID'),
  body('volume_level').isInt({ min: 0, max: 100 }).withMessage('Volume must be 0-100'),
];

export const uploadImageRules = [
  body('production_line_id').isInt().withMessage('production_line_id required'),
  body('display_number').trim().notEmpty().withMessage('display_number required'),
  body('duration').optional().isInt({ min: 0 }),
  body('doc_duration').optional().isInt({ min: 1 }),
];