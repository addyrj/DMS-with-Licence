// src/modules/tv/tv.validations.js
import { body } from 'express-validator';

export const tvLoginRules = [
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  body('db_name').optional({ checkFalsy: true }).trim(), // optional — auto-detected from display username if not provided
];

export const statusRules = [
  body('tv_id').isInt(),
  body('status').isIn(['ONLINE','OFFLINE']),
  body('db_name').trim().notEmpty(),
  body('temperature').optional().isString(),
  body('uptime_minutes').optional().isInt({ min: 0 }),
  body('content_loops').optional().isInt({ min: 0 }),
  body('play_time_minutes').optional().isInt({ min: 0 }),
];

export const storageRules = [
  body('tv_id').isInt(),
  body('storage_available').trim().notEmpty(),
  body('db_name').trim().notEmpty(),
];

export const errorRules = [
  body('tv_id').isInt(),
  body('db_name').trim().notEmpty(),
  body('error_type').isIn(['playback','download','network','hardware','other']),
  body('error_message').optional().isString(),
];
