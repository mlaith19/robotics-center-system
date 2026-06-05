-- Add teacherId column to Attendance table for teacher attendance tracking
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "teacherId" text;
