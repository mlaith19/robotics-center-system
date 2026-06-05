-- PHASE 1: Master Control Plane (SaaS)
-- master_users: exactly one OWNER, MASTER_ADMIN with permissions JSON
-- centers, domains, plans, subscriptions, license_keys, audit_logs, etc.

CREATE TABLE IF NOT EXISTS master_users (
  id TEXT NOT NULL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MASTER_ADMIN')),
  permissions_json JSONB DEFAULT '[]',
  force_password_reset BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS master_users_owner_unique ON master_users ((1)) WHERE role = 'OWNER';

CREATE TABLE IF NOT EXISTS centers (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  tenant_db_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT NOT NULL PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  host TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_features (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT NOT NULL PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_trial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_keys (
  id TEXT NOT NULL PRIMARY KEY,
  key_hash TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  duration_days INTEGER NOT NULL,
  max_activations INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  center_id TEXT REFERENCES centers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_activations (
  id TEXT NOT NULL PRIMARY KEY,
  license_key_id TEXT NOT NULL REFERENCES license_keys(id),
  center_id TEXT NOT NULL REFERENCES centers(id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT NOT NULL PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_change_history (
  id TEXT NOT NULL PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  from_plan_id TEXT REFERENCES plans(id),
  to_plan_id TEXT NOT NULL REFERENCES plans(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT NOT NULL PRIMARY KEY,
  master_user_id TEXT REFERENCES master_users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_master_user_id ON audit_logs(master_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at ON audit_logs(created_at);
