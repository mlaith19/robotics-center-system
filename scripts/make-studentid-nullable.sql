-- Make studentId nullable to allow teacher-only attendance records
ALTER TABLE "Attendance" ALTER COLUMN "studentId" DROP NOT NULL;
