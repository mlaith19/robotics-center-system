-- Add admin_username to centers table so the master portal can display
-- the tenant admin login for each center.
ALTER TABLE centers ADD COLUMN IF NOT EXISTS admin_username TEXT;
