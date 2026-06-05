-- Per-center migration run tracking (Ops UI: progress, history, failed_only)
CREATE TABLE IF NOT EXISTS master_migration_runs (
  id           UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by   TEXT,  -- master user id
  mode         TEXT          NOT NULL,  -- 'all' | 'one' | 'failed_only' | 'selected'
  migration_tag TEXT,
  dry_run      BOOLEAN       NOT NULL DEFAULT false,
  summary_json JSONB,  -- { totalCenters, successCount, failedCount, runId, startedAt }
  status       TEXT          NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'partial'
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS master_migration_runs_created_at_idx ON master_migration_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS master_migration_runs_status_idx ON master_migration_runs(status);

CREATE TABLE IF NOT EXISTS master_migration_run_items (
  id            UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID         NOT NULL REFERENCES master_migration_runs(id) ON DELETE CASCADE,
  center_id     TEXT         NOT NULL,
  center_name   TEXT,
  status        TEXT         NOT NULL,  -- 'success' | 'failed' | 'skipped'
  duration_ms   INTEGER      NOT NULL DEFAULT 0,
  error_message TEXT,
  error_stack   TEXT,
  applied_json  JSONB,  -- list of applied migration file names or steps
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_migration_run_items_run_id_idx ON master_migration_run_items(run_id);
CREATE INDEX IF NOT EXISTS master_migration_run_items_center_id_idx ON master_migration_run_items(center_id);
CREATE INDEX IF NOT EXISTS master_migration_run_items_status_idx ON master_migration_run_items(status);
