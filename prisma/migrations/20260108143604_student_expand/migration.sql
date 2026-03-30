-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "additionalPhone" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "courseSessions" JSONB,
ADD COLUMN     "father" TEXT,
ADD COLUMN     "healthFund" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "mother" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'מתעניין',
ADD COLUMN     "totalSessions" INTEGER NOT NULL DEFAULT 12;
