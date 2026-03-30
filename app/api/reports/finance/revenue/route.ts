import { sql, handleDbError } from "@/lib/db"
import { requireReportAccess } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "finance/revenue")
  if (forbidden) return forbidden

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)
  const courseId = searchParams.get("courseId")?.trim() || null

  try {
    const conditions: string[] = ["(p.\"paymentType\" IS NULL OR p.\"paymentType\" NOT IN ('discount', 'credit'))"]
    const params: (string | number)[] = []
    let paramIdx = 1

    if (startDate) { conditions.push(`p."paymentDate" >= $${paramIdx}::timestamp`); params.push(startDate); paramIdx++ }
    if (endDate)   { conditions.push(`p."paymentDate" <= $${paramIdx}::timestamp`); params.push(endDate + "T23:59:59.999Z"); paramIdx++ }
    if (courseId)  { conditions.push(`p."courseId" = $${paramIdx}`); params.push(courseId); paramIdx++ }

    const whereClause = "WHERE " + conditions.join(" AND ")

    const countResult = await sql.unsafe(`SELECT COUNT(*) as c FROM "Payment" p ${whereClause}`, params)
    const total = Number((countResult[0] as { c: string })?.c ?? 0)

    const sumResult = await sql.unsafe(`SELECT COALESCE(SUM(p.amount), 0) as s FROM "Payment" p ${whereClause}`, params)
    const totalRevenue = Number((sumResult[0] as { s: string })?.s ?? 0)

    const offset = (page - 1) * limit
    params.push(limit, offset)
    const rows = await sql.unsafe(
      `SELECT p.id, p."studentId", p.amount, p."paymentDate", p."paymentType", p.description, p."courseId",
              s.name as "studentName"
       FROM "Payment" p
       LEFT JOIN "Student" s ON s.id = p."studentId"
       ${whereClause}
       ORDER BY p."paymentDate" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    )

    const kpis: ReportKpi[] = [
      { id: "totalRevenue",    label: "סה\"כ הכנסות (בתקופה)", value: totalRevenue, format: "currency" },
      { id: "transactionCount", label: "מספר תשלומים",          value: total, format: "number" },
      { id: "avgPayment",      label: "ממוצע לתשלום",           value: total > 0 ? Math.round((totalRevenue / total) * 100) / 100 : 0, format: "currency" },
    ]
    const response: ReportResponse = { kpis, rows: rows as Record<string, unknown>[], pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/finance/revenue")
  }
})
