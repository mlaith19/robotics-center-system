import type { Sql } from "postgres"

/**
 * מבטיח ייחודיות שורות נוכחות ב-DB, ומנקה כפילויות היסטוריות.
 *
 * הלוגיקה:
 * - תלמיד: שורה אחת בלבד לכל (studentId, courseId, date, campMeetingCellId-או-ריק).
 * - מורה (משויך לקורס): שורה אחת בלבד לכל (teacherId, courseId-או-ריק, date, campMeetingCellId-או-ריק),
 *   רק כש-studentId NULL (כלומר זו שורת נוכחות "עצמאית" של המורה, לא של תלמיד שרשם מורה).
 *
 * כפילויות קיימות ימוזגו: נשארת השורה הוותיקה ביותר (createdAt הקטן),
 * והיתר נמחקות. אם יש createdAt שווה – נבחר ה-id הקטן לקסיקוגרפית.
 */
export async function ensureAttendanceUniqueIndexes(sql: Sql): Promise<void> {
  const safe = async (label: string, p: Promise<unknown>) => {
    try {
      await p
    } catch (err) {
      console.warn(`[attendance-uniqueness] ${label}:`, err)
    }
  }

  // ודא שעמודת campMeetingCellId קיימת כדי שלאינדקסים יהיה על מה להתבסס
  await safe(
    "add campMeetingCellId if missing",
    sql`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campMeetingCellId" TEXT`,
  )

  // 1) דדופ שורות תלמיד לאותו (studentId, courseId, date, cell)
  await safe(
    "dedupe student rows",
    sql`
      DELETE FROM "Attendance" a
      USING (
        SELECT MIN("createdAt") AS min_created, MIN(id) AS min_id,
               "studentId", "courseId", "date", COALESCE("campMeetingCellId", '') AS cell_key
        FROM "Attendance"
        WHERE "studentId" IS NOT NULL
        GROUP BY "studentId", "courseId", "date", COALESCE("campMeetingCellId", '')
        HAVING COUNT(*) > 1
      ) keep
      WHERE a."studentId" = keep."studentId"
        AND a."courseId" IS NOT DISTINCT FROM keep."courseId"
        AND a."date" = keep."date"
        AND COALESCE(a."campMeetingCellId", '') = keep.cell_key
        AND a.id <> (
          SELECT id FROM "Attendance"
          WHERE "studentId" = keep."studentId"
            AND "courseId" IS NOT DISTINCT FROM keep."courseId"
            AND "date" = keep."date"
            AND COALESCE("campMeetingCellId", '') = keep.cell_key
          ORDER BY "createdAt" ASC, id ASC
          LIMIT 1
        )
    `,
  )

  // 2) דדופ שורות מורה (ללא תלמיד) לאותו (teacherId, courseId, date, cell)
  await safe(
    "dedupe teacher rows",
    sql`
      DELETE FROM "Attendance" a
      USING (
        SELECT "teacherId", COALESCE("courseId", '') AS course_key,
               "date", COALESCE("campMeetingCellId", '') AS cell_key
        FROM "Attendance"
        WHERE "teacherId" IS NOT NULL AND "studentId" IS NULL
        GROUP BY "teacherId", COALESCE("courseId", ''), "date", COALESCE("campMeetingCellId", '')
        HAVING COUNT(*) > 1
      ) keep
      WHERE a."teacherId" = keep."teacherId"
        AND COALESCE(a."courseId", '') = keep.course_key
        AND a."date" = keep."date"
        AND COALESCE(a."campMeetingCellId", '') = keep.cell_key
        AND a."studentId" IS NULL
        AND a.id <> (
          SELECT id FROM "Attendance"
          WHERE "teacherId" = keep."teacherId"
            AND COALESCE("courseId", '') = keep.course_key
            AND "date" = keep."date"
            AND COALESCE("campMeetingCellId", '') = keep.cell_key
            AND "studentId" IS NULL
          ORDER BY "createdAt" ASC, id ASC
          LIMIT 1
        )
    `,
  )

  // 3) אינדקס ייחודי לשורות תלמיד
  await safe(
    "student unique index",
    sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_student_course_date_cell_uniq"
      ON "Attendance" ("studentId", "courseId", "date", (COALESCE("campMeetingCellId", '')))
      WHERE "studentId" IS NOT NULL
    `,
  )

  // 4) אינדקס ייחודי לשורות מורה (ללא תלמיד)
  await safe(
    "teacher unique index",
    sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_teacher_course_date_cell_uniq"
      ON "Attendance" ("teacherId", (COALESCE("courseId", '')), "date", (COALESCE("campMeetingCellId", '')))
      WHERE "teacherId" IS NOT NULL AND "studentId" IS NULL
    `,
  )
}
