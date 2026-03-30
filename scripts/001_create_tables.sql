-- Create all tables for the Robotics Center System

-- Role table
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

-- Permission table
CREATE TABLE IF NOT EXISTS "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- RolePermission junction table
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "roleId" TEXT,
    "permissions" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Student table
CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birthDate" DATE,
    "address" TEXT,
    "city" TEXT,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Student_studentId_key" ON "Student"("studentId");

-- Teacher table
CREATE TABLE IF NOT EXISTS "Teacher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "specialty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- Course table
CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "price" DECIMAL(10,2),
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- School table
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- Enrollment table
CREATE TABLE IF NOT EXISTS "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "paymentType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Attendance table
CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_roleId_fkey";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" 
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_permissionId_fkey";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" 
    FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_roleId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" 
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_schoolId_fkey";
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" 
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_studentId_fkey";
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" 
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_courseId_fkey";
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" 
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_studentId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" 
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_studentId_fkey";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" 
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_courseId_fkey";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_courseId_fkey" 
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default roles
INSERT INTO "Role" ("id", "key", "name", "description", "createdAt", "updatedAt")
VALUES 
    ('role_admin', 'admin', 'Administrator', 'Full system access', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_manager', 'manager', 'Manager', 'Management access', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_teacher', 'teacher', 'Teacher', 'Teacher access', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_cashier', 'cashier', 'Cashier', 'Cashier access', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Insert default permissions
INSERT INTO "Permission" ("id", "name", "description")
VALUES 
    ('users.view', 'View Users', 'Can view users list'),
    ('users.create', 'Create Users', 'Can create new users'),
    ('users.edit', 'Edit Users', 'Can edit users'),
    ('users.delete', 'Delete Users', 'Can delete users'),
    ('students.view', 'View Students', 'Can view students list'),
    ('students.create', 'Create Students', 'Can create new students'),
    ('students.edit', 'Edit Students', 'Can edit students'),
    ('students.delete', 'Delete Students', 'Can delete students'),
    ('teachers.view', 'View Teachers', 'Can view teachers list'),
    ('teachers.create', 'Create Teachers', 'Can create new teachers'),
    ('teachers.edit', 'Edit Teachers', 'Can edit teachers'),
    ('teachers.delete', 'Delete Teachers', 'Can delete teachers'),
    ('courses.view', 'View Courses', 'Can view courses list'),
    ('courses.create', 'Create Courses', 'Can create new courses'),
    ('courses.edit', 'Edit Courses', 'Can edit courses'),
    ('courses.delete', 'Delete Courses', 'Can delete courses'),
    ('schools.view', 'View Schools', 'Can view schools list'),
    ('schools.create', 'Create Schools', 'Can create new schools'),
    ('schools.edit', 'Edit Schools', 'Can edit schools'),
    ('schools.delete', 'Delete Schools', 'Can delete schools'),
    ('payments.view', 'View Payments', 'Can view payments'),
    ('payments.create', 'Create Payments', 'Can create payments'),
    ('attendance.view', 'View Attendance', 'Can view attendance'),
    ('attendance.mark', 'Mark Attendance', 'Can mark attendance')
ON CONFLICT ("id") DO NOTHING;

-- Assign all permissions to admin role
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_admin', "id" FROM "Permission"
ON CONFLICT DO NOTHING;

-- Insert a default admin user
INSERT INTO "User" ("id", "username", "name", "email", "status", "roleId", "createdAt")
VALUES ('user_admin', 'admin', 'System Administrator', 'admin@example.com', 'active', 'role_admin', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
