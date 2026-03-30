-- Allow NULL studentId in Payment table for non-student income types
ALTER TABLE "Payment" ALTER COLUMN "studentId" DROP NOT NULL;
