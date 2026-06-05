import { handleDbError } from "@/lib/db"
import { requireReportAccess } from "@/lib/reports-auth"
import { type ReportResponse, type ReportKpi, parseReportDates, parseReportPagination } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"
import { requireTenant } from "@/lib/tenant/resolve-tenant"
import { computePerStudentDueAndPaid } from "@/lib/student-debt-aggregate"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "finance/debts")
  if (forbidden) return forbidden

  const [tenant, tenantErr] = await requireTenant(req)
  if (tenantErr) return tenantErr
  const db = tenant.db

  const { searchParams } = new URL(req.url)
  parseReportDates(searchParams)
  const { page, limit } = parseReportPagination(searchParams)

  try {
    const offset = (page - 1) * limit

    const duePaid = await computePerStudentDueAndPaid(db, {
      onlyActiveEnrollments: true,
      excludeDiscountCreditPayments: false,
    })

    const debtorIds = [...duePaid.entries()]
      .filter(([, v]) => v.expected - v.paid > 0)
      .map(([id]) => id)

    if (debtorIds.length === 0) {
      const kpis: ReportKpi[] = [
        { id: "studentsWithDebt", label: "תלמידים עם חוב", value: 0, format: "number" },
        { id: "totalDebt", label: 'סה"כ חובות (ש"ח)', value: 0, format: "currency" },
      ]
      const response: ReportResponse = {
        kpis,
        rows: [],
        pagination: { page, limit, total: 0 },
      }
      return Response.json(response)
    }

    const students = await db<{ id: string; name: string; phone: string | null }[]>`
      SELECT id, name, phone
      FROM "Student"
      WHERE id = ANY(${debtorIds}::text[])
    `
    const byId = new Map(students.map((s) => [s.id, s]))

    const filtered = debtorIds
      .map((studentId) => {
        const s = byId.get(studentId)
        const { expected, paid } = duePaid.get(studentId) || { expected: 0, paid: 0 }
        const balance = expected - paid
        return {
          studentId,
          studentName: s?.name ?? studentId,
          phone: s?.phone ?? null,
          expected,
          paid,
          balance,
        }
      })
      .sort((a, b) => b.balance - a.balance)

    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit).map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      phone: r.phone,
      expected: Math.round(r.expected * 100) / 100,
      paid: Math.round(r.paid * 100) / 100,
      balance: Math.round(r.balance * 100) / 100,
    }))

    const totalDebt = filtered.reduce((sum, r) => sum + Math.max(0, r.balance), 0)

    const kpis: ReportKpi[] = [
      { id: "studentsWithDebt", label: "תלמידים עם חוב", value: total, format: "number" },
      { id: "totalDebt", label: 'סה"כ חובות (ש"ח)', value: Math.round(totalDebt * 100) / 100, format: "currency" },
    ]
    const response: ReportResponse = { kpis, rows: paginated, pagination: { page, limit, total } }
    return Response.json(response)
  } catch (e) {
    return handleDbError(e, "GET /api/reports/finance/debts")
  }
})
