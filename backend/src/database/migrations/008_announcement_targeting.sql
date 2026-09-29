-- 008_announcement_targeting.sql
-- Add targeting columns to display_announcements
-- Safe to run multiple times (ignoreDuplicates in migrationRunner)

ALTER TABLE display_announcements
  ADD COLUMN IF NOT EXISTS target_type    ENUM('all','line','display') DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_line_id    BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_display_id BIGINT DEFAULT NULL;
