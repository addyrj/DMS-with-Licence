// scripts/backupClientDb.js
// Exports a client DB as SQL using mysqldump
// Usage: node scripts/backupClientDb.js --client=abc_manufacturing_db

import 'dotenv/config';
import { execSync } from 'child_process';
import path         from 'path';
import fs           from 'fs';
import env          from '../src/config/env.js';

const args     = process.argv.slice(2);
const dbArg    = args.find((a) => a.startsWith('--client='));

if (!dbArg) {
  console.error('Usage: node scripts/backupClientDb.js --client=db_name');
  process.exit(1);
}

const dbName   = dbArg.split('=')[1];
const backupDir = path.join(process.cwd(), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const ts       = new Date().toISOString().replace(/[:.]/g, '-');
const outFile  = path.join(backupDir, `${dbName}_${ts}.sql`);

const cmd = `mysqldump -h ${env.db.host} -P ${env.db.port} -u ${env.db.user} -p${env.db.password} ${dbName} > ${outFile}`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✅ Backup saved: ${outFile}`);
} catch (err) {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
}
