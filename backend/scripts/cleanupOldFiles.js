// scripts/cleanupOldFiles.js
// Finds files on disk that have no corresponding DB record and removes them
// Run manually: node scripts/cleanupOldFiles.js

import 'dotenv/config';
import fs           from 'fs';
import path         from 'path';
import { executeQuery } from '../src/config/database.js';
import env          from '../src/config/env.js';

const scanDir = async (dbName) => {
  const uploadPath = path.join(env.uploadDir, dbName);
  if (!fs.existsSync(uploadPath)) return;

  // Get all file_paths for this client from DB
  const dbFiles = await executeQuery(
    'SELECT file_path FROM media_bucket',
    [],
    dbName
  );
  const dbPaths = new Set(dbFiles.map((f) => f.file_path));

  // Walk disk
  const walkDir = (dir) => {
    fs.readdirSync(dir).forEach((entry) => {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        walkDir(full);
      } else {
        const relative = full.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
        if (!dbPaths.has(relative)) {
          fs.unlinkSync(full);
          console.log(`🗑️  Removed orphan: ${relative}`);
        }
      }
    });
  };

  walkDir(uploadPath);
};

const clients = await executeQuery(
  'SELECT database_name FROM clients WHERE is_active = 1',
  [],
  'master'
);

for (const { database_name } of clients) {
  console.log(`Scanning: ${database_name}`);
  await scanDir(database_name);
}

console.log('✅ Cleanup complete');
process.exit(0);
