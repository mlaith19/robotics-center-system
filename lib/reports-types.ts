/** Shared report API response shape (future-proof for tenant/plan gating). */
export interface ReportKpi {
  id: string
  label: string
  value: number | string
  format?: "number" | "currency" | "percent"
}

export interface ReportChart {
  labels: string[]
  series: { name: string; data: number[] }[]
}

export interface ReportPagination {
  page: number
  limit: number
  total: number
}

export interface ReportResponse<T = Record<string, unknown>> {
  kpis: ReportKpi[]
  chart?: ReportChart
  rows: T[]
  pagination: ReportPagination
  /** When module has no data or is not enabled */
  notAvailable?: boolean
  notAvailableReason?: string
}

export function parseReportDates(searchParams: URLSearchParams): { startDate: string | null; endDate: string | null } {
  const startDate = searchParams.get("startDate")?.trim() || null
  const endDate = searchParams.get("endDate")?.trim() || null
  return { startDate, endDate }
}

export function parseReportPagination(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20))
  return { page, limit }
}
