"use client"

import { ReportView } from "@/components/reports/report-view"

const optionsFetch = {
  courseId: () =>
    fetch("/api/courses", { credentials: "include" })
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? arr.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : [])),
  teacherId: () =>
    fetch("/api/teachers", { credentials: "include" })
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? arr.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : [])),
}

const filters = [
  { key: "courseId", label: "קורס", type: "select" as const },
  { key: "teacherId", label: "מורה", type: "select" as const },
]

const columns = [
  { key: "name", label: "שם" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
  { key: "status", label: "סטטוס" },
  { key: "createdAt", label: "תאריך יצירה" },
]

export default function ReportStudentsPage() {
  return (
    <ReportView
      title="דוח תלמידים"
      apiPath="/api/reports/students"
      filters={filters}
      optionsFetch={optionsFetch}
      columns={columns}
    />
  )
}
