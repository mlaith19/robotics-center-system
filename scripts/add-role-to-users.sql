-- Add role column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'other';

-- Update existing users without role
UPDATE "User" SET role = 'other' WHERE role IS NULL;
