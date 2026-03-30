import { sql, handleDbError } from "@/lib/db"
import { requireReportAccess, getTeacherIdForUser } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "students")
  if (forbidden) return forbidden

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)
  const courseId      = searchParams.get("courseId")?.trim()  || null
  const teacherIdParam = searchParams.get("teacherId")?.trim() || null

  const teacherIdScope = session.roleKey !== "super_admin" && (session.role || "").toLowerCase() === "teacher"
    ? await getTeacherIdForUser(session.id)
    : teacherIdParam

  try {
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIdx = 1

    if (startDate) { conditions.push(`s."createdAt" >= $${paramIdx}::timestamp`); params.push(startDate); paramIdx++ }
    if (endDate)   { conditions.push(`s."createdAt" <= $${paramIdx}::timestamp`); params.push(endDate + "T23:59:59.999Z"); paramIdx++ }
    if (courseId) {
      conditions.push(`EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId" = s.id AND e."courseId" = $${paramIdx})`)
      params.push(courseId); paramIdx++
    }
    if (teacherIdScope) {
      conditions.push(`EXISTS (
        SELECT 1 FROM "Enrollment" e
        JOIN "Course" c ON c.id = e."courseId"
        WHERE e."studentId" = s.id AND c."teacherIds" IS NOT NULL AND c."teacherIds" @> to_jsonb($${paramIdx}::text)
      )`)
      params.push(teacherIdScope); paramIdx++
    }
    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : ""

    const countResult = await sql.unsafe(`SELECT COUNT(*) as c FROM "Student" s ${whereClause}`, params)
    const total = Number((countResult[0] as { c: string })?.c ?? 0)

    const orderOffset = `ORDER BY s."createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`
    params.push(limit, offset)

    const rows = await sql.unsafe(
      `SELECT s.id, s.name, s.email, s.phone, s.status, s."createdAt" FROM "Student" s ${whereClause} ${orderOffset}`,
      params
    )

    const allCount    = await sql`SELECT COUNT(*) as c FROM "Student"`
    const activeCount = await sql`SELECT COUNT(*) as c FROM "Student" WHERE status IN ('active', 'פעיל') OR status IS NULL`
    const newInPeriod = startDate && endDate
      ? await sql`SELECT COUNT(*) as c FROM "Student" WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate + "T23:59:59.999Z"}`
      : [{ c: 0 }]

    const kpis: ReportKpi[] = [
      { id: "total",    label: "סה\"כ תלמידים",  value: Number((allCount[0] as { c: string })?.c ?? 0),    format: "number" },
      { id: "active",   label: "תלמידים פעילים", value: Number((activeCount[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "new",      label: "נוספו בתקופה",   value: Number((newInPeriod[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "filtered", label: "בהתאם לסינון",   value: total, format: "number" },
    ]
    const response: ReportResponse = { kpis, rows: rows as Record<string, unknown>[], pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/students")
  }
})
