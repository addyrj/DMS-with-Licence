-- 004_add_company_logo.sql — run on master DB
ALTER TABLE clients ADD COLUMN company_logo VARCHAR(500) DEFAULT NULL;
