-- Advanced camp classrooms config per center_settings
ALTER TABLE "center_settings"
  ADD COLUMN IF NOT EXISTS "camp_classrooms" JSONB NOT NULL DEFAULT '[]'::jsonb;
