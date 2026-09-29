// src/middleware/auth.js
// Verify JWT from Authorization header → sets req.user

import { verifyToken } from '../utils/jwt.js';
import { error }       from '../utils/response.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader?.split(' ')[1];

  if (!token) return error(res, 'Access token required', 401);

  const decoded = verifyToken(token);
  if (!decoded)  return error(res, 'Invalid or expired token', 403);

  req.user = decoded;   // { id, username, role, client_id, db_name }
  next();
};
