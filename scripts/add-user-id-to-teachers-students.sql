-- Add userId column to Teacher table to link to User
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "User"(id);

-- Add userId column to Student table to link to User
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "User"(id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_teacher_user_id ON "Teacher"("userId");
CREATE INDEX IF NOT EXISTS idx_student_user_id ON "Student"("userId");
