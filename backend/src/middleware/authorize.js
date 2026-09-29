// src/middleware/authorize.js
// Role-based route guard
// Usage: authorize(ROLES.SUPER_ADMIN)  or  authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN)

import { error } from '../utils/response.js';

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user)                           return error(res, 'Authentication required', 401);
  if (!allowedRoles.includes(req.user.role)) return error(res, 'Insufficient permissions', 403);
  next();
};
