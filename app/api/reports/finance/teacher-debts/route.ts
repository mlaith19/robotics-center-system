import { handleDbError } from "@/lib/db"
import { requireReportAccess } from "@/lib/reports-auth"
import { type ReportKpi, type ReportResponse, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"

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

    const rows = await db.unsafe(
      `
      WITH teacher_due AS (
        SELECT
          a."teacherId" AS "teacherId",
          SUM(
            (
              CASE
                WHEN a.hours IS NOT NULL THEN a.hours::numeric
                WHEN c."startTime" IS NOT NULL AND c."endTime" IS NOT NULL
                  THEN GREATEST(EXTRACT(EPOCH FROM (c."endTime"::time - c."startTime"::time)) / 3600.0, 0)::numeric
                ELSE 0::numeric
              END
            )
            *
            (
              CASE
                WHEN a."appliedHourlyRate" IS NOT NULL THEN a."appliedHourlyRate"::numeric
                ELSE 0::numeric
              END
            )
          ) AS expected
        FROM "Attendance" a
        LEFT JOIN "Course" c ON c.id = a."courseId"
        WHERE a."teacherId" IS NOT NULL
          AND a."studentId" IS NULL
          AND (
            LOWER(BTRIM(COALESCE(a.status, ''))) = 'present'
            OR BTRIM(COALESCE(a.status, '')) = 'נוכח'
          )
          ${attendanceWhereSql}
        GROUP BY a."teacherId"
      ),
      teacher_paid AS (
        SELECT
          e."teacherId" AS "teacherId",
          SUM(COALESCE(e.amount, 0)::numeric) AS paid
        FROM "Expense" e
        WHERE e."teacherId" IS NOT NULL
          ${expenseWhereSql}
        GROUP BY e."teacherId"
      ),
      merged AS (
        SELECT
          t.id AS "teacherId",
          t.name AS "teacherName",
          t.phone AS phone,
          COALESCE(d.expected, 0)::numeric AS expected,
          COALESCE(p.paid, 0)::numeric AS paid,
          (COALESCE(d.expected, 0) - COALESCE(p.paid, 0))::numeric AS balance
        FROM "Teacher" t
        LEFT JOIN teacher_due d ON d."teacherId" = t.id
        LEFT JOIN teacher_paid p ON p."teacherId" = t.id
      )
      SELECT *
      FROM merged
      WHERE balance > 0
      ORDER BY balance DESC, "teacherName" ASC
      `,
      params,
    )

    const typedRows = (rows as Array<Record<string, unknown>>).map((r) => {
      const expected = Number(r.expected || 0)
      const paid = Number(r.paid || 0)
      const balance = Number(r.balance || 0)
      return {
        teacherId: String(r.teacherId || ""),
        teacherName: String(r.teacherName || ""),
        phone: r.phone ? String(r.phone) : null,
        expected: Math.round(expected * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      }
    })

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
