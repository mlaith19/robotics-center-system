"use client"

import { ReportView } from "@/components/reports/report-view"

const columns = [
  { key: "name", label: "בית ספר" },
  { key: "city", label: "עיר" },
  { key: "status", label: "סטטוס" },
  { key: "courseCount", label: "קורסים" },
  { key: "studentCount", label: "תלמידים" },
]

export default function ReportSchoolsSummaryPage() {
  return (
    <ReportView
      title="סיכום בתי ספר"
      apiPath="/api/reports/schools/summary"
      columns={columns}
    />
  )
}
