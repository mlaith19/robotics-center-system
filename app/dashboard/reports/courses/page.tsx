"use client"

import { ReportView } from "@/components/reports/report-view"

const optionsFetch = {
  teacherId: () =>
    fetch("/api/teachers", { credentials: "include" })
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? arr.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : [])),
  schoolId: () =>
    fetch("/api/schools", { credentials: "include" })
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? arr.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) : [])),
}

const filters = [
  { key: "teacherId", label: "מורה", type: "select" as const },
  { key: "schoolId", label: "בית ספר", type: "select" as const },
]

const columns = [
  { key: "name", label: "שם הקורס" },
  { key: "category", label: "קטגוריה" },
  { key: "status", label: "סטטוס" },
  { key: "price", label: "מחיר" },
  { key: "enrollmentCount", label: "רישומים" },
  { key: "createdAt", label: "תאריך יצירה" },
]

export default function ReportCoursesPage() {
  return (
    <ReportView
      title="דוח קורסים"
      apiPath="/api/reports/courses"
      filters={filters}
      optionsFetch={optionsFetch}
      columns={columns}
    />
  )
}
