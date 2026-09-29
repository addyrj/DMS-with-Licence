// src/config/database.js
// MySQL connection pool manager

import mysql  from 'mysql2/promise';
import env    from './env.js';
import logger from '../utils/logger.js';

const pools = {};

const baseConfig = {
  host:               env.db.host,
  port:               env.db.port,
  user:               env.db.user,
  password:           env.db.password || '',   // empty string = no password
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  enableKeepAlive:    true,
  connectTimeout:     10000,
};

// Create master pool immediately so getPool('master') never returns undefined
// testConnection() will verify it actually works before the server starts
pools.master = mysql.createPool({ ...baseConfig, database: env.db.name });

// ── Verify connection + auto-create DB if missing ─────────────────────────────
export const testConnection = async () => {
  // Try connecting WITHOUT specifying a database first
  // This handles "Unknown database" error gracefully
  const rootPool = mysql.createPool({ ...baseConfig });

  try {
    const conn = await rootPool.getConnection();
    await conn.ping();

    // Auto-create the master database if it doesn't exist
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${env.db.name}\``);
    conn.release();
    await rootPool.end();

    // Now recreate the master pool pointing at the actual database
    if (pools.master) {
      try { await pools.master.end(); } catch {}
    }
    pools.master = mysql.createPool({ ...baseConfig, database: env.db.name });

    // Final verify — make sure the named DB is actually accessible
    const verify = await pools.master.getConnection();
    await verify.ping();
    verify.release();

    logger.info(`✅ MySQL connected → ${env.db.host}:${env.db.port} / ${env.db.name}`);
  } catch (err) {
    try { await rootPool.end(); } catch {}

    logger.error('❌ MySQL connection FAILED. Check your .env settings.');
    logger.error(`   Host:     ${env.db.host}`);
    logger.error(`   Port:     ${env.db.port}`);
    logger.error(`   User:     ${env.db.user}`);
    logger.error(`   Password: ${env.db.password ? '(set)' : '(empty — OK for no-password root)'}`);
    logger.error(`   Database: ${env.db.name}`);
    logger.error(`   Error:    ${err.message}`);

    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      logger.error('   FIX → Wrong DB_USER or DB_PASSWORD in .env');
      logger.error('         Leave DB_PASSWORD= blank (no quotes, no spaces) for no-password root');
    } else if (err.code === 'ECONNREFUSED') {
      logger.error('   FIX → MySQL is not running');
      logger.error(`         Check DB_HOST=${env.db.host} and DB_PORT=${env.db.port}`);
    }
    process.exit(1);
  }
};

// ── Get or create a pool ──────────────────────────────────────────────────────
export const getPool = (dbName = 'master') => {
  if (!pools[dbName]) {
    pools[dbName] = mysql.createPool({ ...baseConfig, database: dbName });
    logger.info(`✅ Client DB pool created [${dbName}]`);
  }
  return pools[dbName];
};

// ── Execute a query ───────────────────────────────────────────────────────────
export const executeQuery = async (sql, params = [], dbName = 'master') => {
  const pool = getPool(dbName);
  const [result] = await pool.execute(sql, params);
  // For SELECT → result is an array of rows
  // For INSERT/UPDATE/DELETE → result is a ResultSetHeader object { insertId, affectedRows, ... }
  // Return result directly so callers can handle both cases
  return result;
};

// ── Execute a transaction ─────────────────────────────────────────────────────
export const executeTransaction = async (callback, dbName = 'master') => {
  const pool = getPool(dbName);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ── Create a client database ──────────────────────────────────────────────────
export const createDatabase = async (dbName) => {
  const pool = getPool('master');
  await pool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  pools[dbName] = mysql.createPool({ ...baseConfig, database: dbName });
  logger.info(`🗄️  Database created: ${dbName}`);
};

// ── Drop a client database ────────────────────────────────────────────────────
export const dropDatabase = async (dbName) => {
  if (pools[dbName]) {
    try { await pools[dbName].end(); } catch {}
    delete pools[dbName];
  }
  const pool = getPool('master');
  await pool.execute(`DROP DATABASE IF EXISTS \`${dbName}\``);
  logger.info(`🗑️  Database dropped: ${dbName}`);
};

// ── Close all pools on shutdown ───────────────────────────────────────────────
export const closeAllPools = async () => {
  await Promise.all(
    Object.entries(pools).map(async ([name, pool]) => {
      try { await pool.end(); logger.info(`Closed pool: ${name}`); }
      catch (err) { logger.warn(`Pool [${name}] already closed: ${err.message}`); }
    })
  );
};
