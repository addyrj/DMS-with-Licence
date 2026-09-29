-- src/database/migrations/001_master_schema.sql
-- Master database schema
-- Safe to run multiple times — all statements use CREATE TABLE IF NOT EXISTS
-- DB is already created by testConnection() in database.js before this runs

-- ── clients ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                   BIGINT        PRIMARY KEY AUTO_INCREMENT,
  company_name         VARCHAR(255)  NOT NULL,
  database_name        VARCHAR(100)  NOT NULL UNIQUE,
  admin_username       VARCHAR(150)  NOT NULL UNIQUE,
  admin_password       VARCHAR(255)  NOT NULL,
  admin_email          VARCHAR(254),
  contact_phone        VARCHAR(20),
  requirement          ENUM('normal','custom') DEFAULT 'normal',
  pricing              DECIMAL(10,2)  DEFAULT 0,
  devices_required     SMALLINT       DEFAULT 1,
  total_storage_gb     SMALLINT       DEFAULT 5,
  used_storage_gb      SMALLINT       DEFAULT 0,
  subscription_start   DATE           NOT NULL,
  subscription_end     DATE           NOT NULL,
  is_active            TINYINT(1)     DEFAULT 1,
  perm_delete_content  TINYINT(1)     DEFAULT 1,
  perm_create_lines    TINYINT(1)     DEFAULT 1,
  perm_assign_displays TINYINT(1)     DEFAULT 1,
  perm_upload_files    TINYINT(1)     DEFAULT 1,
  perm_create_users    TINYINT(1)     DEFAULT 1,
  created_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login           DATETIME,
  INDEX idx_active         (is_active),
  INDEX idx_db             (database_name),
  INDEX idx_admin_username (admin_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── user_client_map ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_client_map (
  username  VARCHAR(150) NOT NULL,
  db_name   VARCHAR(100) NOT NULL,
  PRIMARY KEY (username, db_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── subscription_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_logs (
  id            BIGINT    PRIMARY KEY AUTO_INCREMENT,
  client_id     BIGINT    NOT NULL,
  action        ENUM('CREATED','RENEWED','UPGRADED','EXPIRED','REACTIVATED') NOT NULL,
  plan_days     SMALLINT,
  old_end_date  DATE,
  new_end_date  DATE,
  changed_by    BIGINT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client (client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Add company_logo to clients (safe: only adds if not exists) ────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_logo VARCHAR(500) DEFAULT NULL;

-- ── notifications ─────────────────────────────────────────────────────────────
-- Super Admin sends notifications to one or all client admins
CREATE TABLE IF NOT EXISTS notifications (
  id           BIGINT        PRIMARY KEY AUTO_INCREMENT,
  title        VARCHAR(255)  NOT NULL,
  message      TEXT          NOT NULL,
  type         ENUM('info','feature','warning','urgent') DEFAULT 'info',
  target       ENUM('all','specific') DEFAULT 'all',
  created_by   VARCHAR(100)  DEFAULT 'superadmin',
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_type    (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── notification_reads ────────────────────────────────────────────────────────
-- Tracks which client_id has read which notification
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id  BIGINT  NOT NULL,
  client_id        BIGINT  NOT NULL,
  read_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, client_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)       REFERENCES clients(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── notification_targets ──────────────────────────────────────────────────────
-- When target = 'specific', which clients receive it
CREATE TABLE IF NOT EXISTS notification_targets (
  notification_id  BIGINT  NOT NULL,
  client_id        BIGINT  NOT NULL,
  PRIMARY KEY (notification_id, client_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)       REFERENCES clients(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
