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
  { key: "name", label: "שם" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
  { key: "status", label: "סטטוס" },
  { key: "specialty", label: "התמחות" },
  { key: "createdAt", label: "תאריך יצירה" },
]

export default function ReportTeachersPage() {
  return (
    <ReportView
      title="דוח מורים"
      apiPath="/api/reports/teachers"
      filters={filters}
      optionsFetch={optionsFetch}
      columns={columns}
    />
  )
}
