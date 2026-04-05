"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { arrayFetcher } from "@/lib/swr-fetcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCourseStatusPresentation } from "@/lib/course-status"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Send, UserPlus, GraduationCap, Eye, Loader2, Link2, Copy, Check, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

type RegistrationType = "student" | "teacher"

const STATUS_INTERESTED = "מתעניין"

interface Student {
  id: string
  name: string
  phone: string
  email: string
  status?: string
  createdAt: string
  courseIds?: string[] | string
  registrationInterest?: string | null
}

interface Teacher {
  id: string
  name: string
  phone: string
  email: string
  status?: string
  createdAt: string
}

const DAYS_HE: Record<string, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
}

function formatCourseDaysList(days?: string[] | null): string {
  if (!days?.length) return "—"
  return days.map((d) => DAYS_HE[d.toLowerCase()] || d).join(", ")
}

function formatCourseTimeRange(start?: string | null, end?: string | null): string {
  const s = start != null ? String(start).trim() : ""
  const e = end != null ? String(end).trim() : ""
  if (s && e) return `${s}–${e}`
  return s || e || "—"
}

interface Course {
  id: string
  name: string
  status?: string | null
  endDate?: string | null
  weekdays?: string[]
  daysOfWeek?: string[]
  startTime?: string | null
  endTime?: string | null
}

