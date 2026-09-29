// src/modules/auth/auth.routes.js

import { Router } from 'express';
import { loginRules }                    from './auth.validations.js';
import { loginSuperAdmin, loginClient }  from './auth.controller.js';
import { loginLimiter }                  from '../../middleware/rateLimiter.js';
import validate                          from '../../middleware/validate.js';

const router = Router();

// POST /api/auth/superadmin/login
router.post('/superadmin/login', loginLimiter, loginRules, validate, loginSuperAdmin);

// POST /api/auth/login  (client admin or employee)
router.post('/login',            loginLimiter, loginRules, validate, loginClient);

export default router;

// Import controller additions
import { refresh, logout } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

// POST /api/auth/refresh  (requires valid JWT)
router.post('/refresh', authenticateToken, refresh);

// POST /api/auth/logout   (requires valid JWT)
router.post('/logout',  authenticateToken, logout);
