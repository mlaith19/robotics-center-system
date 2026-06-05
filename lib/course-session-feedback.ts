type DbClient = { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> }

export async function ensureCourseSessionTables(db: DbClient) {
  await db`
    CREATE TABLE IF NOT EXISTS "CourseSession" (
      "id" TEXT PRIMARY KEY,
      "courseId" TEXT NOT NULL,
      "teacherId" TEXT,
      "sessionDate" DATE NOT NULL,
      "generalTopic" TEXT,
      "createdByUserId" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE INDEX IF NOT EXISTS "CourseSession_courseId_idx"
    ON "CourseSession" ("courseId")
  `

  await db`
    CREATE TABLE IF NOT EXISTS "CourseSessionFeedback" (
      "id" TEXT PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "studentId" TEXT NOT NULL,
      "feedbackText" TEXT,
      "createdByUserId" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS "CourseSessionFeedback_session_student_uidx"
    ON "CourseSessionFeedback" ("sessionId", "studentId")
  `
}

