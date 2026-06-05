-- center_settings for /api/settings
CREATE TABLE IF NOT EXISTS center_settings (
  id INTEGER NOT NULL PRIMARY KEY,
  center_name TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  address TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  working_hours TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  lesson_price NUMERIC DEFAULT 0,
  monthly_price NUMERIC DEFAULT 0,
  registration_fee NUMERIC DEFAULT 0,
  discount_siblings NUMERIC DEFAULT 0,
  max_students_per_class INTEGER DEFAULT 0,
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO center_settings (id, center_name, lesson_price, monthly_price, registration_fee, discount_siblings, max_students_per_class)
VALUES (1, '', 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- User: add password, role, updatedAt for API compatibility
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Teacher: add specialty, bio if missing
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS bio TEXT;
