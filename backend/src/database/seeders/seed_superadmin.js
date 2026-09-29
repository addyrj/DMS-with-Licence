// src/database/seeders/seed_superadmin.js
// Run with: node src/database/seeders/seed_superadmin.js
// Seeds the master DB with the superadmin credentials from .env

import 'dotenv/config';
import { executeQuery } from '../../config/database.js';
import { hashPassword } from '../../utils/hash.js';
import logger           from '../../utils/logger.js';

const seed = async () => {
  const username = process.env.SUPERADMIN_USERNAME;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!username || !password) {
    logger.error('SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  // Super admin lives in env — nothing to seed into DB
  // But we log confirmation
  logger.info(`✅ Super admin configured: ${username}`);
  logger.info('No DB seeding needed — superadmin is environment-based.');
  process.exit(0);
};

seed();
