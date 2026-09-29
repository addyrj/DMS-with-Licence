// server.js
import 'dotenv/config';
import app                               from './src/app.js';
import { testConnection, closeAllPools } from './src/config/database.js';
import { connectMqtt, disconnectMqtt }  from './src/config/mqtt.js';
import { startJobs, stopJobs }           from './src/jobs/index.js';
import { runMasterMigrations, runIncrementalMigrations } from './src/database/migrationRunner.js';
import { enforceLicenseOrExit }          from './src/config/license.js';
import logger                            from './src/utils/logger.js';

const PORT = process.env.PORT || 3000;
let server         = null;
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received — shutting down`);
  const cleanup = async () => {
    try { stopJobs(); }             catch {}
    try { await disconnectMqtt(); } catch {}
    try { await closeAllPools(); }  catch {}
    process.exit(signal === 'EXCEPTION' || signal === 'REJECTION' ? 1 : 0);
  };
  if (server) {
    server.close(() => cleanup());
    setTimeout(() => process.exit(1), 10_000).unref();
  } else {
    await cleanup();
  }
};

process.on('SIGTERM',            () => shutdown('SIGTERM'));
process.on('SIGINT',             () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error(`Uncaught: ${err.message}\n${err.stack}`); shutdown('EXCEPTION'); });
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logger.error(`Unhandled Rejection: ${msg}`);
  shutdown('REJECTION');
});

try {
  logger.info('Starting DMS Backend...');
  await enforceLicenseOrExit();                 // 0. License must be valid - exits process if not
  await testConnection();                      // 1. Connect + auto-create DB
  await runMasterMigrations();                 // 2. Master tables
  await runIncrementalMigrations();            // 3. Apply new fields to existing client DBs
  logger.info('✅ All tables ready');
  connectMqtt();                               // 4. MQTT — non-blocking
  server = app.listen(PORT, () => {
    logger.info(`🚀 Server ready → http://localhost:${PORT}`);
    startJobs();                               // 5. Background jobs AFTER listen
  });
  server.on('error', (err) => {
    logger.error(err.code === 'EADDRINUSE'
      ? `❌ Port ${PORT} already in use — change PORT in .env`
      : `❌ Server error: ${err.message}`);
    process.exit(1);
  });
} catch (err) {
  logger.error(`❌ Startup failed: ${err.message}\n${err.stack}`);
  process.exit(1);
}
