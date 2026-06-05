-- Camp full refactor:
-- Course -> CampMeeting -> CampMeetingSlot -> CampMeetingCell
-- with many-to-many groups and teachers per cell.

CREATE TABLE IF NOT EXISTS "CampMeeting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "sessionDate" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampMeeting_course_sessionDate_key" UNIQUE ("courseId", "sessionDate")
);
CREATE INDEX IF NOT EXISTS "CampMeeting_courseId_idx" ON "CampMeeting"("courseId");

CREATE TABLE IF NOT EXISTS "CampMeetingSlot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "meetingId" TEXT NOT NULL REFERENCES "CampMeeting"("id") ON DELETE CASCADE,
  "sortOrder" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "isBreak" BOOLEAN NOT NULL DEFAULT false,
  "breakTitle" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampMeetingSlot_meeting_sortOrder_key" UNIQUE ("meetingId", "sortOrder")
);
CREATE INDEX IF NOT EXISTS "CampMeetingSlot_meetingId_idx" ON "CampMeetingSlot"("meetingId");

CREATE TABLE IF NOT EXISTS "CampMeetingCell" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slotId" TEXT NOT NULL REFERENCES "CampMeetingSlot"("id") ON DELETE CASCADE,
  "classroomNo" INTEGER NOT NULL,
  "lessonTitle" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampMeetingCell_slot_classroom_key" UNIQUE ("slotId", "classroomNo")
);
CREATE INDEX IF NOT EXISTS "CampMeetingCell_slotId_idx" ON "CampMeetingCell"("slotId");

CREATE TABLE IF NOT EXISTS "CampMeetingCellGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cellId" TEXT NOT NULL REFERENCES "CampMeetingCell"("id") ON DELETE CASCADE,
  "groupLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CampMeetingCellGroup_cell_group_key" ON "CampMeetingCellGroup"("cellId", "groupLabel");

CREATE TABLE IF NOT EXISTS "CampMeetingCellTeacher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cellId" TEXT NOT NULL REFERENCES "CampMeetingCell"("id") ON DELETE CASCADE,
  "teacherId" TEXT NOT NULL REFERENCES "Teacher"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CampMeetingCellTeacher_cell_teacher_key" ON "CampMeetingCellTeacher"("cellId", "teacherId");
