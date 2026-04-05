-- נוכחות תלמיד/מורה בקייטנה לפי תא במערכת המפגשים (מספר שיעורים ביום)
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campMeetingCellId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campLessonTitle" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campSlotStart" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campSlotEnd" TEXT;

CREATE INDEX IF NOT EXISTS "Attendance_campMeetingCell_idx"
  ON "Attendance" ("courseId", "date", "campMeetingCellId")
  WHERE "campMeetingCellId" IS NOT NULL;
