-- Add username and password columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_username ON "User"(username);
