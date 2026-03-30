-- Phase 12: notification_logs.target_date for dedupe (one reminder per center per kind per target end_date)

ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS target_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_center_kind_target
  ON notification_logs (center_id, kind, target_date)
  WHERE target_date IS NOT NULL;
