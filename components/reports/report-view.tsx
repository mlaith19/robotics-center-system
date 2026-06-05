"use client"

import { useState, useCallback, useEffect } from "react"
import { useLanguage } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, FileText, Printer } from "lucide-react"

export interface ReportViewFilter {
  key: string
  label: string
  type: "date" | "select"
  options?: { value: string; label: string }[]
}

interface ReportViewProps {
  title: string
  apiPath: string
  filters?: ReportViewFilter[]
  /** Optional: fetch options for select filters (e.g. courses, teachers) */
  optionsFetch?: Record<string, () => Promise<{ id: string; name: string }[]>>
  /** Column keys to show in table (order). If not set, first row keys are used. */
  columns?: { key: string; label: string }[]
  /** For teacher role: hide course/teacher filters and scope automatically */
  isTeacher?: boolean
}

interface ReportData {
  kpis: { id: string; label: string; value: number | string; format?: string }[]
  chart?: { labels: string[]; series: { name: string; data: number[] }[] }
  rows: Record<string, unknown>[]
  pagination: { page: number; limit: number; total: number }
  notAvailable?: boolean
  notAvailableReason?: string
}

function formatKpiValue(v: number | string, format?: string): string {
  if (typeof v === "number") {
    if (format === "currency") return `₪${v.toLocaleString("he-IL")}`
    if (format === "percent") return `${v}%`
    return v.toLocaleString("he-IL")
  }
  return String(v)
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function ReportView({ title, apiPath, filters = [], optionsFetch = {}, columns, isTeacher }: ReportViewProps) {
  const { t } = useLanguage()
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [options, setOptions] = useState<Record<string, { id: string; name: string }[]>>({})
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOptions = useCallback(async () => {
    for (const [key, fn] of Object.entries(optionsFetch)) {
      try {
        const list = await fn()
        setOptions((prev) => ({ ...prev, [key]: list }))
      } catch {
        setOptions((prev) => ({ ...prev, [key]: [] }))
      }
    }
  }, [optionsFetch])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      params.set("page", String(page))
      params.set("limit", "20")
      filters.forEach((f) => {
        const v = filterValues[f.key]
        if (v) params.set(f.key, v)
      })
      const res = await fetch(`${apiPath}?${params.toString()}`, { credentials: "include" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err?.error || `errors.loadReport`
        throw new Error(typeof msg === "string" ? msg : "errors.loadReport")
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "errors.loadReport"
      setError(msg.startsWith("errors.") ? t(msg) : msg)
    } finally {
      setLoading(false)
    }
  }, [apiPath, startDate, endDate, page, filterValues, filters, t])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  const colDefs: { key: string; label: string }[] =
    columns?.length
      ? columns
      : data?.rows?.[0]
        ? Object.keys(data.rows[0] as object).filter((k) => {
            const v = (data.rows[0] as Record<string, unknown>)[k]
            return typeof v !== "object" || v === null
          }).map((k) => ({ key: k, label: k }))
        : []

  const exportCsv = useCallback(() => {
    if (!data?.rows?.length) return
    const cols = columns || (data.rows[0] && Object.keys(data.rows[0] as object).filter((k) => typeof (data.rows[0] as Record<string, unknown>)[k] !== "object"))
    const headers = columns ? columns.map((c) => c.label) : (cols as string[])
    const rows = data.rows.map((r) =>
      (cols as string[]).map((k) => {
        const v = (r as Record<string, unknown>)[k]
        if (v == null) return ""
        if (typeof v === "object") return JSON.stringify(v)
        return String(v)
      })
    )
    const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, title, columns])

  const printReport = useCallback(() => {
    if (!data) return
    const printableColumns = colDefs
    const printableRows = data.rows || []
    const reportWindow = window.open("", "_blank")
    if (!reportWindow) return

    const kpisHtml =
      data.kpis?.length > 0
        ? data.kpis
            .map(
              (k) => `
                <div class="kpi">
                  <div class="kpi-label">${escapeHtml(k.label)}</div>
                  <div class="kpi-value">${escapeHtml(formatKpiValue(k.value, k.format))}</div>
                </div>
              `,
            )
            .join("")
        : ""

    const headerCells = printableColumns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")
    const bodyRows =
      printableRows.length > 0
        ? printableRows
            .map((row) => {
              const cells = printableColumns
                .map((c) => {
                  const v = (row as Record<string, unknown>)[c.key]
                  return `<td>${escapeHtml(v != null ? String(v) : "")}</td>`
                })
                .join("")
              return `<tr>${cells}</tr>`
            })
            .join("")
        : `<tr><td colspan="${Math.max(1, printableColumns.length)}">אין נתונים להצגה</td></tr>`

    const periodLabel = `${startDate || "ללא"} - ${endDate || "ללא"}`
    const now = new Date().toLocaleString("he-IL")

    reportWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - הדפסה</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:28px;color:#1f2937;margin:0}
    .wrap{max-width:1100px;margin:0 auto}
    .header{border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:14px}
    .title{font-size:24px;font-weight:700;color:#1e3a8a}
    .meta{margin-top:6px;color:#4b5563;font-size:13px;display:flex;gap:14px;flex-wrap:wrap}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:14px 0}
    .kpi{border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;padding:8px 10px}
    .kpi-label{font-size:12px;color:#1e40af}
    .kpi-value{font-size:20px;font-weight:700;color:#1d4ed8}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th{background:#f3f4f6;border:1px solid #d1d5db;padding:8px;text-align:right}
    td{border:1px solid #e5e7eb;padding:8px;text-align:right;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
    .footer{margin-top:8px;color:#6b7280;font-size:12px}
    @media print{
      body{padding:12mm}
      @page{size:auto;margin:10mm}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="title">${escapeHtml(title)}</div>
      <div class="meta">
        <span><strong>תקופה:</strong> ${escapeHtml(periodLabel)}</span>
        <span><strong>הודפס:</strong> ${escapeHtml(now)}</span>
        <span><strong>רשומות:</strong> ${escapeHtml(data.pagination?.total ?? 0)}</span>
      </div>
    </div>
    ${kpisHtml ? `<div class="kpis">${kpisHtml}</div>` : ""}
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="footer">הדוח הופק מהמערכת</div>
  </div>
</body>
</html>`)
    reportWindow.document.close()
    reportWindow.focus()
    setTimeout(() => reportWindow.print(), 250)
  }, [colDefs, data, endDate, startDate, title])

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-right text-xl font-bold sm:text-2xl">{title}</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button className="w-full gap-2 sm:w-auto" onClick={fetchReport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loading ? "טוען..." : "הצג דוח"}
          </Button>
          {data?.rows?.length ? (
            <>
              <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={printReport}>
                <Printer className="h-4 w-4" />
                הדפסה
              </Button>
              <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                ייצוא CSV
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="px-3 text-right sm:px-6">
          <CardTitle className="text-base sm:text-lg">סינון</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-3 sm:flex-row sm:flex-wrap sm:px-6 sm:items-end">
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2 sm:gap-2">
            <div className="space-y-1.5">
              <Label>מתאריך</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>עד תאריך</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
          </div>
          {filters
            .filter((f) => !isTeacher || (f.key !== "teacherId" && f.key !== "courseId"))
            .map((f) =>
              f.type === "select" && f.options?.length ? (
                <div key={f.key} className="w-full space-y-1.5 sm:w-auto sm:min-w-[12rem]">
                  <Label>{f.label}</Label>
                  <Select value={filterValues[f.key] || ""} onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder={`בחר ${f.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : f.type === "select" && options[f.key] ? (
                <div key={f.key} className="w-full space-y-1.5 sm:w-auto sm:min-w-[12rem]">
                  <Label>{f.label}</Label>
                  <Select value={filterValues[f.key] || ""} onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder={`בחר ${f.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {options[f.key].map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null
            )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="px-3 pt-6 text-destructive sm:px-6">{error}</CardContent>
        </Card>
      )}

      {data?.notAvailable && (
        <Card>
          <CardContent className="px-3 pt-6 text-center text-muted-foreground sm:px-6">
            {data.notAvailableReason || "אין נתונים זמינים עבור דוח זה."}
          </CardContent>
        </Card>
      )}

      {data && !data.notAvailable && data.kpis?.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {data.kpis.map((k) => (
            <Card key={k.id}>
              <CardHeader className="px-3 pb-2 text-right sm:px-6">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <span className="break-words text-xl font-bold sm:text-2xl">{formatKpiValue(k.value, k.format)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && !data.notAvailable && Array.isArray(data.rows) && (
        <>
          <Card>
            <CardHeader className="px-3 text-right sm:px-6">
              <CardTitle className="text-base sm:text-lg">פרטים</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data.pagination.total} רשומות | עמוד {data.pagination.page}
              </p>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {data.rows.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">אין נתונים בתקופה או בסינון שנבחר.</p>
              ) : (
                <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        {Array.isArray(colDefs) && colDefs.map((c) => (
                          <TableHead key={c.key || c} className="whitespace-nowrap text-right">
                            {(c as { label?: string }).label ?? c.key ?? c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row, i) => (
                        <TableRow key={(row.id as string) || i}>
                          {Array.isArray(colDefs) && colDefs.map((col) => {
                            const k = (col as { key: string }).key || (col as string)
                            const v = (row as Record<string, unknown>)[k]
                            return (
                              <TableCell key={k} className="align-top text-right break-words">
                                {v != null ? String(v) : ""}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          {data.pagination.total > data.pagination.limit && (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                הקודם
              </Button>
              <span className="py-2 text-center text-sm">{page}</span>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={page * data.pagination.limit >= data.pagination.total}
                onClick={() => setPage((p) => p + 1)}
              >
                הבא
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
