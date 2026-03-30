-- Create Gafan table for after-school programs
CREATE TABLE IF NOT EXISTS "Gafan" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "schoolId" TEXT REFERENCES "School"(id) ON DELETE SET NULL,
  "startDate" DATE,
  "endDate" DATE,
  price DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gafan_school ON "Gafan"("schoolId");
CREATE INDEX IF NOT EXISTS idx_gafan_status ON "Gafan"(status);
