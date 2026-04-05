"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import NewSchoolPage from "../new/page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowRight,
  Pencil,
  Mail,
  Phone,
  MapPin,
  User2,
  Loader2,
  Users,
  CreditCard,
  BookOpen,
  Rocket,
  CalendarCheck,
  BarChart3,
  DollarSign,
} from "lucide-react"

interface School {
  id: string
  name: string
  city: string | null
  address: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  status: string | null
  institutionCode: string | null
  schoolType: string | null
  schoolPhone: string | null
  contactPhone: string | null
  bankName: string | null
  bankCode: string | null
  bankBranch: string | null
  bankAccount: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type GafanRow = {
  id: string
  name: string
  programNumber?: string | null
  validYear?: string | null
  status?: string | null
}

type CourseRow = {
  id: string
  name: string
  status?: string | null
  enrollmentCount?: number
}

type EnrollmentRow = {
  id: string
  studentId: string
  studentName?: string | null
  courseId: string
  courseName?: string | null
  coursePrice?: number | string | null
}

type PaymentRow = {
  id: string
  studentId: string | null
  studentName?: string | null
  amount: number | string
  paymentDate: string
  paymentType?: string | null
  description?: string | null
}

type TeacherAttRow = {
  id: string
  date: string
  courseName?: string | null
  teacherName?: string | null
  status?: string | null
  hours?: number | string | null
}

function safe(v: unknown) {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

const statusLabels: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  interested: "מתעניין",
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-red-100 text-red-800",
  interested: "bg-yellow-100 text-yellow-800",
}

const schoolTypeLabels: Record<string, string> = {
  elementary: "יסודי",
  middle: "חטיבת ביניים",
  high: "תיכון",
  comprehensive: "מקיף",
  religious: "דתי",
  other: "אחר",
}

function paymentTypeLabelHe(type: string | null | undefined) {
  const t = (type || "").toLowerCase()
  if (t === "cash") return "מזומן"
  if (t === "credit") return "אשראי"
  if (t === "transfer") return "העברה"
  if (t === "check") return "שיק"
  if (t === "bit") return "ביט"
  return "—"
}

export default function SchoolViewPage() {
  const params = useParams()
  const id = params.id as string
  const isNewPage = id === "new"
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)

  const [gafanPrograms, setGafanPrograms] = useState<GafanRow[]>([])
  const [schoolCourses, setSchoolCourses] = useState<CourseRow[]>([])
  const [schoolEnrollments, setSchoolEnrollments] = useState<EnrollmentRow[]>([])
  const [schoolPayments, setSchoolPayments] = useState<PaymentRow[]>([])
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttRow[]>([])
  const [tabDataLoading, setTabDataLoading] = useState(true)

