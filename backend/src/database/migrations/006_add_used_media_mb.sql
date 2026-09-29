-- src/database/migrations/006_add_used_media_mb.sql
-- Adds a cached media-storage column to clients so the list page can show
-- real uploaded-file usage without N+1 queries across client databases.
-- The value is kept in sync by mediaBucket.service.js on every upload/delete.
-- On first run, migrationRunner.js recalculates it from each client's
-- media_bucket table so existing installs get accurate numbers immediately.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS used_media_mb DECIMAL(10,2) DEFAULT 0.00;
