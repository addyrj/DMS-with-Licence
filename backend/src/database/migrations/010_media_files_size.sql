-- 010_media_files_size.sql
ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS file_size_mb DECIMAL(10,2) DEFAULT 0;

UPDATE media_files mf
  JOIN media_bucket mb ON mb.file_name = mf.file_name AND mb.file_path = mf.file_path
  SET mf.file_size_mb = mb.file_size_mb
  WHERE mf.file_size_mb = 0 OR mf.file_size_mb IS NULL;
