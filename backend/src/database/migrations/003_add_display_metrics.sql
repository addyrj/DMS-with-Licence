-- src/database/migrations/003_add_display_metrics.sql
-- Run this on ALL existing client databases to add the new fields
-- Safe to run multiple times (uses IF NOT EXISTS / column existence checks)

-- Add new display fields (ALTER TABLE safe with IF NOT EXISTS via stored procedure)
ALTER TABLE displays
  ADD COLUMN IF NOT EXISTS temperature            VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS temperature_status     ENUM('normal','warning','critical') DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uptime_today_minutes   INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_uptime_reset      DATE         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS content_loops_today    INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_play_time_min    INT          DEFAULT 0;
-- 003_add_display_metrics.sql
-- Each ALTER is separate so if one column already exists, others still run
-- migrationRunner ignores ER_DUP_FIELDNAME errors

ALTER TABLE displays ADD COLUMN temperature VARCHAR(20) DEFAULT NULL;
ALTER TABLE displays ADD COLUMN temperature_status ENUM('normal','warning','critical') DEFAULT NULL;
ALTER TABLE displays ADD COLUMN uptime_today_minutes INT DEFAULT 0;
ALTER TABLE displays ADD COLUMN last_uptime_reset DATE DEFAULT NULL;
ALTER TABLE displays ADD COLUMN content_loops_today INT DEFAULT 0;
ALTER TABLE displays ADD COLUMN total_play_time_min INT DEFAULT 0;

ALTER TABLE media_bucket ADD COLUMN file_checksum VARCHAR(64) DEFAULT NULL;
ALTER TABLE media_bucket ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE media_content ADD COLUMN loop_interval_minutes INT DEFAULT 15;
ALTER TABLE media_content ADD COLUMN playlist_mode ENUM('loop','once','scheduled') DEFAULT 'loop';

CREATE TABLE IF NOT EXISTS display_error_logs (
  id             BIGINT     PRIMARY KEY AUTO_INCREMENT,
  display_id     BIGINT     NOT NULL,
  error_type     ENUM('playback','download','network','hardware','other') NOT NULL,
  error_message  TEXT,
  occurred_at    TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_display  (display_id),
  INDEX idx_type     (error_type),
  INDEX idx_occurred (occurred_at),
  FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity logs table (added in Phase 4)
CREATE TABLE IF NOT EXISTS activity_logs (
  id           BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT        NOT NULL,
  username     VARCHAR(150)  NOT NULL,
  action_type  VARCHAR(50)   NOT NULL,
  entity_type  VARCHAR(50),
  entity_id    VARCHAR(100),
  detail       TEXT,
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_action  (action_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add duration_seconds to content_assignments (Phase 4)
ALTER TABLE content_assignments ADD COLUMN duration_seconds INT DEFAULT 10;

-- Add new media_bucket fields
ALTER TABLE media_bucket
  ADD COLUMN IF NOT EXISTS file_checksum VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add new media_content fields
ALTER TABLE media_content
  ADD COLUMN IF NOT EXISTS loop_interval_minutes INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS playlist_mode ENUM('loop','once','scheduled') DEFAULT 'loop';

-- Create display_error_logs if not exists
CREATE TABLE IF NOT EXISTS display_error_logs (
  id             BIGINT     PRIMARY KEY AUTO_INCREMENT,
  display_id     BIGINT     NOT NULL,
  error_type     ENUM('playback','download','network','hardware','other') NOT NULL,
  error_message  TEXT,
  occurred_at    TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_display  (display_id),
  INDEX idx_type     (error_type),
  INDEX idx_occurred (occurred_at),
  FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
