// src/modules/health/health.routes.js

import { Router }    from 'express';
import asyncHandler  from '../../utils/asyncHandler.js';
import { getPool }   from '../../config/database.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}));

router.get('/detailed', asyncHandler(async (req, res) => {
  let dbOk = false;
  try {
    await getPool('master').execute('SELECT 1');
    dbOk = true;
  } catch {}

  res.json({
    status: dbOk ? 'ok' : 'degraded',
    db:     dbOk ? 'connected' : 'error',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
}));

export default router;
