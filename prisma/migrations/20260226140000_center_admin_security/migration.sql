-- Phase 6: Center admin security – force_password_reset, locked_until, login_attempts

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "force_password_reset" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_user_id_idx ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS login_attempts_created_at_idx ON login_attempts(created_at);
