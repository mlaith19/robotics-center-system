-- Migration 002: backward-compatible ALTER for center_settings
-- Reason: if center_settings was created before 001_tenant_schema.sql added these columns,
-- CREATE TABLE IF NOT EXISTS silently skips the table and leaves old columns intact.
-- This file adds every expected column safely.

ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS center_name        TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS logo               TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS phone              TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS whatsapp           TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS address            TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS email              TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS website            TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS working_hours      TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS notes              TEXT    DEFAULT '';
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS lesson_price       NUMERIC DEFAULT 0;
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS monthly_price      NUMERIC DEFAULT 0;
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS registration_fee   NUMERIC DEFAULT 0;
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS discount_siblings  NUMERIC DEFAULT 0;
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS max_students_per_class INTEGER DEFAULT 0;
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Ensure at least one row exists (safe upsert on integer PK)
INSERT INTO center_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
