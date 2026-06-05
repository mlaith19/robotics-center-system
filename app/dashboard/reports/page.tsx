"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Users, GraduationCap, BookOpen, Wallet, School, Rocket, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/page-header"

const reportCategories = [
  {
    title: "תפעול",
    items: [
      { href: "/dashboard/reports/students", label: "דוח תלמידים", icon: Users, description: "תלמידים לפי תאריך וקורס" },
      { href: "/dashboard/reports/teachers", label: "דוח מורים", icon: GraduationCap, description: "מורים לפי תאריך וקורס" },
      { href: "/dashboard/reports/courses", label: "דוח קורסים", icon: BookOpen, description: "קורסים, רישומים ובתי ספר" },
    ],
  },
  {
    title: "כספים",
    items: [
      { href: "/dashboard/reports/finance/revenue", label: "הכנסות", icon: TrendingUp, description: "תשלומים והכנסות לפי תקופה" },
      { href: "/dashboard/reports/finance/debts", label: "חובות תלמידים", icon: Wallet, description: "תלמידים עם יתרת חוב" },
      { href: "/dashboard/reports/finance/teacher-debts", label: "חובות מורים", icon: Wallet, description: "מורים עם יתרת חוב לתשלום" },
    ],
  },
  {
    title: "בתי ספר",
    items: [
      { href: "/dashboard/reports/schools/summary", label: "סיכום בתי ספר", icon: School, description: "סיכום קורסים ותלמידים לפי בית ספר" },
    ],
  },
  {
    title: 'גפ"ן',
    items: [
      { href: "/dashboard/reports/gefen/utilization", label: "ניצול תקציב", icon: Rocket, description: "ניצול תקציב גפ\"ן (בהגדרה)" },
    ],
  },
]

export default function ReportsPage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-3 sm:space-y-8 sm:p-6" dir="rtl">
      <PageHeader title="דוחות" description="הפקת דוחות תפעול, כספים וסיכומים" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {reportCategories.map((cat) => (
          <Card key={cat.title}>
            <CardHeader className="px-3 sm:px-6">
              <CardTitle className="text-base sm:text-lg">{cat.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 sm:px-6">
              {cat.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 text-right">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground sm:mt-0" aria-hidden />
                    </div>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
