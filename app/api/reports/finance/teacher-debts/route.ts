import { handleDbError } from "@/lib/db"
import { requireReportAccess } from "@/lib/reports-auth"
import { type ReportKpi, type ReportResponse, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { ensureTeacherPricingColumns } from "@/lib/teacher-pricing"
import { ensureTeacherTariffTables, resolveHourlyRateForAttendance } from "@/lib/teacher-tariff-profiles"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

function isPresentStatus(raw: unknown): boolean {
  const status = String(raw ?? "").trim().toLowerCase()
  return status === "present" || status === "נוכח"
}

function parseClockToHours(raw: unknown): number | null {
  const s = String(raw ?? "")
  const m = s.match(/(\d{2}):(\d{2})/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh + mm / 60
}

function calcHours(row: Record<string, unknown>): number {
  const explicit = Number(row.hours ?? 0)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const start = parseClockToHours(row.courseStartTime)
  const end = parseClockToHours(row.courseEndTime)
  if (start != null && end != null) {
    const delta = end - start
    if (Number.isFinite(delta) && delta > 0) return delta
  }
  return 0
}

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "finance/teacher-debts")
  if (forbidden) return forbidden

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)

  try {
    await ensureTeacherPricingColumns(db)
    await ensureTeacherTariffTables(db)

    const offset = (page - 1) * limit

    const attendanceDateWhere: string[] = []
    const expenseDateWhere: string[] = []
    const params: (string | number)[] = []
    let idx = 1

    if (startDate) {
      attendanceDateWhere.push(`a."date" >= $${idx}::timestamp`)
      expenseDateWhere.push(`e."date" >= $${idx}::timestamp`)
      params.push(startDate)
      idx++
    }
    if (endDate) {
      attendanceDateWhere.push(`a."date" <= $${idx}::timestamp`)
      expenseDateWhere.push(`e."date" <= $${idx}::timestamp`)
      params.push(`${endDate}T23:59:59.999Z`)
      idx++
    }

    const attendanceWhereSql = attendanceDateWhere.length ? `AND ${attendanceDateWhere.join(" AND ")}` : ""
    const expenseWhereSql = expenseDateWhere.length ? `AND ${expenseDateWhere.join(" AND ")}` : ""

    const appliedRateColumnCheck = await db<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Attendance'
          AND column_name = 'appliedHourlyRate'
      ) AS "exists"
    `
    const hasAppliedHourlyRate = Boolean(appliedRateColumnCheck[0]?.exists)
    const hourKindColumnCheck = await db<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Attendance'
          AND column_name = 'hourKind'
      ) AS "exists"
    `
    const hasHourKind = Boolean(hourKindColumnCheck[0]?.exists)

    const attendanceRows = await db.unsafe(
      `
      SELECT
        a."teacherId" AS "teacherId",
        a.status,
        a.hours,
        a."courseId" AS "courseId",
        c.location AS "courseLocation",
        c."startTime" AS "courseStartTime",
        c."endTime" AS "courseEndTime",
        ${hasAppliedHourlyRate ? `a."appliedHourlyRate" AS "appliedHourlyRate"` : `NULL::numeric AS "appliedHourlyRate"`},
        ${hasHourKind ? `a."hourKind" AS "hourKind"` : `NULL::text AS "hourKind"`}
      FROM "Attendance" a
      LEFT JOIN "Course" c ON c.id = a."courseId"
      WHERE a."teacherId" IS NOT NULL
        AND a."studentId" IS NULL
        ${attendanceWhereSql}
      `,
      params,
    )

    const paidRows = await db.unsafe(
      `
      SELECT e."teacherId" AS "teacherId", SUM(COALESCE(e.amount, 0)::numeric) AS paid
      FROM "Expense" e
      WHERE e."teacherId" IS NOT NULL
      ${expenseWhereSql}
      GROUP BY e."teacherId"
      `,
      params,
    )

    const teacherRows = await db<Record<string, unknown>[]>`SELECT * FROM "Teacher"`
    const teachersById = new Map<string, Record<string, unknown>>(
      teacherRows.map((t) => [String(t.id || ""), t]),
    )

    const enrollmentRows = await db<{ courseId: string; cnt: number }[]>`
      SELECT "courseId" AS "courseId", COUNT(*)::int AS cnt
      FROM "Enrollment"
      GROUP BY "courseId"
    `
    const enrollmentCountByCourse = new Map<string, number>(
      enrollmentRows.map((r) => [String(r.courseId || ""), Number(r.cnt || 0)]),
    )

    const tariffLinks = await db<Record<string, unknown>[]>`
      SELECT
        ctt."courseId" AS "courseId",
        ctt."teacherId" AS "teacherId",
        p."pricingMethod" AS "pricingMethod",
        p."centerHourlyRate" AS "centerHourlyRate",
        p."travelRate" AS "travelRate",
        p."externalCourseRate" AS "externalCourseRate",
        p."officeHourlyRate" AS "officeHourlyRate",
        p."studentTierRates" AS "studentTierRates",
        p."bonusEnabled" AS "bonusEnabled",
        p."bonusMinStudents" AS "bonusMinStudents",
        p."bonusPerHour" AS "bonusPerHour"
      FROM "CourseTeacherTariff" ctt
      INNER JOIN "TeacherTariffProfile" p ON p.id = ctt."tariffProfileId"
    `
    const profileByTeacherCourse = new Map<string, Record<string, unknown>>()
    for (const row of tariffLinks) {
      const key = `${String(row.teacherId || "")}::${String(row.courseId || "")}`
      profileByTeacherCourse.set(key, row)
    }

    const dueByTeacher = new Map<string, number>()
    for (const row of attendanceRows as Array<Record<string, unknown>>) {
      const teacherId = String(row.teacherId || "")
      if (!teacherId) continue
      if (!isPresentStatus(row.status)) continue
      const hours = calcHours(row)
      if (!(hours > 0)) continue

      const applied = Number(row.appliedHourlyRate ?? 0)
      const hasApplied = Number.isFinite(applied) && applied > 0
      let rate = hasApplied ? applied : 0
      if (!hasApplied) {
        const courseId = String(row.courseId || "")
        const teacherRow = teachersById.get(teacherId) || {}
        const profile = profileByTeacherCourse.get(`${teacherId}::${courseId}`) || null
        const enrollmentCount = courseId ? enrollmentCountByCourse.get(courseId) ?? 0 : 0
        rate = resolveHourlyRateForAttendance({
          tariffProfileRow: profile,
          teacherRow,
          location: row.courseLocation != null ? String(row.courseLocation) : null,
          enrollmentCount,
          hourKind: String(row.hourKind || "").toLowerCase() === "office" ? "office" : "teaching",
        })
      }
      const prev = dueByTeacher.get(teacherId) ?? 0
      dueByTeacher.set(teacherId, prev + hours * Math.max(0, rate))
    }

    const paidByTeacher = new Map<string, number>()
    for (const p of paidRows as Array<Record<string, unknown>>) {
      const teacherId = String(p.teacherId || "")
      if (!teacherId) continue
      paidByTeacher.set(teacherId, Number(p.paid || 0))
    }

    const teacherIds = new Set<string>([
      ...Array.from(dueByTeacher.keys()),
      ...Array.from(paidByTeacher.keys()),
    ])

    const typedRows = Array.from(teacherIds)
      .map((teacherId) => {
        const teacher = teachersById.get(teacherId) || {}
        const expected = Number(dueByTeacher.get(teacherId) || 0)
        const paid = Number(paidByTeacher.get(teacherId) || 0)
        const balance = expected - paid
        return {
          teacherId,
          teacherName: String(teacher.name || teacherId),
          phone: teacher.phone ? String(teacher.phone) : null,
          expected: Math.round(expected * 100) / 100,
          paid: Math.round(paid * 100) / 100,
          balance: Math.round(balance * 100) / 100,
        }
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.balance - a.balance)

    const total = typedRows.length
    const paginated = typedRows.slice(offset, offset + limit)
    const totalDebt = typedRows.reduce((sum, row) => sum + Math.max(0, Number(row.balance || 0)), 0)

    const kpis: ReportKpi[] = [
      { id: "teachersWithDebt", label: "מורים עם חוב", value: total, format: "number" },
      { id: "totalDebt", label: 'סה"כ חובות למורים (ש"ח)', value: Math.round(totalDebt * 100) / 100, format: "currency" },
    ]

    const response: ReportResponse = {
      kpis,
      rows: paginated,
      pagination: { page, limit, total },
    }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/finance/teacher-debts")
  }
})
