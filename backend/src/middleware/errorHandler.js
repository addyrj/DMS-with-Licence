// src/middleware/errorHandler.js
// Global error handler — must be registered last in app.js

import logger from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ success: false, error: 'File too large (max 200 MB)' });

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY')
    return res.status(409).json({ success: false, error: 'Duplicate entry — record already exists' });

  // MySQL foreign key constraint
  if (err.code === 'ER_NO_REFERENCED_ROW_2')
    return res.status(400).json({ success: false, error: 'Referenced record does not exist' });

  const statusCode = err.statusCode || 500;
  const message    = err.isOperational ? err.message : 'Internal server error';
  res.status(statusCode).json({ success: false, error: message });
};
