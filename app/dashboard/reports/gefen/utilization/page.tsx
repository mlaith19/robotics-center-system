"use client"

import { ReportView } from "@/components/reports/report-view"

export default function ReportGefenUtilizationPage() {
  return (
    <ReportView
      title='ניצול תקציב גפ"ן'
      apiPath="/api/reports/gefen/utilization"
      filters={[]}
    />
  )
}
