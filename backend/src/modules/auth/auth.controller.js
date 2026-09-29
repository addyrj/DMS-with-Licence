// src/modules/auth/auth.controller.js

import asyncHandler            from '../../utils/asyncHandler.js';
import { success, error }      from '../../utils/response.js';
import { superAdminLogin, clientLogin } from './auth.service.js';

export const loginSuperAdmin = asyncHandler(async (req, res) => {
  const data = await superAdminLogin(req.body);
  success(res, data);
});

export const loginClient = asyncHandler(async (req, res) => {
  const data = await clientLogin(req.body);
  success(res, data);
});

export const refresh = asyncHandler(async (req, res) => {
  // req.user set by authenticateToken middleware
  const { refreshToken } = await import('./auth.service.js');
  const data = await refreshToken(req.user);
  success(res, data);
});

export const logout = asyncHandler(async (req, res) => {
  // Stateless JWT — client discards token. Log the event.
  // If Redis blacklist needed, add here: await redis.set(`bl:${token}`, 1, 'EX', ttl)
  success(res, { message: 'Logged out successfully' });
});
