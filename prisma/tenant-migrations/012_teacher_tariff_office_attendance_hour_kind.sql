-- תעריף שעת משרד בפרופיל תעריף מורה + סוג שעה בנוכחות מורה
ALTER TABLE "TeacherTariffProfile" ADD COLUMN IF NOT EXISTS "officeHourlyRate" DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "hourKind" TEXT;
