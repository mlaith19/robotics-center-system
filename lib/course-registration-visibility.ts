type DbClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>
}

export async function ensureCourseRegistrationSettingsTable(db: DbClient) {
  await db`
    CREATE TABLE IF NOT EXISTS "CourseRegistrationSettings" (
      "courseId" TEXT PRIMARY KEY,
      "showRegistrationLink" BOOLEAN NOT NULL DEFAULT false,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
}

export async function getCourseRegistrationVisibilityMap(db: DbClient, courseIds: string[]) {
  if (!courseIds.length) return new Map<string, boolean>()
  await ensureCourseRegistrationSettingsTable(db)
  const rows = await db`
    SELECT "courseId", "showRegistrationLink"
    FROM "CourseRegistrationSettings"
    WHERE "courseId" = ANY(${courseIds})
  ` as { courseId: string; showRegistrationLink: boolean }[]
  const map = new Map<string, boolean>()
  for (const row of rows) {
    map.set(String(row.courseId), row.showRegistrationLink === true)
  }
  return map
}

export async function setCourseRegistrationVisibility(db: DbClient, courseId: string, show: boolean) {
  await ensureCourseRegistrationSettingsTable(db)
  await db`
    INSERT INTO "CourseRegistrationSettings" ("courseId", "showRegistrationLink", "updatedAt")
    VALUES (${courseId}, ${show}, NOW())
    ON CONFLICT ("courseId")
    DO UPDATE SET
      "showRegistrationLink" = EXCLUDED."showRegistrationLink",
      "updatedAt" = NOW()
  `
}
