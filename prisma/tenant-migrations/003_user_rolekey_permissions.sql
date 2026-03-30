-- Ensure User has roleKey and permissions (array); permissions default [] if NULL
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleKey" TEXT;
UPDATE "User" SET "roleKey" = LOWER(TRIM("role")) WHERE "roleKey" IS NULL AND "role" IS NOT NULL;
UPDATE "User" SET "roleKey" = 'other' WHERE "roleKey" IS NULL OR TRIM("roleKey") = '';
ALTER TABLE "User" ALTER COLUMN "permissions" SET DEFAULT '[]';
UPDATE "User" SET permissions = '[]' WHERE permissions IS NULL;
