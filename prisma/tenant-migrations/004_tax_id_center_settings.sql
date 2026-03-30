-- Migration 004: ע"ס / ח"פ (עוסק מורשה / ח.פ. חברה)
ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50) DEFAULT '';