export default function RegistrationPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [centerSettings, setCenterSettings] = useState<any>(null)
  const [copiedType, setCopiedType] = useState<RegistrationType | null>(null)
  const [baseUrl, setBaseUrl] = useState("")
  const [approvingId, setApprovingId] = useState<string | null>(null)
  /** תלמיד ללא קורס בקישור – בחירת קורס לפני אישור */
  const [studentApproveCourseId, setStudentApproveCourseId] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    setBaseUrl(typeof window !== "undefined" ? window.location.origin : "")
  }, [])

  const studentRegistrationUrl = baseUrl ? `${baseUrl}/register/student` : "/register/student"
  const teacherRegistrationUrl = baseUrl ? `${baseUrl}/register/teacher` : "/register/teacher"

  const copyLink = async (type: RegistrationType) => {
    const url = type === "student" ? studentRegistrationUrl : teacherRegistrationUrl
    try {
      await navigator.clipboard.writeText(url)
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2000)
      toast({ title: "הועתק", description: "הקישור הועתק ללוח" })
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן להעתיק", variant: "destructive" })
    }
  }

  // Fetch students and teachers from API
  const { data: rawStudents, isLoading: studentsLoading } = useSWR<Student[]>("/api/students", arrayFetcher)
  const { data: rawTeachers, isLoading: teachersLoading } = useSWR<Teacher[]>("/api/teachers", arrayFetcher)
  const { data: rawCourses } = useSWR<Course[]>("/api/courses", arrayFetcher)
  const students = Array.isArray(rawStudents) ? rawStudents : []
  const teachers = Array.isArray(rawTeachers) ? rawTeachers : []
  const courses = Array.isArray(rawCourses) ? rawCourses : []
  const courseMap = new Map(courses.map((c) => [c.id, c.name]))

  const openCoursesForApprove = useMemo(() => {
    return courses.filter((c) => {
      const key = getCourseStatusPresentation({ status: c.status, endDate: c.endDate }).key
      return key !== "completed" && key !== "inactive"
    })
  }, [courses])

  const courseOptionLabel = (c: Course) => {
    const dow = formatCourseDaysList(c.weekdays ?? c.daysOfWeek)
    const times = formatCourseTimeRange(c.startTime, c.endTime)
    return `${c.name} · ${dow} · ${times}`
  }

  const parseCourseIds = (value: Student["courseIds"]): string[] => {
    if (Array.isArray(value)) return value.map((v) => String(v))
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
      } catch {
        return []
      }
    }
    return []
  }

  useEffect(() => {
    // Load center settings from API
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          const data = await res.json()
          setCenterSettings(data)
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err)
      }
    }
    fetchSettings()
  }, [])

  // Only show people in status "מתעניין" (interested) – not yet registered/active or finished
  const registrations = [
    ...students
      .filter((s) => (s.status || "").trim() === STATUS_INTERESTED)
      .map((s) => ({
        id: s.id,
        name: s.name || "",
        type: "student" as RegistrationType,
        phone: s.phone || "",
        email: s.email || "",
        status: STATUS_INTERESTED,
        createdAt: s.createdAt,
        courseId: parseCourseIds(s.courseIds)[0] || null,
        registrationInterest:
          typeof s.registrationInterest === "string" && s.registrationInterest.trim()
            ? s.registrationInterest.trim()
            : null,
      })),
    ...teachers
      .filter((t) => (t.status || "").trim() === STATUS_INTERESTED)
      .map((t) => ({
        id: t.id,
        name: t.name || "",
        type: "teacher" as RegistrationType,
        phone: t.phone || "",
        email: t.email || "",
        status: STATUS_INTERESTED,
        createdAt: t.createdAt,
        courseId: null as string | null,
        registrationInterest: null as string | null,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const sendRegistrationForm = (type: RegistrationType) => {
    let whatsappNumber = centerSettings?.whatsapp || ""

    if (!whatsappNumber) {
      toast({
        title: "שגיאה",
        description: "לא הוגדר מספר WhatsApp בהגדרות המערכת",
        variant: "destructive",
      })
      return
    }

    // Public registration link (no login required)
    const formUrl = type === "student" ? studentRegistrationUrl : teacherRegistrationUrl

    // Clean phone number
    const cleanPhone = whatsappNumber.replace(/[^0-9]/g, "")

    // Message to send
    const message =
      type === "student"
        ? `שלום, נשלח אליך טופס רישום לתלמיד חדש במרכז הרובוטיקה. אנא מלא את הפרטים בקישור הבא: ${formUrl}`
        : `שלום, נשלח אליך טופס רישום למורה חדש במרכז הרובוטיקה. אנא מלא את הפרטים בקישור הבא: ${formUrl}`

    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")

    setDialogOpen(false)

    toast({
      title: "נשלח בהצלחה",
      description: `טופס רישום ל${type === "student" ? "תלמיד" : "מורה"} נשלח ב-WhatsApp`,
    })
  }

  const handleViewDetails = (registration: { id: string; type: RegistrationType }) => {
    if (registration.type === "student") {
      router.push(`/dashboard/students/${registration.id}`)
    } else {
      router.push(`/dashboard/teachers/${registration.id}`)
    }
  }

  const handleApprove = async (registration: { id: string; type: RegistrationType; courseId: string | null; name: string }) => {
    const isStudent = registration.type === "student"
    const courseIdToSend = isStudent
      ? registration.courseId || studentApproveCourseId[registration.id] || null
      : null
    if (isStudent && !courseIdToSend) {
      toast({
        title: "בחר קורס",
        description: "יש לבחור קורס מהרשימה (שם, ימים ושעות) לפני אישור הרישום",
        variant: "destructive",
      })
      return
    }

    setApprovingId(registration.id)
    try {
      const approveUrl = isStudent ? `/api/students/${registration.id}/approve` : `/api/teachers/${registration.id}/approve`
      const res = await fetch(approveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isStudent ? { courseId: courseIdToSend } : {}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "אישור נכשל")
      }
      toast({
        title: "אושר בהצלחה",
        description: isStudent
          ? `${registration.name} אושר ושויך לקורס`
          : `${registration.name} אושר והועבר לדף המורים`,
      })
      window.location.reload()
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err instanceof Error ? err.message : "אישור נכשל",
        variant: "destructive",
      })
    } finally {
      setApprovingId(null)
    }
  }

  if (studentsLoading || teachersLoading) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-3 sm:p-6" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-6" dir="rtl">
      <div className="mb-4 sm:mb-6">
        <Button
          variant="ghost"
          className="mb-2 text-muted-foreground hover:text-foreground"
          onClick={() => window.history.back()}
        >
          ← חזרה
        </Button>
        <h1 className="text-2xl font-bold sm:text-3xl">רישום</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">שלח טפסי רישום לתלמידים ומורים חדשים דרך WhatsApp</p>
      </div>

      <Card className="mb-4 sm:mb-6">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
            <Link2 className="h-5 w-5 shrink-0" />
            קישור לרישום – להעתקה ושליחה
          </CardTitle>
          <CardDescription className="text-pretty">העתק את הקישור ושלח לתלמיד או למורה; בפתיחת הקישור ייפתח דף רישום (ללא התחברות)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[200px]">
              <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                readOnly
                value={studentRegistrationUrl}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              />
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyLink("student")}>
                {copiedType === "student" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[200px]">
              <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                readOnly
                value={teacherRegistrationUrl}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              />
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyLink("teacher")}>
                {copiedType === "teacher" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2 sm:w-auto" variant="outline">
                  <Send className="h-4 w-4" />
                  שליחה ב-WhatsApp
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>שליחת טופס רישום</DialogTitle>
                  <DialogDescription>בחר סוג רישום – יישלח קישור ב-WhatsApp (דורש הגדרת מספר בהגדרות)</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4 sm:gap-4">
                  <Button
                    variant="outline"
                    className="h-auto min-h-[4.5rem] gap-3 py-4 text-base sm:h-20 sm:text-lg bg-transparent"
                    onClick={() => sendRegistrationForm("student")}
                  >
                    <UserPlus className="h-6 w-6 shrink-0" />
                    טופס רישום לתלמיד
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto min-h-[4.5rem] gap-3 py-4 text-base sm:h-20 sm:text-lg bg-transparent"
                    onClick={() => sendRegistrationForm("teacher")}
                  >
                    <GraduationCap className="h-6 w-6 shrink-0" />
                    טופס רישום למורה
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
              <UserPlus className="h-5 w-5 shrink-0" />
              מתעניינים (טרם רשומים/פעילים)
            </CardTitle>
            <CardDescription className="mt-1 text-pretty">
              רק תלמידים ומורים בסטטוס &quot;מתעניין&quot; – לאחר רישום או מעבר לפעיל/לא פעיל הם לא יופיעו כאן
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-3 md:hidden">
            {registrations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                אין מתעניינים כרגע – רק רשומות בסטטוס &quot;מתעניין&quot; מוצגות כאן
              </p>
            ) : (
              registrations.map((registration) => (
                <Card key={`${registration.type}-${registration.id}`} className="p-4">
                  <div className="flex flex-col gap-3 text-right">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 font-medium">{registration.name}</div>
                      <span
                        className={`w-fit shrink-0 rounded-full px-2 py-1 text-xs ${
                          registration.type === "student"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {registration.type === "student" ? "תלמיד" : "מורה"}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="block text-xs opacity-80">טלפון</span>
                        <span className="text-foreground">{registration.phone || "—"}</span>
                      </div>
                      <div className="min-w-0 break-all">
                        <span className="block text-xs opacity-80">אימייל</span>
                        <span className="text-foreground">{registration.email || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-xs opacity-80">קורס</span>
                        {registration.type === "student" ? (
                          registration.courseId ? (
                            <span className="text-foreground">
                              {courseMap.get(registration.courseId) || "קורס לא נמצא"}
                            </span>
                          ) : openCoursesForApprove.length === 0 ? (
                            <span className="text-sm text-amber-700">אין קורסים פתוחים – צור קורס פעיל לפני אישור</span>
                          ) : (
                            <Select
                              dir="rtl"
                              value={studentApproveCourseId[registration.id] || undefined}
                              onValueChange={(v) =>
                                setStudentApproveCourseId((prev) => ({ ...prev, [registration.id]: v }))
                              }
                            >
                              <SelectTrigger size="sm" className="mt-1 h-auto min-h-9 w-full whitespace-normal text-right py-2">
                                <SelectValue placeholder="בחר קורס (שם · ימים · שעות)" />
                              </SelectTrigger>
                              <SelectContent dir="rtl" className="max-h-[min(280px,50dvh)]">
                                {openCoursesForApprove.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="whitespace-normal text-right">
                                    {courseOptionLabel(c)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        ) : (
                          <span className="text-foreground">—</span>
                        )}
                      </div>
                      {registration.type === "student" && (
                        <div className="min-w-0">
                          <span className="block text-xs opacity-80">תחום עניין</span>
                          <span className="text-foreground break-words">
                            {registration.registrationInterest || "—"}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="block text-xs opacity-80">תאריך</span>
                        <span className="text-foreground">
                          {registration.createdAt
                            ? new Date(registration.createdAt).toLocaleDateString("he-IL")
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" className="flex-1 min-w-[7rem]" onClick={() => handleViewDetails(registration)}>
                        <Eye className="h-4 w-4" />
                        צפיה
                      </Button>
                      <Button
                        size="sm"
                        className="min-w-[7rem] flex-1 gap-1"
                        disabled={
                          approvingId === registration.id ||
                          (registration.type === "student" &&
                            !registration.courseId &&
                            (openCoursesForApprove.length === 0 || !studentApproveCourseId[registration.id]))
                        }
                        onClick={() => handleApprove(registration)}
                      >
                        {approvingId === registration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        אישור
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
          <div className="hidden md:block">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">שם קורס</TableHead>
                <TableHead className="text-right">תחום עניין</TableHead>
                <TableHead className="text-right">תאריך רישום</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    אין מתעניינים כרגע – רק רשומות בסטטוס &quot;מתעניין&quot; מוצגות כאן
                  </TableCell>
                </TableRow>
              ) : (
                registrations.map((registration) => (
                  <TableRow key={`${registration.type}-${registration.id}`}>
                    <TableCell className="font-medium">{registration.name}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          registration.type === "student"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {registration.type === "student" ? "תלמיד" : "מורה"}
                      </span>
                    </TableCell>
                    <TableCell>{registration.phone || "-"}</TableCell>
                    <TableCell>{registration.email || "-"}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700">
                        {registration.status}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[220px] max-w-[340px] align-top">
                      {registration.type === "student" ? (
                        registration.courseId ? (
                          <span>{courseMap.get(registration.courseId) || "קורס לא נמצא"}</span>
                        ) : openCoursesForApprove.length === 0 ? (
                          <span className="text-sm text-amber-700">אין קורסים פתוחים</span>
                        ) : (
                          <Select
                            dir="rtl"
                            value={studentApproveCourseId[registration.id] || undefined}
                            onValueChange={(v) =>
                              setStudentApproveCourseId((prev) => ({ ...prev, [registration.id]: v }))
                            }
                          >
                            <SelectTrigger size="sm" className="h-auto min-h-9 w-full max-w-[320px] whitespace-normal text-right py-2">
                              <SelectValue placeholder="בחר קורס" />
                            </SelectTrigger>
                            <SelectContent dir="rtl" className="max-h-[min(320px,50dvh)]">
                              {openCoursesForApprove.map((c) => (
                                <SelectItem key={c.id} value={c.id} className="whitespace-normal text-right">
                                  {courseOptionLabel(c)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] align-top">
                      {registration.type === "student"
                        ? registration.registrationInterest || "—"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {registration.createdAt
                        ? new Date(registration.createdAt).toLocaleDateString("he-IL")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(registration)}>
                          <Eye className="h-4 w-4" />
                          צפיה
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={
                            approvingId === registration.id ||
                            (registration.type === "student" &&
                              !registration.courseId &&
                              (openCoursesForApprove.length === 0 || !studentApproveCourseId[registration.id]))
                          }
                          onClick={() => handleApprove(registration)}
                        >
                          {approvingId === registration.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          אישור
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
