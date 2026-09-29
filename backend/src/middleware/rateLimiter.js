// src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

// Set RATE_LIMIT_ENABLED=false in .env to disable all limits in development
const enabled = process.env.RATE_LIMIT_ENABLED !== 'false';

const makeLimit = (options) => {
  if (!enabled) return (req, res, next) => next(); // bypass in dev
  return rateLimit(options);
};

// Login: 20 attempts per 15 min per IP
export const loginLimiter = makeLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload: 50 per minute
export const uploadLimiter = makeLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { success: false, error: 'Upload rate limit exceeded.' },
});

// TV heartbeat: 200 per minute
export const tvLimiter = makeLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, error: 'TV request rate limit exceeded.' },
});
