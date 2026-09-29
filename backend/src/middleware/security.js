// src/middleware/security.js
import helmet from 'helmet';
import cors   from 'cors';
import env    from '../config/env.js';

// Parse allowed origins — '*' means allow all (dev only)
const allowedOrigins = env.corsOrigin === '*'
  ? null   // null = allow all
  : env.corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    // Allow all if wildcard
    if (!allowedOrigins) return callback(null, true);
    // Check against whitelist
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods:          ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders:   ['Content-Type', 'Authorization'],
  exposedHeaders:   ['Authorization'],
  credentials:      true,
  optionsSuccessStatus: 200,   // some browsers (IE11) choke on 204
};

// Helmet with relaxed CSP for API — no frontend served from here
const helmetOptions = {
  contentSecurityPolicy: false,   // API only — no HTML pages
  crossOriginEmbedderPolicy: false,
};

export const securityMiddleware = [
  helmet(helmetOptions),
  cors(corsOptions),
  // Handle preflight OPTIONS for ALL routes
  (req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  },
];