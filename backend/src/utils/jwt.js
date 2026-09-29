// src/utils/jwt.js
// JWT generate + verify helpers

import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const generateToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiry });

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
};