  useEffect(() => {
    if (isNewPage) return

    const fetchSchool = async () => {
      try {
        const res = await fetch(`/api/schools/${id}`)
        if (res.ok) {
          const data = await res.json()
          setSchool(data)
        }
      } catch (err) {
        console.error("Failed to fetch school:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSchool()
  }, [id, isNewPage])

  useEffect(() => {
    if (isNewPage || !school?.id) return
    let cancelled = false
    setTabDataLoading(true)
    const sid = school.id
    ;(async () => {
      try {
        const [gRes, cRes, eRes, pRes, aRes] = await Promise.all([
          fetch(`/api/gafan?schoolId=${encodeURIComponent(sid)}`),
          fetch(`/api/courses?schoolId=${encodeURIComponent(sid)}`),
          fetch(`/api/enrollments?schoolId=${encodeURIComponent(sid)}`),
          fetch(`/api/payments?schoolId=${encodeURIComponent(sid)}`),
          fetch(`/api/attendance?schoolId=${encodeURIComponent(sid)}`),
        ])
        if (cancelled) return
        setGafanPrograms(gRes.ok ? await gRes.json() : [])
        setSchoolCourses(cRes.ok ? await cRes.json() : [])
        setSchoolEnrollments(eRes.ok ? await eRes.json() : [])
        setSchoolPayments(pRes.ok ? await pRes.json() : [])
        const att = aRes.ok ? await aRes.json() : []
        setTeacherAttendance(Array.isArray(att) ? att : [])
      } catch {
        if (!cancelled) {
          setGafanPrograms([])
          setSchoolCourses([])
          setSchoolEnrollments([])
          setSchoolPayments([])
          setTeacherAttendance([])
        }
      } finally {
        if (!cancelled) setTabDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isNewPage, school?.id])

  const debtByStudent = useMemo(() => {
    const paidByStudent = new Map<string, number>()
    for (const p of schoolPayments) {
      const sid = p.studentId ? String(p.studentId) : ""
      if (!sid) continue
      paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + Number(p.amount || 0))
    }
    const dueByStudent = new Map<string, { name: string; totalDue: number }>()
    for (const e of schoolEnrollments) {
      const sid = String(e.studentId)
      const price = Number(e.coursePrice ?? 0)
      const prev = dueByStudent.get(sid)
      const name = e.studentName || "—"
      if (prev) dueByStudent.set(sid, { name: prev.name || name, totalDue: prev.totalDue + price })
      else dueByStudent.set(sid, { name, totalDue: price })
    }
    const rows: { studentId: string; studentName: string; totalDue: number; paid: number; balance: number }[] = []
    for (const [studentId, { name, totalDue }] of dueByStudent) {
      const paid = paidByStudent.get(studentId) || 0
      const balance = Math.max(0, totalDue - paid)
      if (balance > 0.009) rows.push({ studentId, studentName: name, totalDue, paid, balance })
    }
    rows.sort((a, b) => a.studentName.localeCompare(b.studentName, "he", { sensitivity: "base" }))
    return { rows, totalDebt: rows.reduce((s, r) => s + r.balance, 0) }
  }, [schoolEnrollments, schoolPayments])

  if (isNewPage) {
    return <NewSchoolPage />
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!school) {
    return <div className="p-6 text-center">לא נמצא בית ספר</div>
  }

  const status = school.status || "active"

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <Link href="/dashboard/schools" className="shrink-0">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words sm:text-3xl">פרטי בית ספר</h1>
            <p className="mt-1 break-words text-muted-foreground">בתי ספר &gt; {school.name}</p>
          </div>
        </div>

        <Link href={`/dashboard/schools/${school.id}/edit`} className="w-full shrink-0 sm:w-auto">
          <Button className="w-full gap-2 sm:w-auto">
            <Pencil className="h-4 w-4 shrink-0" />
            ערוך פרטים
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <Tabs defaultValue="general" dir="rtl">
          <div className="overflow-x-auto border-b bg-muted/30">
            <TabsList className="inline-flex h-auto min-h-10 w-max min-w-full flex-wrap justify-start gap-0 rounded-none bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-5">
              <TabsTrigger
                value="general"
                className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
              >
                כללי
              </TabsTrigger>
              <TabsTrigger
                value="gafan"
                className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
              >
                תוכניות גפ&quot;ן
              </TabsTrigger>
              <TabsTrigger
                value="teacher-attendance"
                className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
              >
                נוכחות מורים
              </TabsTrigger>
              <TabsTrigger
                value="debtors"
                className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
              >
                חייבים
              </TabsTrigger>
              <TabsTrigger
                value="payments"
                className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
              >
                תשלומים
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="space-y-4 p-3 sm:space-y-6 sm:p-6">
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                <Users className="h-10 w-10 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold break-words sm:text-2xl">{school.name}</h2>
              <Badge className={`mt-2 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
                {statusLabels[status] || status}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border bg-slate-50/50 p-4">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-sm text-muted-foreground">כתובת</div>
                  <div className="break-words font-medium">
                    {safe(school.address)}
                    {school.city ? `, ${school.city}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-slate-50/50 p-4">
                <Phone className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                <div className="flex-1 text-right">
                  <div className="text-sm text-muted-foreground">טלפון</div>
                  <div className="font-medium">{safe(school.schoolPhone || school.phone)}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-slate-50/50 p-4">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                <div className="flex-1 text-right">
                  <div className="text-sm text-muted-foreground">אימייל</div>
                  <div className="font-medium">{safe(school.email)}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-slate-50/50 p-4">
                <User2 className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                <div className="flex-1 text-right">
                  <div className="text-sm text-muted-foreground">איש קשר</div>
                  <div className="font-medium">{safe(school.contactPerson)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50/50 p-4">
              <div className="text-right text-sm text-muted-foreground">סוג בית הספר</div>
              <div className="text-right font-medium">
                {schoolTypeLabels[school.schoolType || ""] || safe(school.schoolType)}
              </div>
            </div>

            {school.institutionCode && (
              <div className="rounded-lg border bg-slate-50/50 p-4">
                <div className="text-right text-sm text-muted-foreground">קוד מוסד</div>
                <div className="text-right font-medium">{school.institutionCode}</div>
              </div>
            )}

            {(school.bankName || school.bankAccount) && (
              <div className="space-y-3 rounded-lg border bg-orange-50/50 p-4">
                <div className="flex items-center gap-2 text-right">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  <span className="font-semibold">פרטי חשבון בנק</span>
                </div>
                <div className="grid gap-4 text-right sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-sm text-muted-foreground">בנק</div>
                    <div className="font-medium">{safe(school.bankName)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">קוד בנק</div>
                    <div className="font-medium">{safe(school.bankCode)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">סניף</div>
                    <div className="font-medium">{safe(school.bankBranch)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">מספר חשבון</div>
                    <div className="font-medium">{safe(school.bankAccount)}</div>
                  </div>
                </div>
              </div>
            )}

            {school.notes && (
              <div className="rounded-lg border bg-pink-50/50 p-4">
                <div className="text-right text-sm text-muted-foreground">הערות</div>
                <div className="whitespace-pre-wrap text-right font-medium">{school.notes}</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="gafan" className="space-y-6 p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-rose-600" />
                    <h3 className="text-lg font-semibold">תוכניות גפ&quot;ן משויכות</h3>
                  </div>
                  {gafanPrograms.length === 0 ? (
                    <p className="py-6 text-center text-muted-foreground">אין תוכניות גפ&quot;ן משויכות לבית ספר זה</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right">שם</TableHead>
                            <TableHead className="text-right">מס&apos; תוכנית</TableHead>
                            <TableHead className="text-right">שנת תוקף</TableHead>
                            <TableHead className="text-right">סטטוס</TableHead>
                            <TableHead className="w-24 text-center">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gafanPrograms.map((g) => (
                            <TableRow key={g.id}>
                              <TableCell className="font-medium">{g.name}</TableCell>
                              <TableCell>{safe(g.programNumber)}</TableCell>
                              <TableCell>{safe(g.validYear)}</TableCell>
                              <TableCell>{safe(g.status)}</TableCell>
                              <TableCell className="text-center">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/dashboard/gafan/${g.id}`}>צפה</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">קורסים עם שיוך לבית הספר</h3>
                  </div>
                  {schoolCourses.length === 0 ? (
                    <p className="py-6 text-center text-muted-foreground">אין קורסים משויכים לבית ספר זה</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right">שם קורס</TableHead>
                            <TableHead className="text-right">סטטוס</TableHead>
                            <TableHead className="text-center">נרשמים</TableHead>
                            <TableHead className="w-24 text-center">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schoolCourses.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell>{safe(c.status)}</TableCell>
                              <TableCell className="text-center tabular-nums">
                                {Number(c.enrollmentCount ?? 0)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/dashboard/courses/${c.id}`}>צפה</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="teacher-attendance" className="p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : teacherAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <CalendarCheck className="mb-4 h-12 w-12 opacity-50" />
                <p>אין רשומות נוכחות מורים בקורסים של בית ספר זה</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">קורס</TableHead>
                      <TableHead className="text-right">מורה</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-center">שעות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherAttendance.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-right">
                          {row.date ? new Date(row.date).toLocaleDateString("he-IL") : "—"}
                        </TableCell>
                        <TableCell className="text-right">{safe(row.courseName)}</TableCell>
                        <TableCell className="text-right">{safe(row.teacherName)}</TableCell>
                        <TableCell className="text-right">{safe(row.status)}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.hours != null && row.hours !== "" ? String(row.hours) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="debtors" className="p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-rose-100 p-2">
                        <BarChart3 className="h-5 w-5 text-rose-600" />
                      </div>
                      <CardTitle className="text-lg text-rose-800">חייבים לפי תלמיד</CardTitle>
                    </div>
                    <Badge className="bg-gradient-to-r from-rose-600 to-red-600 text-white">
                      סה&quot;כ חוב: ₪{debtByStudent.totalDebt.toLocaleString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    סכומי חוב מחושבים לפי מחירי קורסים של בית הספר מול תשלומים שבוצעו (לפי תלמיד).
                  </p>
                  {debtByStudent.rows.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">אין חייבים להצגה</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right">תלמיד</TableHead>
                            <TableHead className="text-right">סה&quot;כ לתשלום</TableHead>
                            <TableHead className="text-right">שולם</TableHead>
                            <TableHead className="text-right">יתרה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtByStudent.rows.map((r) => (
                            <TableRow key={r.studentId}>
                              <TableCell className="font-medium">{r.studentName}</TableCell>
                              <TableCell>₪{r.totalDue.toLocaleString()}</TableCell>
                              <TableCell className="text-green-700">₪{r.paid.toLocaleString()}</TableCell>
                              <TableCell className="font-semibold text-rose-700">
                                ₪{r.balance.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : schoolPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <DollarSign className="mb-4 h-12 w-12 opacity-50" />
                <p>אין תשלומים מתלמידים בקורסים של בית ספר זה</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">תלמיד</TableHead>
                      <TableHead className="text-right">שיטה</TableHead>
                      <TableHead className="text-right">סכום</TableHead>
                      <TableHead className="text-right">הערה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schoolPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {p.paymentDate
                            ? new Date(p.paymentDate).toLocaleDateString("he-IL")
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{safe(p.studentName)}</TableCell>
                        <TableCell>{paymentTypeLabelHe(p.paymentType)}</TableCell>
                        <TableCell className="tabular-nums">₪{Number(p.amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {safe(p.description)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
