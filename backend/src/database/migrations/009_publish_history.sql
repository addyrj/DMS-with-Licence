-- 009_publish_history.sql
CREATE TABLE IF NOT EXISTS publish_history (
  id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
  folder_name         VARCHAR(255) NOT NULL,
  production_line_id  BIGINT,
  display_ids         JSON DEFAULT NULL,
  file_ids            JSON DEFAULT NULL,
  duration            INT DEFAULT 10,
  doc_duration        INT DEFAULT 50,
  all_lines           TINYINT(1) DEFAULT 0,
  tv_count            INT DEFAULT 0,
  created_by          BIGINT DEFAULT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_line    (production_line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
