-- Add missing columns to Course table
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "courseNumber" VARCHAR(50);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "courseType" VARCHAR(50) DEFAULT 'regular';
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "location" VARCHAR(50) DEFAULT 'center';
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "startDate" DATE;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "endDate" DATE;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "startTime" TIME;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "endTime" TIME;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "daysOfWeek" TEXT[];

-- Create CourseTeacher junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS "CourseTeacher" (
  "courseId" UUID NOT NULL REFERENCES "Course"(id) ON DELETE CASCADE,
  "teacherId" UUID NOT NULL REFERENCES "Teacher"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY ("courseId", "teacherId")
);
