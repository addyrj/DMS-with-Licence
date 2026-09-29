-- 005_add_notifications.sql — run on master_db for existing installs

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

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id  BIGINT  NOT NULL,
  client_id        BIGINT  NOT NULL,
  read_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, client_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)       REFERENCES clients(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_targets (
  notification_id  BIGINT  NOT NULL,
  client_id        BIGINT  NOT NULL,
  PRIMARY KEY (notification_id, client_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)       REFERENCES clients(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
