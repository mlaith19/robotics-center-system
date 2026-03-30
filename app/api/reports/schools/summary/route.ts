import { sql, handleDbError } from "@/lib/db"
import { requireReportAccess } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "schools/summary")
  if (forbidden) return forbidden

  const { searchParams } = new URL(req.url)
  const { page, limit } = parseReportPagination(searchParams)

  try {
    const offset = (page - 1) * limit

    const countResult = await sql`SELECT COUNT(*) as c FROM "School"`
    const total = Number((countResult[0] as { c: string })?.c ?? 0)

    const rows = await sql`
      SELECT
        sc.id, sc.name, sc.city, sc.status,
        (SELECT COUNT(*) FROM "Course" c WHERE c."schoolId" = sc.id) as "courseCount",
        (SELECT COUNT(DISTINCT e."studentId") FROM "Enrollment" e JOIN "Course" c ON c.id = e."courseId" WHERE c."schoolId" = sc.id) as "studentCount"
      FROM "School" sc
      ORDER BY sc.name
      LIMIT ${limit} OFFSET ${offset}
    `

    const allSchools = await sql`SELECT COUNT(*) as c FROM "School"`
    const allCourses = await sql`SELECT COUNT(*) as c FROM "Course" WHERE "schoolId" IS NOT NULL`
    const kpis: ReportKpi[] = [
      { id: "totalSchools",    label: "סה\"כ בתי ספר",   value: Number((allSchools[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "coursesInSchools", label: "קורסים בבתי ספר", value: Number((allCourses[0] as { c: string })?.c ?? 0), format: "number" },
      { id: "filtered",        label: "בעמוד זה",          value: (rows as unknown[]).length, format: "number" },
    ]
    const response: ReportResponse = { kpis, rows: rows as Record<string, unknown>[], pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/schools/summary")
  }
})
