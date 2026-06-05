-- Master Portal tables (Phase 16)
-- Adds: monthly_price to plans, ops_runs, center_feature_overrides

ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_price NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS ops_runs (
  id          TEXT        NOT NULL PRIMARY KEY,
  type        TEXT        NOT NULL,  -- 'migrate_all' | 'backup_all' | 'migrate_center' | 'backup_center'
  status      TEXT        NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'failed'
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_runs_type_idx       ON ops_runs(type);
CREATE INDEX IF NOT EXISTS ops_runs_started_at_idx ON ops_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS center_feature_overrides (
  center_id   TEXT    NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  feature_key TEXT    NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (center_id, feature_key)
);

CREATE INDEX IF NOT EXISTS cfo_center_id_idx ON center_feature_overrides(center_id);
