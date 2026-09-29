-- 007_announcements_and_doc_duration.sql
-- Run on ALL client databases (incremental migration)

-- Display Announcements table — ticker banners sent from admin dashboard to all TVs
CREATE TABLE IF NOT EXISTS display_announcements (
  id               BIGINT     PRIMARY KEY AUTO_INCREMENT,
  message          TEXT       NOT NULL,
  type             ENUM('good-news','alert','info') DEFAULT 'info',
  duration_minutes SMALLINT   DEFAULT 10,
  expires_at       DATETIME   NOT NULL,
  is_active        TINYINT(1) DEFAULT 1,
  created_at       TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active     (is_active),
  INDEX idx_expires    (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- doc_duration per-page field on media_files
-- Allows PDF/PPT pages to have a different duration than images
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS doc_duration_seconds INT DEFAULT NULL;

-- Also add doc_duration to media_content for default per-page timing
ALTER TABLE media_content ADD COLUMN IF NOT EXISTS doc_duration_seconds INT DEFAULT 50;
