-- קייטנה מודל חדש:
-- 1) קבוצת תלמיד = אות א-ת ב-Enrollment.campGroupLabel
-- 2) שיבוץ תא לפי יום×שעה×כיתה עם ריבוי קבוצות וריבוי מורים
-- 3) כמות כיתות ברמת מרכז (center_settings.camp_classrooms_count)

ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "campGroupLabel" TEXT;
CREATE INDEX IF NOT EXISTS "Enrollment_campGroupLabel_idx" ON "Enrollment"("campGroupLabel");

ALTER TABLE "center_settings" ADD COLUMN IF NOT EXISTS "camp_classrooms_count" INTEGER NOT NULL DEFAULT 6;

CREATE TABLE IF NOT EXISTS "CampClassAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campDayId" TEXT NOT NULL REFERENCES "CampDay"("id") ON DELETE CASCADE,
  "slotSortOrder" INTEGER NOT NULL,
  "classroomNo" INTEGER NOT NULL,
  "lessonTitle" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampClassAssignment_day_slot_class_key" UNIQUE ("campDayId", "slotSortOrder", "classroomNo")
);
CREATE INDEX IF NOT EXISTS "CampClassAssignment_campDayId_idx" ON "CampClassAssignment"("campDayId");

CREATE TABLE IF NOT EXISTS "CampClassAssignmentGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL REFERENCES "CampClassAssignment"("id") ON DELETE CASCADE,
  "groupLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CampClassAssignmentGroup_assignment_group_key" ON "CampClassAssignmentGroup"("assignmentId", "groupLabel");

CREATE TABLE IF NOT EXISTS "CampClassAssignmentTeacher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL REFERENCES "CampClassAssignment"("id") ON DELETE CASCADE,
  "teacherId" TEXT NOT NULL REFERENCES "Teacher"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CampClassAssignmentTeacher_assignment_teacher_key" ON "CampClassAssignmentTeacher"("assignmentId", "teacherId");
