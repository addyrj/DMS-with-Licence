-- src/database/migrations/002_client_schema.sql
-- Client database schema — executed per new client via migrationRunner.js

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  username    VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  email       VARCHAR(254),
  is_active   TINYINT(1)    DEFAULT 1,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login  DATETIME,
  INDEX idx_username (username),
  INDEX idx_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── employee_users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_users (
  user_id                BIGINT     PRIMARY KEY,
  production_line_id     BIGINT,
  assigned_display_id    BIGINT,
  has_delete_permission  TINYINT(1) DEFAULT 0,
  created_by             BIGINT     NOT NULL,
  created_at             TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display (assigned_display_id),
  INDEX idx_line    (production_line_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── displays ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS displays (
  id                    BIGINT            PRIMARY KEY AUTO_INCREMENT,
  client_id             BIGINT            NOT NULL,
  display_name          VARCHAR(100)      NOT NULL,
  display_number        VARCHAR(100)      NOT NULL,
  display_password      VARCHAR(255)      NOT NULL,
  status                ENUM('ONLINE','OFFLINE') DEFAULT 'OFFLINE',
  last_heartbeat        DATETIME,
  volume_level          TINYINT UNSIGNED  DEFAULT 0,
  storage_available     VARCHAR(20),

  -- NEW: TV reporting fields
  temperature           VARCHAR(20)       DEFAULT NULL,   -- e.g. "42°C"
  temperature_status    ENUM('normal','warning','critical') DEFAULT NULL,
  uptime_today_minutes  INT               DEFAULT 0,      -- resets daily
  last_uptime_reset     DATE              DEFAULT NULL,   -- date of last reset
  content_loops_today   INT               DEFAULT 0,      -- loops played today
  total_play_time_min   INT               DEFAULT 0,      -- total minutes played today

  created_at            TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP         DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_display_number (display_number, client_id),
  INDEX idx_client    (client_id),
  INDEX idx_status    (status),
  INDEX idx_heartbeat (last_heartbeat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── display_error_logs ────────────────────────────────────────────────────────
-- NEW: TV devices report errors back to the server
CREATE TABLE IF NOT EXISTS display_error_logs (
  id             BIGINT     PRIMARY KEY AUTO_INCREMENT,
  display_id     BIGINT     NOT NULL,
  error_type     ENUM('playback','download','network','hardware','other') NOT NULL,
  error_message  TEXT,
  occurred_at    TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_display    (display_id),
  INDEX idx_type       (error_type),
  INDEX idx_occurred   (occurred_at),
  FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── production_lines ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_lines (
  id                    BIGINT        PRIMARY KEY AUTO_INCREMENT,
  client_id             BIGINT        NOT NULL,
  production_line_name  VARCHAR(255)  NOT NULL,
  description           TEXT,
  created_by            BIGINT        NOT NULL,
  active_line           TINYINT(1)    DEFAULT 1,
  tv_order              JSON,
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_client       (client_id),
  INDEX idx_client_active (client_id, active_line)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── production_line_displays (M:M junction) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_line_displays (
  production_line_id  BIGINT NOT NULL,
  display_id          BIGINT NOT NULL,
  PRIMARY KEY (production_line_id, display_id),
  INDEX idx_display (display_id),
  FOREIGN KEY (production_line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (display_id)         REFERENCES displays(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── media_bucket ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_bucket (
  id             BIGINT         PRIMARY KEY AUTO_INCREMENT,
  folder_name    VARCHAR(255)   NOT NULL,
  file_name      VARCHAR(255)   NOT NULL,
  file_path      VARCHAR(500)   NOT NULL,
  file_size_mb   DECIMAL(8,2)   NOT NULL,
  file_type      ENUM('video','image','pdf','presentation') NOT NULL,
  sequence       SMALLINT       DEFAULT 1,
  file_checksum  VARCHAR(64)    DEFAULT NULL,  -- NEW: SHA256 for integrity check
  created_by     BIGINT         NOT NULL,
  created_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_folder_seq (folder_name, sequence),
  INDEX idx_creator    (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── media_content ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_content (
  id                     BIGINT     PRIMARY KEY AUTO_INCREMENT,
  production_line_id     BIGINT     NOT NULL,
  display_id             BIGINT     NOT NULL,
  duration               SMALLINT   DEFAULT 0,   -- seconds per slide
  is_published           TINYINT(1) DEFAULT 0,
  loop_interval_minutes  INT        DEFAULT 15,  -- NEW: playlist repeat interval
  playlist_mode          ENUM('loop','once','scheduled') DEFAULT 'loop', -- NEW
  created_at             TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display_line (display_id, production_line_id),
  INDEX idx_published    (is_published),
  FOREIGN KEY (production_line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (display_id)         REFERENCES displays(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── media_files ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_files (
  id                BIGINT        PRIMARY KEY AUTO_INCREMENT,
  media_content_id  BIGINT        NOT NULL,
  file_path         VARCHAR(500)  NOT NULL,
  file_name         VARCHAR(255)  NOT NULL,
  sequence_order    SMALLINT      DEFAULT 0,
  created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_content_seq (media_content_id, sequence_order),
  FOREIGN KEY (media_content_id) REFERENCES media_content(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── publish_status ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publish_status (
  production_line_id  BIGINT NOT NULL,
  display_id          BIGINT NOT NULL,
  status              ENUM('pending','downloading','completed') DEFAULT 'pending',
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (production_line_id, display_id),
  INDEX idx_status (production_line_id, status),
  FOREIGN KEY (production_line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (display_id)         REFERENCES displays(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── content_assignments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_assignments (
  id              BIGINT     PRIMARY KEY AUTO_INCREMENT,
  media_bucket_id BIGINT     NOT NULL,
  display_id      BIGINT     NOT NULL,
  start_date      DATE       NOT NULL,
  end_date        DATE       NOT NULL,
  is_active       TINYINT(1) DEFAULT 1,
  created_by      BIGINT     NOT NULL,
  created_at      TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display     (display_id),
  INDEX idx_active      (is_active),
  INDEX idx_date_range  (start_date, end_date),
  FOREIGN KEY (media_bucket_id) REFERENCES media_bucket(id) ON DELETE CASCADE,
  FOREIGN KEY (display_id)      REFERENCES displays(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── activity_logs ─────────────────────────────────────────────────────────────
-- Audit trail: every upload/delete/publish/user action gets logged here
CREATE TABLE IF NOT EXISTS activity_logs (
  id           BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT        NOT NULL,
  username     VARCHAR(150)  NOT NULL,
  action_type  VARCHAR(50)   NOT NULL,   -- upload_file, delete_file, publish, unpublish, create_user, delete_user, create_display, delete_display
  entity_type  VARCHAR(50),              -- file, folder, display, user, content
  entity_id    VARCHAR(100),             -- id or name of the affected entity
  detail       TEXT,                     -- human readable description
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_action  (action_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
