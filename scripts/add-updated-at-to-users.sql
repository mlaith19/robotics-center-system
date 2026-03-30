-- Add updatedAt column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP;

-- Set default value for existing rows
UPDATE "User" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
