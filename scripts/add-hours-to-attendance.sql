-- Add hours column to Attendance table for tracking teacher work hours
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS hours NUMERIC;
