-- Add schoolId and gafanProgramId columns to Course table for GAFAN courses
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "gafanProgramId" TEXT;

-- Add foreign key constraints (optional, for data integrity)
-- These are commented out in case you want to run without strict FK constraints
-- ALTER TABLE "Course" ADD CONSTRAINT "fk_course_school" FOREIGN KEY ("schoolId") REFERENCES "School"(id);
-- ALTER TABLE "Course" ADD CONSTRAINT "fk_course_gafan" FOREIGN KEY ("gafanProgramId") REFERENCES "Gafan"(id);
