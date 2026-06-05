import { handleDbError } from "@/lib/db"
import { requireReportAccess, getTeacherIdForUser } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "courses")
  if (forbidden) return forbidden

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)
  const teacherIdParam = searchParams.get("teacherId")?.trim() || null
  const schoolId       = searchParams.get("schoolId")?.trim()  || null

  const isTeacher = (session.role || "").toLowerCase() === "teacher"
  const teacherIdScope = isTeacher ? await getTeacherIdForUser(session.id, db) : teacherIdParam

  try {
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIdx = 1

    if (startDate) { conditions.push(`c."createdAt" >= $${paramIdx}::timestamp`); params.push(startDate); paramIdx++ }
    if (endDate)   { conditions.push(`c."createdAt" <= $${paramIdx}::timestamp`); params.push(endDate + "T23:59:59.999Z"); paramIdx++ }
    if (teacherIdScope) {
      conditions.push(`c."teacherIds" IS NOT NULL AND c."teacherIds" @> to_jsonb($${paramIdx}::text)`)
      params.push(teacherIdScope); paramIdx++
    }
    if (schoolId) { conditions.push(`c."schoolId" = $${paramIdx}`); params.push(schoolId); paramIdx++ }
    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : ""

    const countResult = await db.unsafe(`SELECT COUNT(*) as c FROM "Course" c ${whereClause}`, params)
    const total = Number((countResult[0] as { c: string })?.c ?? 0)

    params.push(limit, offset)
    const rows = await db.unsafe(
      `SELECT c.id, c.name, c.category, c.status, c.price, c."schoolId", c."createdAt",
              (SELECT COUNT(*) FROM "Enrollment" e WHERE e."courseId" = c.id) as "enrollmentCount"
       FROM "Course" c ${whereClause} ORDER BY c."createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    )

    const [allCount, activeCount, enrollTotal, newInPeriod] = await Promise.all([
      db`SELECT COUNT(*) as c FROM "Course"`,
      db`SELECT COUNT(*) as c FROM "Course" WHERE status IN ('active', 'פעיל') OR status IS NULL`,
      db`SELECT COUNT(*) as c FROM "Enrollment"`,
      startDate && endDate
        ? db.unsafe(`SELECT COUNT(*) as c FROM "Course" c WHERE c."createdAt" >= $1::timestamp AND c."createdAt" <= $2::timestamp`, [startDate, endDate + "T23:59:59.999Z"])
        : Promise.resolve([{ c: 0 }]),
    ])

    const kpis: ReportKpi[] = [
      { id: "total",       label: "סה\"כ קורסים",   value: Number((allCount[0] as { c: string })?.c ?? 0),    format: "number" },
      { id: "active",      label: "קורסים פעילים",  value: Number((activeCount[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "enrollments", label: "סה\"כ רישומים",  value: Number((enrollTotal[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "new",         label: "נוספו בתקופה",   value: Number((newInPeriod[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "filtered",    label: "בהתאם לסינון",   value: total, format: "number" },
    ]
    const response: ReportResponse = { kpis, rows: rows as Record<string, unknown>[], pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/courses")
  }
})
