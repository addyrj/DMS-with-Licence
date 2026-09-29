-- 011_v2_schema_updates.sql
-- All new schema changes from DMS Session 3
-- Safe to run multiple times

-- 1. production_lines: add active_line
ALTER TABLE `production_lines`
  ADD COLUMN IF NOT EXISTS `active_line` TINYINT(1) DEFAULT 1;

-- 2. production_lines: add client_id
ALTER TABLE `production_lines`
  ADD COLUMN IF NOT EXISTS `client_id` BIGINT DEFAULT NULL;

-- 3. production_line_displays join table
CREATE TABLE IF NOT EXISTS `production_line_displays` (
  `id`                  BIGINT PRIMARY KEY AUTO_INCREMENT,
  `production_line_id`  BIGINT NOT NULL,
  `display_id`          BIGINT NOT NULL,
  `created_at`          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_line_display (`production_line_id`, `display_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. employee_users: fix orphaned display assignments
UPDATE `employee_users`
SET `assigned_display_id` = NULL
WHERE `assigned_display_id` IS NOT NULL
  AND `assigned_display_id` NOT IN (SELECT id FROM displays);

-- 5. display_error_logs: add error_type if missing
ALTER TABLE `display_error_logs`
  ADD COLUMN IF NOT EXISTS `error_type` VARCHAR(50) DEFAULT 'playback';

-- 6. media_content: doc_duration_seconds
ALTER TABLE `media_content`
  ADD COLUMN IF NOT EXISTS `doc_duration_seconds` INT DEFAULT 50;
