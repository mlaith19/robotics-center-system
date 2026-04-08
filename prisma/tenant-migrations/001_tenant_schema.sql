-- Tenant schema (Phase 4): operational tables only.
-- Run this against a tenant database URL to create the schema.

-- User, Role, Permission (tenant-scoped)
CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Role_key_key" ON "Role"("key");

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "roleId" TEXT NOT NULL REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "permissionId" TEXT NOT NULL REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "username" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "password" TEXT,
  "role" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "roleId" TEXT REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "permissions" JSONB DEFAULT '[]',
  "force_password_reset" BOOLEAN NOT NULL DEFAULT true,
  "locked_until" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

-- Center settings (one row per tenant)
CREATE TABLE IF NOT EXISTS center_settings (
  id INTEGER NOT NULL PRIMARY KEY,
  center_name TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  address TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  working_hours TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  lesson_price NUMERIC DEFAULT 0,
  monthly_price NUMERIC DEFAULT 0,
  registration_fee NUMERIC DEFAULT 0,
  discount_siblings NUMERIC DEFAULT 0,
  max_students_per_class INTEGER DEFAULT 0,
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
-- Safe seed: only insert if the table has the expected integer-pk schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'center_settings'
      AND column_name  = 'center_name'
  ) THEN
    INSERT INTO center_settings (id, center_name, lesson_price, monthly_price, registration_fee, discount_siblings, max_students_per_class)
    VALUES (1, '', 0, 0, 0, 0, 0)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Schools, Gafan, Teacher, Student, Course, Enrollment, Payment, Attendance, Expense
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
  "schoolId" TEXT,
  "teacherIds" JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "GafanSchoolLink" (
  "gafanId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherIds" JSONB DEFAULT '[]'::jsonb,
  "workshopRows" JSONB DEFAULT '[]'::jsonb,
  "allocatedHours" NUMERIC DEFAULT 0,
  "hourRows" JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GafanSchoolLink_pkey" PRIMARY KEY ("gafanId","schoolId")
);
CREATE INDEX IF NOT EXISTS "GafanSchoolLink_schoolId_idx" ON "GafanSchoolLink"("schoolId");

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
  "specialty" TEXT,
  "bio" TEXT,
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
CREATE INDEX IF NOT EXISTS "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX IF NOT EXISTS "Enrollment_courseId_idx" ON "Enrollment"("courseId");

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
CREATE INDEX IF NOT EXISTS "Payment_studentId_idx" ON "Payment"("studentId");

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
CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx" ON "Attendance"("studentId");
CREATE INDEX IF NOT EXISTS "Attendance_teacherId_idx" ON "Attendance"("teacherId");
CREATE INDEX IF NOT EXISTS "Attendance_courseId_idx" ON "Attendance"("courseId");

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
CREATE INDEX IF NOT EXISTS "Expense_teacherId_idx" ON "Expense"("teacherId");

-- Course categories
CREATE TABLE IF NOT EXISTS "CourseCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourseCategory_name_key" ON "CourseCategory"("name");

-- Import jobs
CREATE TABLE IF NOT EXISTS "ImportJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "lang" TEXT,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "originalFilename" TEXT,
  "errorFilePath" TEXT
);
CREATE INDEX IF NOT EXISTS "ImportJob_userId_idx" ON "ImportJob"("userId");
CREATE INDEX IF NOT EXISTS "ImportJob_entityType_idx" ON "ImportJob"("entityType");
CREATE INDEX IF NOT EXISTS "ImportJob_startedAt_idx" ON "ImportJob"("startedAt");

-- Login attempts (Phase 6) for lockout and audit
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_user_id_idx ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS login_attempts_created_at_idx ON login_attempts(created_at);
