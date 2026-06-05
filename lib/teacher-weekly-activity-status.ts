import type { Sql } from "postgres"

/**
 * מסנכרן סטטוס מורים לפי נוכחות בשבוע הנוכחי:
 * - יש נוכחות מורה השבוע -> פעיל
 * - אין נוכחות מורה השבוע -> לא פעיל
 * לא מעדכן מורים במצב "מתעניין".
 */
export async function syncTeacherWeeklyActivityStatus(db: Sql): Promise<void> {
  try {
    await db.unsafe(`
      WITH week_bounds AS (
        SELECT date_trunc('week', CURRENT_DATE)::date AS week_start
      ),
      active_teachers AS (
        SELECT DISTINCT a."teacherId" AS id
        FROM "Attendance" a, week_bounds wb
        WHERE a."teacherId" IS NOT NULL
          AND LENGTH(TRIM(COALESCE(a.date::text, ''))) >= 10
          AND LEFT(TRIM(a.date::text), 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND (LEFT(TRIM(a.date::text), 10))::date >= wb.week_start
          AND (LEFT(TRIM(a.date::text), 10))::date < wb.week_start + INTERVAL '7 day'
      )
      UPDATE "Teacher" t
      SET status = CASE
          WHEN EXISTS (SELECT 1 FROM active_teachers a WHERE a.id = t.id) THEN 'פעיל'
          ELSE 'לא פעיל'
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE TRIM(COALESCE(t.status, '')) <> 'מתעניין'
        AND COALESCE(TRIM(t.status), '') <> CASE
          WHEN EXISTS (SELECT 1 FROM active_teachers a WHERE a.id = t.id) THEN 'פעיל'
          ELSE 'לא פעיל'
        END
    `)
  } catch (err) {
    console.warn("[teacher-weekly-activity-status] sync failed:", err)
  }
}
