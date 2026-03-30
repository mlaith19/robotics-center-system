import { sql, handleDbError } from "@/lib/db"
import { requireReportAccess } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "finance/debts")
  if (forbidden) return forbidden

  const { searchParams } = new URL(req.url)
  const { startDate, endDate } = parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)

  try {
    const offset = (page - 1) * limit

    const debtRows = await sql`
      WITH student_expected AS (
        SELECT e."studentId", COALESCE(SUM(COALESCE(c.price, 0)), 0) as expected
        FROM "Enrollment" e
        JOIN "Course" c ON c.id = e."courseId"
        WHERE e.status IN ('active', 'פעיל') OR e.status IS NULL
        GROUP BY e."studentId"
      ),
      student_paid AS (
        SELECT "studentId", COALESCE(SUM(amount), 0) as paid
        FROM "Payment"
        GROUP BY "studentId"
      )
      SELECT
        s.id as "studentId", s.name as "studentName", s.phone,
        COALESCE(se.expected, 0) as expected,
        COALESCE(sp.paid, 0) as paid,
        (COALESCE(se.expected, 0) - COALESCE(sp.paid, 0)) as balance
      FROM "Student" s
      LEFT JOIN student_expected se ON se."studentId" = s.id
      LEFT JOIN student_paid sp ON sp."studentId" = s.id
      WHERE (COALESCE(se.expected, 0) - COALESCE(sp.paid, 0)) > 0
    `

    const filtered = debtRows as { studentId: string; studentName: string; phone: string | null; expected: string; paid: string; balance: string }[]
    const total = filtered.length

    const paginated = filtered.slice(offset, offset + limit).map((r) => ({
      studentId: r.studentId, studentName: r.studentName, phone: r.phone,
      expected: Number(r.expected), paid: Number(r.paid), balance: Number(r.balance),
    }))

    const totalDebt = filtered.reduce((sum, r) => sum + Number(r.balance), 0)

    const kpis: ReportKpi[] = [
      { id: "studentsWithDebt", label: "תלמידים עם חוב",   value: total, format: "number" },
      { id: "totalDebt",        label: "סה\"כ חובות (ש\"ח)", value: Math.round(totalDebt * 100) / 100, format: "currency" },
    ]
    const response: ReportResponse = { kpis, rows: paginated, pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/finance/debts")
  }
})
