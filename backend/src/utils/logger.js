// src/utils/logger.js
// Winston logger — console in dev, files in prod

import { createLogger, format, transports } from 'winston';
import env from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) =>
    `${timestamp} [${level}]: ${stack || message}`
  )
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: env.nodeEnv === 'production' ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    ...(env.nodeEnv === 'production' ? [
      new transports.File({ filename: 'logs/error.log',    level: 'error' }),
      new transports.File({ filename: 'logs/combined.log'  }),
    ] : []),
  ],
});

export default logger;
