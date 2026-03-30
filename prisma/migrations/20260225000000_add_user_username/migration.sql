-- Add username and permissions to User table (required for login)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '[]';

-- Backfill username from email for existing rows
UPDATE "User" SET "username" = COALESCE("email", "id") WHERE "username" IS NULL;

-- Enforce NOT NULL and unique
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
