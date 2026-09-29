-- 012_master_v2_updates.sql
-- master_db schema updates from Session 3

-- 1. subscription_logs: fix column sizes
ALTER TABLE `subscription_logs`
  MODIFY COLUMN `action`     VARCHAR(500) NOT NULL,
  MODIFY COLUMN `changed_by` VARCHAR(100) DEFAULT NULL;

-- 2. clients: add admin_email
ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `admin_email` VARCHAR(255) DEFAULT NULL;
