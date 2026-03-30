-- Add provider_type column to Gafan table
ALTER TABLE "Gafan" ADD COLUMN IF NOT EXISTS "provider_type" TEXT DEFAULT 'internal';

-- Update existing rows to have a default value
UPDATE "Gafan" SET "provider_type" = 'internal' WHERE "provider_type" IS NULL;
