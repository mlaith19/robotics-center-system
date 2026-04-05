import type { Sql } from "postgres"

/** סוג שעה לנוכחות מורה — הוראה מול שעת משרד (תעריף נפרד בפרופיל) */
export type TeacherAttendanceHourKind = "teaching" | "office"

export function normalizeTeacherAttendanceHourKind(raw: unknown): TeacherAttendanceHourKind {
  const v = String(raw ?? "").trim().toLowerCase()
  return v === "office" ? "office" : "teaching"
}

export async function ensureAttendanceHourKindColumn(sql: Sql) {
  try {
    await sql`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "hourKind" TEXT`
  } catch (e) {
    console.warn("[teacher-attendance-hour-kind] ensure column:", e)
  }
}
