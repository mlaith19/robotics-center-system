-- Add "createdByUserId" to track which user performed the action (payments, attendance, enrollments, expenses)

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
