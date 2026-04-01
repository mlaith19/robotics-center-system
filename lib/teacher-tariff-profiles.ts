import type { Sql } from "postgres"
import { normalizeStudentTierRates, resolveTeacherHourlyRate } from "@/lib/teacher-pricing"

export type TeacherTariffProfileRow = {
  id: string
  name: string
  description: string | null
  pricingMethod: "standard" | "per_student_tier"
  centerHourlyRate: number | null
  travelRate: number | null
  externalCourseRate: number | null
  studentTierRates: unknown
  bonusEnabled: boolean
  bonusMinStudents: number | null
  bonusPerHour: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export async function ensureTeacherTariffTables(sql: Sql) {
  const safe = async (label: string, p: Promise<unknown>) => {
    try {
      await p
    } catch (err) {
      console.warn(`[teacher-tariff] skip ${label}:`, err)
    }
  }
  await safe(
    "TeacherTariffProfile",
    sql`
      CREATE TABLE IF NOT EXISTS "TeacherTariffProfile" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        "pricingMethod" TEXT NOT NULL DEFAULT 'standard',
        "centerHourlyRate" DOUBLE PRECISION,
        "travelRate" DOUBLE PRECISION,
        "externalCourseRate" DOUBLE PRECISION,
        "studentTierRates" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "bonusEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "bonusMinStudents" INTEGER,
        "bonusPerHour" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  )
  await safe(
    "CourseTeacherTariff",
    sql`
      CREATE TABLE IF NOT EXISTS "CourseTeacherTariff" (
        "courseId" TEXT NOT NULL,
        "teacherId" TEXT NOT NULL,
        "tariffProfileId" TEXT NOT NULL,
        PRIMARY KEY ("courseId", "teacherId")
      )
    `,
  )
}

export function normalizeTariffProfilePayload(body: Record<string, unknown>) {
  const pricingMethod = body.pricingMethod === "per_student_tier" ? "per_student_tier" : "standard"
  const name = String(body.name ?? "").trim()
  const description = body.description != null ? String(body.description).trim() : null
  const centerHourlyRate = body.centerHourlyRate != null && body.centerHourlyRate !== "" ? Number(body.centerHourlyRate) : null
  const travelRate = body.travelRate != null && body.travelRate !== "" ? Number(body.travelRate) : null
  const externalCourseRate = body.externalCourseRate != null && body.externalCourseRate !== "" ? Number(body.externalCourseRate) : null
  const studentTierRates = normalizeStudentTierRates(body.studentTierRates)
  const bonusEnabled = body.bonusEnabled === true
  const bonusMinStudents =
    body.bonusMinStudents != null && body.bonusMinStudents !== "" ? Number(body.bonusMinStudents) : null
  const bonusPerHour = body.bonusPerHour != null && body.bonusPerHour !== "" ? Number(body.bonusPerHour) : 0
  const isActive = body.isActive !== false
  return {
    name,
    description: description?.length ? description : null,
    pricingMethod,
    centerHourlyRate,
    travelRate,
    externalCourseRate,
    studentTierRates,
    bonusEnabled,
    bonusMinStudents,
    bonusPerHour,
    isActive,
  }
}

export function rowToTariffResolveArgs(row: Record<string, unknown>) {
  return {
    pricingMethod: (row.pricingMethod as "standard" | "per_student_tier") || "standard",
    centerHourlyRate: row.centerHourlyRate != null ? Number(row.centerHourlyRate) : 0,
    externalCourseRate: row.externalCourseRate != null ? Number(row.externalCourseRate) : 0,
    studentTierRates: normalizeStudentTierRates(row.studentTierRates),
    bonusEnabled: row.bonusEnabled === true,
    bonusMinStudents: row.bonusMinStudents != null ? Number(row.bonusMinStudents) : null,
    bonusPerHour: row.bonusPerHour != null ? Number(row.bonusPerHour) : 0,
  }
}

export function resolveHourlyRateFromTariffProfileRow(
  profileRow: Record<string, unknown>,
  location: string | null,
  enrollmentCount: number,
): number {
  const args = rowToTariffResolveArgs(profileRow)
  return resolveTeacherHourlyRate({
    ...args,
    location,
    enrollmentCount,
  })
}

/** פרופיל מהקורס; אם אין — נתוני מורה (legacy) */
export function resolveHourlyRateForAttendance(params: {
  tariffProfileRow: Record<string, unknown> | null
  teacherRow: Record<string, unknown>
  location: string | null
  enrollmentCount: number
}): number {
  if (params.tariffProfileRow) {
    return resolveHourlyRateFromTariffProfileRow(params.tariffProfileRow, params.location, params.enrollmentCount)
  }
  return resolveTeacherHourlyRate({
    pricingMethod: (params.teacherRow.pricingMethod as "standard" | "per_student_tier") || "standard",
    centerHourlyRate: Number(params.teacherRow.centerHourlyRate || 0),
    externalCourseRate: Number(params.teacherRow.externalCourseRate || 0),
    studentTierRates: normalizeStudentTierRates(params.teacherRow.studentTierRates),
    bonusEnabled: params.teacherRow.bonusEnabled === true,
    bonusMinStudents: params.teacherRow.bonusMinStudents != null ? Number(params.teacherRow.bonusMinStudents) : null,
    bonusPerHour: params.teacherRow.bonusPerHour != null ? Number(params.teacherRow.bonusPerHour) : 0,
    location: params.location,
    enrollmentCount: params.enrollmentCount,
  })
}

export async function syncCourseTeacherTariffs(
  sql: Sql,
  courseId: string,
  teacherIds: string[],
  tariffByTeacherId: Record<string, string> | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureTeacherTariffTables(sql)
  const cid = String(courseId)
  if (teacherIds.length === 0) {
    await sql`DELETE FROM "CourseTeacherTariff" WHERE "courseId" = ${cid}`
    return { ok: true }
  }
  await sql`
    DELETE FROM "CourseTeacherTariff"
    WHERE "courseId" = ${cid}
      AND NOT ("teacherId" = ANY(${teacherIds}))
  `
  if (!tariffByTeacherId) {
    return { ok: true }
  }
  for (const tid of teacherIds) {
    const raw = tariffByTeacherId[tid]
    const pid = raw != null ? String(raw).trim() : ""
    if (!pid) {
      return { ok: false, error: "teacherTariff.missingProfile" }
    }
  }
  for (const tid of teacherIds) {
    const profileId = String(tariffByTeacherId[tid]).trim()
    await sql`
      INSERT INTO "CourseTeacherTariff" ("courseId", "teacherId", "tariffProfileId")
      VALUES (${cid}, ${tid}, ${profileId})
      ON CONFLICT ("courseId", "teacherId") DO UPDATE SET "tariffProfileId" = EXCLUDED."tariffProfileId"
    `
  }
  return { ok: true }
}

export async function loadCourseTeacherTariffMap(
  sql: Sql,
  courseId: string,
): Promise<Record<string, string>> {
  await ensureTeacherTariffTables(sql)
  const rows = await sql`
    SELECT "teacherId", "tariffProfileId" FROM "CourseTeacherTariff" WHERE "courseId" = ${courseId}
  `
  const out: Record<string, string> = {}
  ;(rows as unknown as { teacherId: string; tariffProfileId: string }[]).forEach((r) => {
    out[String(r.teacherId)] = String(r.tariffProfileId)
  })
  return out
}
