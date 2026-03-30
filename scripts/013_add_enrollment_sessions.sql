-- Add sessionsLeft column to Enrollment table
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "sessionsLeft" INTEGER DEFAULT 12;
