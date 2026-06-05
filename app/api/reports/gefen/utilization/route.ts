import { requireReportAccess } from "@/lib/reports-auth"
import type { ReportResponse, ReportKpi } from "@/lib/reports-types"
import { withTenantAuth } from "@/lib/tenant-api-auth"

export const GET = withTenantAuth(async (req, session) => {
  const forbidden = await requireReportAccess(req, session, "gefen/utilization")
  if (forbidden) return forbidden

  const kpis: ReportKpi[] = [
    { id: "placeholder", label: "ניצול תקציב גפ\"ן", value: 0, format: "number" },
  ]
  const response: ReportResponse = {
    kpis,
    rows: [],
    pagination: { page: 1, limit: 20, total: 0 },
    notAvailable: true,
    notAvailableReason: "אין נתוני ניצול תקציב זמינים כרגע. מודול גפ\"ן יוגדר בעתיד.",
  }
  return Response.json(response)
})
