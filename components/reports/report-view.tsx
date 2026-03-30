"use client"

import { useState, useCallback, useEffect } from "react"
import { useLanguage } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, FileText } from "lucide-react"

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

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex gap-2">
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loading ? "טוען..." : "הצג דוח"}
          </Button>
          {data?.rows?.length ? (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              ייצוא CSV
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">סינון</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex gap-2 items-end">
            <div>
              <Label>מתאריך</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label>עד תאריך</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
            </div>
          </div>
          {filters
            .filter((f) => !isTeacher || (f.key !== "teacherId" && f.key !== "courseId"))
            .map((f) =>
              f.type === "select" && f.options?.length ? (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Select value={filterValues[f.key] || ""} onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}>
                    <SelectTrigger className="w-48">
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
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Select value={filterValues[f.key] || ""} onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}>
                    <SelectTrigger className="w-48">
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
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {data?.notAvailable && (
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-center">
            {data.notAvailableReason || "אין נתונים זמינים עבור דוח זה."}
          </CardContent>
        </Card>
      )}

      {data && !data.notAvailable && data.kpis?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.kpis.map((k) => (
            <Card key={k.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{formatKpiValue(k.value, k.format)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && !data.notAvailable && Array.isArray(data.rows) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">פרטים</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data.pagination.total} רשומות | עמוד {data.pagination.page}
              </p>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">אין נתונים בתקופה או בסינון שנבחר.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Array.isArray(colDefs) && colDefs.map((c) => (
                          <TableHead key={c.key || c}>{(c as { label?: string }).label ?? c.key ?? c}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row, i) => (
                        <TableRow key={(row.id as string) || i}>
                          {Array.isArray(colDefs) && colDefs.map((col) => {
                            const k = (col as { key: string }).key || (col as string)
                            const v = (row as Record<string, unknown>)[k]
                            return <TableCell key={k}>{v != null ? String(v) : ""}</TableCell>
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
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>הקודם</Button>
              <span className="py-2">{page}</span>
              <Button variant="outline" disabled={page * data.pagination.limit >= data.pagination.total} onClick={() => setPage((p) => p + 1)}>הבא</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
