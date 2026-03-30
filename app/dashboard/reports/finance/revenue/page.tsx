"use client"

import { ReportView } from "@/components/reports/report-view"

const optionsFetch = {
  courseId: () =>
    fetch("/api/courses", { credentials: "include" })
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? arr.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : [])),
}

const filters = [{ key: "courseId", label: "קורס", type: "select" as const }]

const columns = [
  { key: "studentName", label: "תלמיד" },
  { key: "amount", label: "סכום" },
  { key: "paymentDate", label: "תאריך" },
  { key: "paymentType", label: "סוג" },
  { key: "description", label: "הערה" },
]

export default function ReportRevenuePage() {
  return (
    <ReportView
      title="דוח הכנסות"
      apiPath="/api/reports/finance/revenue"
      filters={filters}
      optionsFetch={optionsFetch}
      columns={columns}
    />
  )
}
