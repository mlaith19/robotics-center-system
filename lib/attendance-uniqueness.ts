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
  await safe(
    "add campSlotStart if missing",
    sql`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campSlotStart" TEXT`,
  )
  await safe(
    "add campSlotEnd if missing",
    sql`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "campSlotEnd" TEXT`,
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

  // 2.05) דדופ קייטנה היסטורי לפי שעת סלוט דרך campMeetingCellId (גם אם campSlotStart/End עוד לא נשמרו).
  await safe(
    "dedupe camp teacher rows by slot from cell",
    sql`
      DELETE FROM "Attendance" a
      USING (
        SELECT
          a2."teacherId",
          COALESCE(a2."courseId", '') AS course_key,
          a2."date",
          COALESCE(ms."startTime", '') AS slot_start_key,
          COALESCE(ms."endTime", '') AS slot_end_key
        FROM "Attendance" a2
        LEFT JOIN "CampMeetingCell" mc ON mc.id = a2."campMeetingCellId"
        LEFT JOIN "CampMeetingSlot" ms ON ms.id = mc."slotId"
        WHERE a2."teacherId" IS NOT NULL
          AND a2."studentId" IS NULL
          AND a2."campMeetingCellId" IS NOT NULL
          AND COALESCE(ms."startTime", '') <> ''
          AND COALESCE(ms."endTime", '') <> ''
        GROUP BY
          a2."teacherId",
          COALESCE(a2."courseId", ''),
          a2."date",
          COALESCE(ms."startTime", ''),
          COALESCE(ms."endTime", '')
        HAVING COUNT(*) > 1
      ) keep
      WHERE a."teacherId" = keep."teacherId"
        AND COALESCE(a."courseId", '') = keep.course_key
        AND a."date" = keep."date"
        AND COALESCE((
          SELECT ms2."startTime"
          FROM "CampMeetingCell" mc2
          LEFT JOIN "CampMeetingSlot" ms2 ON ms2.id = mc2."slotId"
          WHERE mc2.id = a."campMeetingCellId"
          LIMIT 1
        ), '') = keep.slot_start_key
        AND COALESCE((
          SELECT ms3."endTime"
          FROM "CampMeetingCell" mc3
          LEFT JOIN "CampMeetingSlot" ms3 ON ms3.id = mc3."slotId"
          WHERE mc3.id = a."campMeetingCellId"
          LIMIT 1
        ), '') = keep.slot_end_key
        AND a."studentId" IS NULL
        AND a.id <> (
          SELECT a4.id
          FROM "Attendance" a4
          LEFT JOIN "CampMeetingCell" mc4 ON mc4.id = a4."campMeetingCellId"
          LEFT JOIN "CampMeetingSlot" ms4 ON ms4.id = mc4."slotId"
          WHERE a4."teacherId" = keep."teacherId"
            AND COALESCE(a4."courseId", '') = keep.course_key
            AND a4."date" = keep."date"
            AND COALESCE(ms4."startTime", '') = keep.slot_start_key
            AND COALESCE(ms4."endTime", '') = keep.slot_end_key
            AND a4."studentId" IS NULL
          ORDER BY a4."createdAt" ASC, a4.id ASC
          LIMIT 1
        )
    `,
  )

  // 2.1) דדופ קייטנה: לאותו מורה אסור יותר משורה אחת לאותו סלוט שעה באותו יום.
  // שומר שורה ותיקה אחת לכל (teacherId, courseId, date, campSlotStart, campSlotEnd), מוחק את היתר.
  await safe(
    "dedupe camp teacher same-slot rows",
    sql`
      DELETE FROM "Attendance" a
      USING (
        SELECT
          "teacherId",
          COALESCE("courseId", '') AS course_key,
          "date",
          COALESCE("campSlotStart", '') AS slot_start_key,
          COALESCE("campSlotEnd", '') AS slot_end_key
        FROM "Attendance"
        WHERE "teacherId" IS NOT NULL
          AND "studentId" IS NULL
          AND COALESCE("campSlotStart", '') <> ''
          AND COALESCE("campSlotEnd", '') <> ''
        GROUP BY
          "teacherId",
          COALESCE("courseId", ''),
          "date",
          COALESCE("campSlotStart", ''),
          COALESCE("campSlotEnd", '')
        HAVING COUNT(*) > 1
      ) keep
      WHERE a."teacherId" = keep."teacherId"
        AND COALESCE(a."courseId", '') = keep.course_key
        AND a."date" = keep."date"
        AND COALESCE(a."campSlotStart", '') = keep.slot_start_key
        AND COALESCE(a."campSlotEnd", '') = keep.slot_end_key
        AND a."studentId" IS NULL
        AND a.id <> (
          SELECT id
          FROM "Attendance"
          WHERE "teacherId" = keep."teacherId"
            AND COALESCE("courseId", '') = keep.course_key
            AND "date" = keep."date"
            AND COALESCE("campSlotStart", '') = keep.slot_start_key
            AND COALESCE("campSlotEnd", '') = keep.slot_end_key
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
