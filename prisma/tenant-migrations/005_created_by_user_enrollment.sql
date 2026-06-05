-- Add createdByUserId to Enrollment (and related tables) for audit
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
