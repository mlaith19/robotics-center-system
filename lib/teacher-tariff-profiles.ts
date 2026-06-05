import type { Sql } from "postgres"
import {
  normalizeTeacherAttendanceHourKind,
  type TeacherAttendanceHourKind,
} from "@/lib/teacher-attendance-hour-kind"
import { normalizeStudentTierRates, resolveTeacherHourlyRate } from "@/lib/teacher-pricing"

export type TeacherTariffProfileRow = {
  id: string
  name: string
  description: string | null
  pricingMethod: "standard" | "per_student_tier"
  centerHourlyRate: number | null
  travelRate: number | null
  externalCourseRate: number | null
  officeHourlyRate: number | null
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
  await safe(
    "TeacherTariffProfile officeHourlyRate",
    sql`
      ALTER TABLE "TeacherTariffProfile"
      ADD COLUMN IF NOT EXISTS "officeHourlyRate" DOUBLE PRECISION
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
  const officeHourlyRate = body.officeHourlyRate != null && body.officeHourlyRate !== "" ? Number(body.officeHourlyRate) : null
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
    officeHourlyRate,
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
    travelRate: row.travelRate != null ? Number(row.travelRate) : null,
    externalCourseRate: row.externalCourseRate != null ? Number(row.externalCourseRate) : 0,
    officeHourlyRate: row.officeHourlyRate != null ? Number(row.officeHourlyRate) : null,
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
  hourKind?: TeacherAttendanceHourKind | null,
  presentStudentsCount?: number | null,
): number {
  const args = rowToTariffResolveArgs(profileRow)
  return resolveTeacherHourlyRate({
    ...args,
    location,
    enrollmentCount,
    presentStudentsCount: presentStudentsCount ?? null,
    hourKind: hourKind ?? "teaching",
  })
}

/** פרופיל מהקורס; אם אין — נתוני מורה (legacy) */
export function resolveHourlyRateForAttendance(params: {
  tariffProfileRow: Record<string, unknown> | null
  teacherRow: Record<string, unknown>
  location: string | null
  enrollmentCount: number
  /** מספר תלמידים שסימנו "נוכח" באותו מפגש — רלוונטי בעיקר לפרופיל "לפי מדרגות תלמידים". */
  presentStudentsCount?: number | null
  hourKind?: TeacherAttendanceHourKind | null
}): number {
  const hourKind = params.hourKind === "office" ? "office" : "teaching"
  if (params.tariffProfileRow) {
    return resolveHourlyRateFromTariffProfileRow(
      params.tariffProfileRow,
      params.location,
      params.enrollmentCount,
      hourKind,
      params.presentStudentsCount ?? null,
    )
  }
  return resolveTeacherHourlyRate({
    pricingMethod: (params.teacherRow.pricingMethod as "standard" | "per_student_tier") || "standard",
    centerHourlyRate: Number(params.teacherRow.centerHourlyRate || 0),
    travelRate: params.teacherRow.travelRate != null ? Number(params.teacherRow.travelRate) : null,
    externalCourseRate: Number(params.teacherRow.externalCourseRate || 0),
    officeHourlyRate: params.teacherRow.officeHourlyRate != null ? Number(params.teacherRow.officeHourlyRate) : null,
    studentTierRates: normalizeStudentTierRates(params.teacherRow.studentTierRates),
    bonusEnabled: params.teacherRow.bonusEnabled === true,
    bonusMinStudents: params.teacherRow.bonusMinStudents != null ? Number(params.teacherRow.bonusMinStudents) : null,
    bonusPerHour: params.teacherRow.bonusPerHour != null ? Number(params.teacherRow.bonusPerHour) : 0,
    location: params.location,
    enrollmentCount: params.enrollmentCount,
    presentStudentsCount: params.presentStudentsCount ?? null,
    hourKind,
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

/** מחשב תעריף לשעה לכל רשומת נוכחות מורה (לדוחות ודף מורה) */
export async function enrichTeacherAttendanceRowsWithRates(
  sql: Sql,
  teacherId: string,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  await ensureTeacherTariffTables(sql)
  const teacherRows = await sql`SELECT * FROM "Teacher" WHERE id = ${teacherId} LIMIT 1`
  const teacherRow = (teacherRows[0] ?? {}) as Record<string, unknown>
  const enrollRows = await sql`
    SELECT "courseId", COUNT(*)::int as cnt FROM "Enrollment" GROUP BY "courseId"
  `
  const encMap = new Map<string, number>()
  for (const r of enrollRows as { courseId: string; cnt: string | number }[]) {
    encMap.set(String(r.courseId), Number(r.cnt))
  }
  const links = await sql`
    SELECT ctt."courseId",
      p."pricingMethod" as "tp_pricingMethod",
      p."centerHourlyRate" as "tp_centerHourlyRate",
      p."travelRate" as "tp_travelRate",
      p."externalCourseRate" as "tp_externalCourseRate",
      p."officeHourlyRate" as "tp_officeHourlyRate",
      p."studentTierRates" as "tp_studentTierRates",
      p."bonusEnabled" as "tp_bonusEnabled",
      p."bonusMinStudents" as "tp_bonusMinStudents",
      p."bonusPerHour" as "tp_bonusPerHour"
    FROM "CourseTeacherTariff" ctt
    INNER JOIN "TeacherTariffProfile" p ON p.id = ctt."tariffProfileId"
    WHERE ctt."teacherId" = ${teacherId}
  `
  const profileByCourse = new Map<string, Record<string, unknown>>()
  for (const row of links as Record<string, unknown>[]) {
    const cid = String(row.courseId || "")
    profileByCourse.set(cid, {
      pricingMethod: row.tp_pricingMethod,
      centerHourlyRate: row.tp_centerHourlyRate,
      travelRate: row.tp_travelRate,
      externalCourseRate: row.tp_externalCourseRate,
      officeHourlyRate: row.tp_officeHourlyRate,
      studentTierRates: row.tp_studentTierRates,
      bonusEnabled: row.tp_bonusEnabled,
      bonusMinStudents: row.tp_bonusMinStudents,
      bonusPerHour: row.tp_bonusPerHour,
    })
  }

  // ספירת תלמידים שסומנו "נוכח" לכל שילוב של (courseId, date, campMeetingCellId)
  // כך שחישוב המדרגות יתבצע לפי נוכחות בפועל של אותו מפגש, ולא לפי סה"כ רשומים בקורס.
  const courseDateKeys = new Set<string>()
  const uniqueCourseIds = new Set<string>()
  const uniqueDates = new Set<string>()
  for (const r of rows) {
    const cid = r.courseId ? String(r.courseId) : ""
    const ymd = String(r.date ?? "").trim().slice(0, 10)
    if (!cid || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
    uniqueCourseIds.add(cid)
    uniqueDates.add(ymd)
    const cell = r.campMeetingCellId ? String(r.campMeetingCellId) : ""
    courseDateKeys.add(`${cid}|${ymd}|${cell}`)
  }
  const presentByKey = new Map<string, number>()
  if (uniqueCourseIds.size > 0 && uniqueDates.size > 0) {
    const courseIdsArr = Array.from(uniqueCourseIds)
    const datesArr = Array.from(uniqueDates)
    const presentRows = await sql`
      SELECT "courseId",
             "date",
             COALESCE("campMeetingCellId", '') AS cell_key,
             COUNT(DISTINCT "studentId")::int AS cnt
      FROM "Attendance"
      WHERE "studentId" IS NOT NULL
        AND LOWER(TRIM(COALESCE(status, ''))) IN ('present', 'נוכח')
        AND "courseId" = ANY(${courseIdsArr}::text[])
        AND "date" = ANY(${datesArr}::text[])
      GROUP BY "courseId", "date", COALESCE("campMeetingCellId", '')
    `
    for (const pr of presentRows as {
      courseId: string
      date: string
      cell_key: string
      cnt: string | number
    }[]) {
      const key = `${String(pr.courseId)}|${String(pr.date).slice(0, 10)}|${String(pr.cell_key || "")}`
      presentByKey.set(key, Number(pr.cnt || 0))
    }
  }

  return rows.map((r) => {
    const cid = r.courseId ? String(r.courseId) : ""
    const prof = cid ? profileByCourse.get(cid) ?? null : null
    const loc = r.courseLocation != null ? String(r.courseLocation) : null
    const hourKind = normalizeTeacherAttendanceHourKind(r.hourKind)
    const ymd = String(r.date ?? "").trim().slice(0, 10)
    const cell = r.campMeetingCellId ? String(r.campMeetingCellId) : ""
    const presentCountForThisSession = cid && /^\d{4}-\d{2}-\d{2}$/.test(ymd)
      ? presentByKey.get(`${cid}|${ymd}|${cell}`) ?? 0
      : null
    const rate = resolveHourlyRateForAttendance({
      tariffProfileRow: prof,
      teacherRow,
      location: loc,
      enrollmentCount: cid ? encMap.get(cid) ?? 0 : 0,
      presentStudentsCount: presentCountForThisSession,
      hourKind,
    })
    return { ...r, appliedHourlyRate: rate, presentStudentsCount: presentCountForThisSession }
  })
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
