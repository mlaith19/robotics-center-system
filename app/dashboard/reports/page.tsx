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
      { href: "/dashboard/reports/finance/debts", label: "חובות", icon: Wallet, description: "תלמידים עם יתרת חוב" },
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
    <div className="space-y-8" dir="rtl">
      <PageHeader title="דוחות" description="הפקת דוחות תפעול, כספים וסיכומים" />

      <div className="grid gap-6 md:grid-cols-2">
        {reportCategories.map((cat) => (
          <Card key={cat.title}>
            <CardHeader>
              <CardTitle className="text-lg">{cat.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cat.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground mr-auto" />
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
