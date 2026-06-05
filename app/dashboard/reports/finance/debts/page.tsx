"use client"

import { ReportView } from "@/components/reports/report-view"

const columns = [
  { key: "studentName", label: "תלמיד" },
  { key: "phone", label: "טלפון" },
  { key: "expected", label: "צפוי (ש\"ח)" },
  { key: "paid", label: "שולם (ש\"ח)" },
  { key: "balance", label: "יתרה (חוב)" },
]

export default function ReportDebtsPage() {
  return (
    <ReportView
      title="דוח חובות"
      apiPath="/api/reports/finance/debts"
      columns={columns}
    />
  )
}
