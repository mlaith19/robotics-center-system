-- Camp slots: support break rows in timetable
ALTER TABLE "CampSlot" ADD COLUMN IF NOT EXISTS "isBreak" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampSlot" ADD COLUMN IF NOT EXISTS "breakTitle" TEXT NOT NULL DEFAULT '';
