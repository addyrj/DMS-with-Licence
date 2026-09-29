// src/database/migrationRunner.js
import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/database.js';
import logger      from '../utils/logger.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

const sql = (name) => path.join(migrationsDir, name);

// ── Master DB migration files ─────────────────────────────────
const MASTER_MIGRATIONS = [
  '001_master_schema.sql',
  '004_add_company_logo.sql',
  '005_add_notifications.sql',
  '006_add_used_media_mb.sql',
  'payment_migration.sql',    // payment_history table
  '012_master_v2_updates.sql', // subscription_logs + admin_email
];

// ── Per-client DB migration files ────────────────────────────
const CLIENT_MIGRATIONS = [
  '002_client_schema.sql',
  '003_add_display_metrics.sql',
  '007_announcements_and_doc_duration.sql',
  '008_announcement_targeting.sql',
  '009_publish_history.sql',
  '010_media_files_size.sql',
  '011_v2_schema_updates.sql', // production_line_displays + active_line + etc.
];

// ── Helpers ───────────────────────────────────────────────────
const parseSqlFile = (filePath) => {
  let sql = fs.readFileSync(filePath, 'utf8');
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  sql = sql.replace(/--[^\n]*/g, '');
  return sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
};

const isIgnorableError = (err) =>
  err.code === 'ER_DUP_FIELDNAME'      ||
  err.code === 'ER_TABLE_EXISTS_ERROR'  ||
  err.message?.includes('Duplicate column') ||
  err.message?.includes('already exists');

const runSqlFile = async (filePath, dbName, { ignoreDuplicates = true } = {}) => {
  if (!fs.existsSync(filePath)) {
    logger.warn(`[Migrate] File not found, skipping: ${path.basename(filePath)}`);
    return;
  }
  const statements = parseSqlFile(filePath);
  const pool = getPool(dbName);
  for (const stmt of statements) {
    try {
      await pool.execute(stmt);
    } catch (err) {
      if (ignoreDuplicates && isIgnorableError(err)) continue;
      logger.warn(`[Migrate] ${dbName} — ${err.message?.slice(0, 100)}`);
    }
  }
};

const recalcMediaMb = async () => {
  try {
    const { executeQuery } = await import('../config/database.js');
    const clients = await executeQuery('SELECT id, database_name FROM clients', [], 'master');
    if (!Array.isArray(clients) || clients.length === 0) return;
    for (const { id, database_name } of clients) {
      try {
        const rows = await executeQuery(
          'SELECT COALESCE(SUM(file_size_mb), 0) AS total FROM media_bucket', [], database_name
        );
        const total = parseFloat((Array.isArray(rows) ? rows[0]?.total : 0) || 0);
        await executeQuery('UPDATE clients SET used_media_mb = ? WHERE id = ?', [total, id], 'master');
      } catch { }
    }
    logger.info('[Migrate] ✅ used_media_mb recalculated');
  } catch (err) {
    logger.warn(`[Migrate] used_media_mb skip: ${err.message}`);
  }
};

// ── Public API ────────────────────────────────────────────────
export const runMasterMigrations = async () => {
  logger.info('[Migrate] Running master_db migrations...');
  for (const file of MASTER_MIGRATIONS) {
    await runSqlFile(sql(file), 'master');
  }
  logger.info('[Migrate] ✅ master_db ready');
};

export const runClientMigrations = async (dbName) => {
  logger.info(`[Migrate] Running client migrations [${dbName}]...`);
  for (const file of CLIENT_MIGRATIONS) {
    await runSqlFile(sql(file), dbName);
  }
  logger.info(`[Migrate] ✅ ${dbName} ready`);
};

export const runIncrementalMigrations = async () => {
  try {
    const { executeQuery } = await import('../config/database.js');
    const clients = await executeQuery('SELECT database_name FROM clients WHERE is_active=1', [], 'master');
    if (!Array.isArray(clients) || clients.length === 0) return;

    let applied = 0;
    for (const { database_name } of clients) {
      try {
        for (const file of CLIENT_MIGRATIONS) {
          await runSqlFile(sql(file), database_name);
        }
        applied++;
      } catch (err) {
        logger.warn(`[Migrate] Skipped [${database_name}]: ${err.message}`);
      }
    }
    if (applied > 0) logger.info(`[Migrate] ✅ Incremental migrations applied to ${applied} client DB(s)`);
    await recalcMediaMb();
  } catch (err) {
    logger.warn(`[Migrate] Incremental check failed: ${err.message}`);
  }
};