-- Restore tables dropped by 20260110222250_roles_permissions (Course, Teacher, Student, etc.)

CREATE TABLE IF NOT EXISTS "School" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "status" TEXT,
  "institutionCode" TEXT,
  "schoolType" TEXT,
  "schoolPhone" TEXT,
  "bankName" TEXT,
  "bankCode" TEXT,
  "bankBranch" TEXT,
  "bankAccount" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Gafan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "programNumber" TEXT,
  "validYear" TEXT,
  "companyName" TEXT,
  "companyId" TEXT,
  "companyAddress" TEXT,
  "bankName" TEXT,
  "bankCode" TEXT,
  "branchNumber" TEXT,
  "accountNumber" TEXT,
  "operatorName" TEXT,
  "priceMin" INTEGER,
  "priceMax" INTEGER,
  "status" TEXT,
  "provider_type" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Teacher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "userId" TEXT,
  "idNumber" TEXT,
  "birthDate" TEXT,
  "city" TEXT,
  "status" TEXT DEFAULT 'פעיל',
  "centerHourlyRate" NUMERIC,
  "travelRate" NUMERIC,
  "externalCourseRate" NUMERIC,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Student" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "status" TEXT NOT NULL DEFAULT 'מתעניין',
  "birthDate" TEXT,
  "idNumber" TEXT,
  "father" TEXT,
  "mother" TEXT,
  "additionalPhone" TEXT,
  "healthFund" TEXT,
  "allergies" TEXT,
  "totalSessions" INTEGER NOT NULL DEFAULT 12,
  "courseIds" JSONB DEFAULT '[]',
  "courseSessions" JSONB DEFAULT '{}',
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Course" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "level" TEXT DEFAULT 'beginner',
  "duration" INTEGER,
  "price" NUMERIC,
  "status" TEXT DEFAULT 'active',
  "courseNumber" TEXT,
  "category" TEXT,
  "courseType" TEXT DEFAULT 'regular',
  "location" TEXT DEFAULT 'center',
  "startDate" TEXT,
  "endDate" TEXT,
  "startTime" TIMESTAMP(3),
  "endTime" TIMESTAMP(3),
  "daysOfWeek" JSONB DEFAULT '[]',
  "teacherIds" JSONB DEFAULT '[]',
  "schoolId" TEXT,
  "gafanProgramId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Enrollment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'active',
  "sessionsLeft" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
  "amount" NUMERIC NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentType" TEXT,
  "description" TEXT,
  "courseId" TEXT REFERENCES "Course"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT REFERENCES "Student"("id") ON DELETE CASCADE,
  "teacherId" TEXT REFERENCES "Teacher"("id") ON DELETE SET NULL,
  "courseId" TEXT REFERENCES "Course"("id") ON DELETE SET NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'נוכח',
  "notes" TEXT,
  "hours" NUMERIC,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "description" TEXT NOT NULL,
  "amount" NUMERIC NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "isRecurring" BOOLEAN DEFAULT false,
  "recurringDay" INTEGER,
  "teacherId" TEXT REFERENCES "Teacher"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX IF NOT EXISTS "Enrollment_courseId_idx" ON "Enrollment"("courseId");
CREATE INDEX IF NOT EXISTS "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx" ON "Attendance"("studentId");
CREATE INDEX IF NOT EXISTS "Attendance_teacherId_idx" ON "Attendance"("teacherId");
CREATE INDEX IF NOT EXISTS "Attendance_courseId_idx" ON "Attendance"("courseId");
CREATE INDEX IF NOT EXISTS "Expense_teacherId_idx" ON "Expense"("teacherId");
