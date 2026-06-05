-- תחום/קורס שבו מתעניין תלמיד כשנרשם בלי קישור לקורס ספציפי
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "registrationInterest" TEXT;
