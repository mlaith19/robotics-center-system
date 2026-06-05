-- Add teacherId column to Expense table for tracking teacher salary payments
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;

-- Add foreign key constraint (optional, for data integrity)
-- ALTER TABLE "Expense" ADD CONSTRAINT "Expense_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL;
