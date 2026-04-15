import type { Sql } from "postgres"
import { normalizeCourseCalendarYmd } from "@/lib/course-db-fields"
import { listCampSessionDates } from "@/lib/camp-kaytana"

export async function ensureCourseSessionPricesColumn(sql: Sql) {
  try {
    await sql`
      ALTER TABLE "Course"
      ADD COLUMN IF NOT EXISTS "sessionPrices" JSONB NOT NULL DEFAULT '{}'::jsonb
    `
  } catch (e) {
    console.warn("[course-session-prices] ensure column skipped:", e)
  }
}

export async function ensureCourseNoAttendanceChargeColumn(sql: Sql) {
  try {
    await sql`
      ALTER TABLE "Course"
      ADD COLUMN IF NOT EXISTS "campChargeFirstSessionIfNoAttendance" BOOLEAN NOT NULL DEFAULT FALSE
    `
  } catch (e) {
    console.warn("[course-session-prices] ensure no-attendance charge column skipped:", e)
  }
}

/** מחירים לפי תאריך מפגש — רק מפתחות YYYY-MM-DD וערכים לא שליליים */
export function normalizeSessionPricesMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) continue
    out[k] = Math.round(n * 100) / 100
  }
  return out
}

export function sumSessionPricesForDates(
  dates: string[],
  perDate: Record<string, number>,
  fallbackPerSession: number,
): number {
  const fb = Number.isFinite(fallbackPerSession) && fallbackPerSession >= 0 ? fallbackPerSession : 0
  let sum = 0
  for (const d of dates) {
    const v = perDate[d]
    sum += v != null && Number.isFinite(v) ? v : fb
  }
  return Math.round(sum * 100) / 100
}

/** בניית מפת מחירים מלאה לכל תאריכי המפגשים (לשמירה ב-DB) */
export function buildSessionPricesForCourseDates(
  startRaw: unknown,
  endRaw: unknown,
  daysOfWeek: string[],
  inputMap: Record<string, number>,
  fallbackPerSession: number,
): Record<string, number> {
  const start = normalizeCourseCalendarYmd(startRaw)
  const end = normalizeCourseCalendarYmd(endRaw)
  if (!start || !end) return {}
  const dates = listCampSessionDates(start, end, daysOfWeek)
  const fb = Number.isFinite(fallbackPerSession) && fallbackPerSession >= 0 ? fallbackPerSession : 0
  const out: Record<string, number> = {}
  for (const d of dates) {
    const v = inputMap[d]
    out[d] = v != null && Number.isFinite(v) ? Math.round(v * 100) / 100 : Math.round(fb * 100) / 100
  }
  return out
}

export function courseTypeIsPerSession(courseType: string): boolean {
  return typeof courseType === "string" && courseType.endsWith("_session")
}
