-- Phase 9: Trial system – trial_start_date, trial_end_date on subscriptions

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_start_date DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_date DATE;

-- Backfill: for existing trial subscriptions, set trial window from start_date/end_date
UPDATE subscriptions
SET trial_start_date = start_date, trial_end_date = end_date
WHERE is_trial = true AND trial_start_date IS NULL;
