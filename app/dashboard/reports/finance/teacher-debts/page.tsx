"use client"

import { ReportView } from "@/components/reports/report-view"

const columns = [
  { key: "teacherName", label: "מורה" },
  { key: "phone", label: "טלפון" },
  { key: "expected", label: "צפוי (ש\"ח)" },
  { key: "paid", label: "שולם (ש\"ח)" },
  { key: "balance", label: "יתרה (חוב)" },
]

export default function ReportTeacherDebtsPage() {
  return (
    <ReportView
      title="דוח חובות מורים"
      apiPath="/api/reports/finance/teacher-debts"
      columns={columns}
    />
  )
}
