-- Create Expense table for tracking expenses
CREATE TABLE IF NOT EXISTS "Expense" (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "isRecurring" BOOLEAN DEFAULT false,
    "recurringDay" INTEGER,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Add index for date filtering
CREATE INDEX IF NOT EXISTS idx_expense_date ON "Expense"(date);
CREATE INDEX IF NOT EXISTS idx_expense_category ON "Expense"(category);
