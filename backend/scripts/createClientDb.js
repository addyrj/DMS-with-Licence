// scripts/createClientDb.js
// Manual utility: node scripts/createClientDb.js --name="ABC Corp"
// Creates a client DB + runs migrations without going through the API
// Useful in dev/debug when you need to manually provision a DB

import 'dotenv/config';
import { createDatabase } from '../src/config/database.js';
import { runClientMigrations } from '../src/database/migrationRunner.js';
import { slugify } from '../src/utils/slugify.js';

const args   = process.argv.slice(2);
const nameArg = args.find((a) => a.startsWith('--name='));

if (!nameArg) {
  console.error('Usage: node scripts/createClientDb.js --name="Company Name"');
  process.exit(1);
}

const name   = nameArg.split('=').slice(1).join('=');
const dbName = slugify(name);

console.log(`Creating DB: ${dbName}`);
await createDatabase(dbName);
await runClientMigrations(dbName);
console.log(`✅ Done: ${dbName}`);
process.exit(0);
