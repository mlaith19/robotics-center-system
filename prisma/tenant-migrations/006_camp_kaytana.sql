-- קייטנה: קבוצות, כיתות (חדרים), משבצות שעות, ימים ושיבוצים (קבוצה × כיתה × שעה) + שם שיעור

CREATE TABLE IF NOT EXISTS "CampGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CampGroup_courseId_idx" ON "CampGroup"("courseId");

CREATE TABLE IF NOT EXISTS "CampRoom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "teacherId" TEXT REFERENCES "Teacher"("id") ON DELETE SET NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CampRoom_courseId_idx" ON "CampRoom"("courseId");

CREATE TABLE IF NOT EXISTS "CampSlot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "sortOrder" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CampSlot_courseId_idx" ON "CampSlot"("courseId");

CREATE TABLE IF NOT EXISTS "CampDay" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "sessionDate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampDay_courseId_sessionDate_key" UNIQUE ("courseId", "sessionDate")
);
CREATE INDEX IF NOT EXISTS "CampDay_courseId_idx" ON "CampDay"("courseId");

CREATE TABLE IF NOT EXISTS "CampAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campDayId" TEXT NOT NULL REFERENCES "CampDay"("id") ON DELETE CASCADE,
  "slotSortOrder" INTEGER NOT NULL,
  "roomId" TEXT NOT NULL REFERENCES "CampRoom"("id") ON DELETE CASCADE,
  "groupId" TEXT NOT NULL REFERENCES "CampGroup"("id") ON DELETE CASCADE,
  "lessonTitle" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampAssignment_day_slot_room_key" UNIQUE ("campDayId", "slotSortOrder", "roomId")
);
CREATE INDEX IF NOT EXISTS "CampAssignment_campDayId_idx" ON "CampAssignment"("campDayId");

ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "campGroupId" TEXT REFERENCES "CampGroup"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Enrollment_campGroupId_idx" ON "Enrollment"("campGroupId");
