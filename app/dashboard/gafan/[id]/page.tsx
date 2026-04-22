"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, Rocket, Building2, User, DollarSign, BookOpen, Users, TrendingUp, Edit, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { useEffect } from "react"
import { fetcher as apiFetcher } from "@/lib/swr-fetcher"

function parseHourRowsForTotal(raw: unknown): number {
  let input: unknown = raw
  if (typeof input === "string") {
    try {
      input = JSON.parse(input)
    } catch {
      input = []
    }
  }
  if (!Array.isArray(input)) return 0
  return input.reduce((sum, row) => {
    const r = (row ?? {}) as Record<string, unknown>
    const hours = Number(r.totalHours ?? 0)
    return sum + (Number.isFinite(hours) && hours > 0 ? hours : 0)
  }, 0)
}

export default function GafanProgramViewPage() {
  const params = useParams()
  const router = useRouter()
  
  // אם ה-ID הוא "new", נפנה לדף היצירה
  const isNewPage = params.id === "new"
  
  useEffect(() => {
    if (isNewPage) {
      router.replace("/dashboard/gafan/new")
    }
  }, [isNewPage, router])
  
  const { data: program, error, isLoading } = useSWR(
    isNewPage ? null : `/api/gafan/${params.id}`, 
    apiFetcher
  )

  // אם זה דף new, מציג loader בזמן ה-redirect
  if (isNewPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">שגיאה בטעינת הנתונים או שהתוכנית לא נמצאה</p>
        <Link href="/dashboard/gafan">
          <Button className="mt-4">חזרה לרשימה</Button>
        </Link>
      </div>
    )
  }

  const programLinks = Array.isArray(program.links) ? program.links : []
  const schoolsRows = programLinks.map((link: any, idx: number) => {
    const totalHours = parseHourRowsForTotal(link?.hourRows)
    const paid = 0
    const debt = 0
    const balance = 0
    return {
      id: String(link?.linkId || `${idx}`),
      schoolName: String(link?.schoolName || "—"),
      totalHours: Math.round(totalHours * 100) / 100,
      paid,
      debt,
      balance,
    }
  })
  const schoolsSummary = schoolsRows.reduce(
    (acc, row) => ({
      totalHours: acc.totalHours + Number(row.totalHours || 0),
      paid: acc.paid + Number(row.paid || 0),
      debt: acc.debt + Number(row.debt || 0),
      balance: acc.balance + Number(row.balance || 0),
    }),
    { totalHours: 0, paid: 0, debt: 0, balance: 0 },
  )

  return (
    <div dir="rtl" className="min-h-screen">
      <div className="container mx-auto max-w-7xl p-3 sm:p-6">
        <div className="mb-6 sm:mb-8">
          <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
              <Link href="/dashboard/gafan" className="shrink-0">
                <Button variant="ghost" size="icon">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Link href="/dashboard/gafan" className="transition-colors hover:text-foreground">
                    תוכניות גפ"ן
                  </Link>
                  <span>/</span>
                  <span className="break-words text-foreground">{program.name}</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground break-words sm:text-3xl">פרטי תוכנית</h1>
              </div>
            </div>
            <Link href={`/dashboard/gafan/${program.id}/edit`} className="w-full shrink-0 sm:w-auto">
              <Button className="w-full gap-2 sm:w-auto">
                <Edit className="h-4 w-4 shrink-0" />
                ערוך תוכנית
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="general" className="w-full" dir="rtl">
              <div className="border-b overflow-x-auto">
                <TabsList className="flex h-auto w-full min-w-0 flex-wrap justify-start gap-0 rounded-none bg-transparent p-0 sm:flex-nowrap">
                  <TabsTrigger
                    value="general"
                    className="rounded-none px-3 py-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-6 sm:py-4 sm:text-sm"
                  >
                    כללי
                  </TabsTrigger>
                  <TabsTrigger
                    value="courses"
                    className="rounded-none px-3 py-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-6 sm:py-4 sm:text-sm"
                  >
                    קורסים
                  </TabsTrigger>
                  <TabsTrigger
                    value="students"
                    className="rounded-none px-3 py-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-6 sm:py-4 sm:text-sm"
                  >
                    תלמידים
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="rounded-none px-3 py-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-6 sm:py-4 sm:text-sm"
                  >
                    פעילות
                  </TabsTrigger>
                  <TabsTrigger
                    value="schools"
                    className="rounded-none px-3 py-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-6 sm:py-4 sm:text-sm"
                  >
                    בתי ספר
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="space-y-4 p-3 sm:space-y-6 sm:p-6">
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Rocket className="h-8 w-8 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="mb-1 break-words text-xl font-bold text-foreground sm:text-2xl">{program.name}</h2>
                        <p className="text-muted-foreground">מס׳ תוכנית: {program.programNumber}</p>
                      </div>
                      <span
                        className={`shrink-0 self-start rounded-full px-4 py-2 text-sm font-medium sm:self-center ${
                          program.status === "פעיל"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : program.status === "מתעניין"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {program.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Rocket className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold">מידע על התוכנית</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:p-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">תוקף לשנה</p>
                        <p className="font-medium">{program.validYear}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">תאריך יצירה</p>
                        <p className="font-medium">
                          {program.createdAt ? new Date(program.createdAt).toLocaleDateString("he-IL") : "לא זמין"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold">פרטי חברה</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 p-4 sm:p-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">שם חברה</p>
                        <p className="font-medium">{program.companyName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">ח"פ חברה</p>
                        <p className="font-medium">{program.companyId}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-sm text-muted-foreground">כתובת</p>
                        <p className="break-words font-medium">{program.companyAddress}</p>
                      </div>
                    </div>

                    {program.bankName && (
                      <div className="pt-6 border-t space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground">פרטי חשבון בנק</h4>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">בנק</p>
                            <p className="font-medium">{program.bankName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">קוד בנק</p>
                            <p className="font-medium">{program.bankCode || "לא צוין"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">סניף</p>
                            <p className="font-medium">{program.branchNumber || "לא צוין"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">מס׳ חשבון</p>
                            <p className="font-medium">{program.accountNumber || "לא צוין"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold">מפעיל התוכנית</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <p className="break-words font-medium">{program.operatorName}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-orange-600" />
                      </div>
                      <h3 className="text-lg font-semibold">תמחור</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-bold text-primary">₪{program.priceMin || 0}</p>
                      {program.priceMax && (
                        <>
                          <span className="text-muted-foreground">-</span>
                          <p className="text-2xl font-bold text-primary">₪{program.priceMax}</p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {program.notes && (
                  <Card>
                    <CardHeader className="border-b">
                      <h3 className="text-lg font-semibold">הערות</h3>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <p className="whitespace-pre-wrap break-words text-muted-foreground">{program.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="courses" className="p-3 sm:p-6">
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">קורסים משויכים</h3>
                  <p className="text-muted-foreground mb-4">0 קורסים משויכים לתוכנית זו</p>
                </div>
              </TabsContent>

              <TabsContent value="students" className="p-3 sm:p-6">
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">תלמידים משויכים</h3>
                  <p className="text-muted-foreground mb-4">0 תלמידים רשומים לתוכנית זו</p>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="p-3 sm:p-6">
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">פעילות התוכנית</h3>
                  <p className="text-muted-foreground">סטטיסטיקות ומעקב אחר פעילות התוכנית</p>
                </div>
              </TabsContent>

              <TabsContent value="schools" className="space-y-4 p-3 sm:p-6">
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold">בתי ספר משויכים לתוכנית</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:p-6">
                    {schoolsRows.length === 0 ? (
                      <div className="rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground">
                        אין בתי ספר משויכים לתוכנית זו
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full min-w-[720px] text-sm">
                            <thead className="bg-muted/40">
                              <tr>
                                <th className="border px-3 py-2 text-right font-medium">בית ספר</th>
                                <th className="border px-3 py-2 text-center font-medium">כמות שעות</th>
                                <th className="border px-3 py-2 text-center font-medium">שולם</th>
                                <th className="border px-3 py-2 text-center font-medium">חייבים</th>
                                <th className="border px-3 py-2 text-center font-medium">יתרה</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schoolsRows.map((row) => (
                                <tr key={row.id} className="hover:bg-muted/20">
                                  <td className="border px-3 py-2">{row.schoolName}</td>
                                  <td className="border px-3 py-2 text-center tabular-nums">
                                    {row.totalHours.toLocaleString("he-IL")}
                                  </td>
                                  <td className="border px-3 py-2 text-center tabular-nums">
                                    ₪{row.paid.toLocaleString("he-IL")}
                                  </td>
                                  <td className="border px-3 py-2 text-center tabular-nums">
                                    ₪{row.debt.toLocaleString("he-IL")}
                                  </td>
                                  <td className="border px-3 py-2 text-center tabular-nums">
                                    ₪{row.balance.toLocaleString("he-IL")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-muted/30 font-semibold">
                                <td className="border px-3 py-2">סה״כ</td>
                                <td className="border px-3 py-2 text-center tabular-nums">
                                  {Math.round(schoolsSummary.totalHours * 100) / 100}
                                </td>
                                <td className="border px-3 py-2 text-center tabular-nums">
                                  ₪{Math.round(schoolsSummary.paid * 100) / 100}
                                </td>
                                <td className="border px-3 py-2 text-center tabular-nums">
                                  ₪{Math.round(schoolsSummary.debt * 100) / 100}
                                </td>
                                <td className="border px-3 py-2 text-center tabular-nums">
                                  ₪{Math.round(schoolsSummary.balance * 100) / 100}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          חישוב שדות כספיים (שולם/חייבים/יתרה) יוצמד לנוסחה שתוגדר בהמשך.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
