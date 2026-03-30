import { sql, handleDbError } from "@/lib/db"
import { requireReportAccess, getTeacherIdForUser } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "teachers")
  if (forbidden) return forbidden

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)
  const courseId = searchParams.get("courseId")?.trim() || null

  const isTeacher = (session.role || "").toLowerCase() === "teacher"
  const teacherIdScope = isTeacher ? await getTeacherIdForUser(session.id) : null

  try {
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIdx = 1

    if (startDate) { conditions.push(`t."createdAt" >= $${paramIdx}::timestamp`); params.push(startDate); paramIdx++ }
    if (endDate)   { conditions.push(`t."createdAt" <= $${paramIdx}::timestamp`); params.push(endDate + "T23:59:59.999Z"); paramIdx++ }
    if (courseId) {
      conditions.push(`EXISTS (SELECT 1 FROM "Course" c WHERE c."teacherIds" IS NOT NULL AND c."teacherIds" @> to_jsonb(t.id::text) AND c.id = $${paramIdx})`)
      params.push(courseId); paramIdx++
    }
    if (teacherIdScope) { conditions.push(`t.id = $${paramIdx}`); params.push(teacherIdScope); paramIdx++ }
    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : ""

    const countResult = await sql.unsafe(`SELECT COUNT(*) as c FROM "Teacher" t ${whereClause}`, params)
    const total = Number((countResult[0] as { c: string })?.c ?? 0)

    params.push(limit, offset)
    const rows = await sql.unsafe(
      `SELECT t.id, t.name, t.email, t.phone, t.status, t.specialty, t."createdAt"
       FROM "Teacher" t ${whereClause} ORDER BY t."createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    )

    const allCount    = await sql`SELECT COUNT(*) as c FROM "Teacher"`
    const activeCount = await sql`SELECT COUNT(*) as c FROM "Teacher" WHERE status IN ('active', 'פעיל') OR status IS NULL`
    const newInPeriod = startDate && endDate
      ? await sql.unsafe(`SELECT COUNT(*) as c FROM "Teacher" t WHERE t."createdAt" >= $1::timestamp AND t."createdAt" <= $2::timestamp`, [startDate, endDate + "T23:59:59.999Z"])
      : [{ c: 0 }]

    const kpis: ReportKpi[] = [
      { id: "total",    label: "סה\"כ מורים",  value: Number((allCount[0] as { c: string })?.c ?? 0),    format: "number" },
      { id: "active",   label: "מורים פעילים", value: Number((activeCount[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "new",      label: "נוספו בתקופה", value: Number((newInPeriod[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "filtered", label: "בהתאם לסינון", value: total, format: "number" },
    ]
    const response: ReportResponse = { kpis, rows: rows as Record<string, unknown>[], pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/teachers")
  }
})
