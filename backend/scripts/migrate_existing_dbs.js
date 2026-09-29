// scripts/migrate_existing_dbs.js
// Run once: node scripts/migrate_existing_dbs.js
// Adds new columns to ALL existing client databases

import 'dotenv/config';
import mysql from 'mysql2/promise';

const config = {
  host:     process.env.DB_HOST || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

const STATEMENTS = [
  "ALTER TABLE displays ADD COLUMN temperature VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE displays ADD COLUMN temperature_status ENUM('normal','warning','critical') DEFAULT NULL",
  "ALTER TABLE displays ADD COLUMN uptime_today_minutes INT DEFAULT 0",
  "ALTER TABLE displays ADD COLUMN last_uptime_reset DATE DEFAULT NULL",
  "ALTER TABLE displays ADD COLUMN content_loops_today INT DEFAULT 0",
  "ALTER TABLE displays ADD COLUMN total_play_time_min INT DEFAULT 0",
  "ALTER TABLE media_bucket ADD COLUMN file_checksum VARCHAR(64) DEFAULT NULL",
  "ALTER TABLE media_bucket ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  "ALTER TABLE media_content ADD COLUMN loop_interval_minutes INT DEFAULT 15",
  "ALTER TABLE media_content ADD COLUMN playlist_mode ENUM('loop','once','scheduled') DEFAULT 'loop'",
  `CREATE TABLE IF NOT EXISTS display_error_logs (
    id             BIGINT     PRIMARY KEY AUTO_INCREMENT,
    display_id     BIGINT     NOT NULL,
    error_type     ENUM('playback','download','network','hardware','other') NOT NULL,
    error_message  TEXT,
    occurred_at    TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_display  (display_id),
    INDEX idx_type     (error_type),
    INDEX idx_occurred (occurred_at),
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function run() {
  // Connect to master
  const master = await mysql.createConnection({ ...config, database: process.env.DB_NAME || 'master_db' });

  // Get all client databases
  const [clients] = await master.execute('SELECT database_name FROM clients');
  await master.end();

  console.log(`Found ${clients.length} client database(s)`);

  for (const { database_name } of clients) {
    console.log(`\nMigrating: ${database_name}`);
    const conn = await mysql.createConnection({ ...config, database: database_name });

    for (const sql of STATEMENTS) {
      try {
        await conn.execute(sql);
        const col = sql.match(/ADD COLUMN (\w+)/)?.[1] || 'table';
        console.log(`  ✅ ${col}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          const col = sql.match(/ADD COLUMN (\w+)/)?.[1] || 'table';
          console.log(`  ⏭  ${col} (already exists)`);
        } else {
          console.log(`  ❌ Error: ${err.message}`);
        }
      }
    }

    await conn.end();
  }

  console.log('\n✅ Done! Restart your backend server now.');
  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });