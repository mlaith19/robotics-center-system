"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { arrayFetcher } from "@/lib/swr-fetcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
}

interface Teacher {
  id: string
  name: string
  phone: string
  email: string
  status?: string
  createdAt: string
}

interface Course {
  id: string
  name: string
}

export default function RegistrationPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [centerSettings, setCenterSettings] = useState<any>(null)
  const [copiedType, setCopiedType] = useState<RegistrationType | null>(null)
  const [baseUrl, setBaseUrl] = useState("")
  const [approvingId, setApprovingId] = useState<string | null>(null)
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
    if (registration.type !== "student") return
    if (!registration.courseId) {
      toast({
        title: "לא ניתן לאשר",
        description: "לא נמצא קורס משויך לרישום הזה",
        variant: "destructive",
      })
      return
    }

    setApprovingId(registration.id)
    try {
      const res = await fetch(`/api/students/${registration.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: registration.courseId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "אישור נכשל")
      }
      toast({
        title: "אושר בהצלחה",
        description: `${registration.name} אושר ושויך לקורס`,
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
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-2 text-muted-foreground hover:text-foreground"
          onClick={() => window.history.back()}
        >
          ← חזרה
        </Button>
        <h1 className="text-3xl font-bold">רישום</h1>
        <p className="text-muted-foreground mt-2">שלח טפסי רישום לתלמידים ומורים חדשים דרך WhatsApp</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            קישור לרישום – להעתקה ושליחה
          </CardTitle>
          <CardDescription>העתק את הקישור ושלח לתלמיד או למורה; בפתיחת הקישור ייפתח דף רישום (ללא התחברות)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 flex-1 min-w-[200px]">
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
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 flex-1 min-w-[200px]">
              <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
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
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" variant="outline">
                  <Send className="h-4 w-4" />
                  שליחה ב-WhatsApp
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>שליחת טופס רישום</DialogTitle>
                  <DialogDescription>בחר סוג רישום – יישלח קישור ב-WhatsApp (דורש הגדרת מספר בהגדרות)</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Button
                    variant="outline"
                    className="h-20 gap-3 text-lg bg-transparent"
                    onClick={() => sendRegistrationForm("student")}
                  >
                    <UserPlus className="h-6 w-6" />
                    טופס רישום לתלמיד
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 gap-3 text-lg bg-transparent"
                    onClick={() => sendRegistrationForm("teacher")}
                  >
                    <GraduationCap className="h-6 w-6" />
                    טופס רישום למורה
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                מתעניינים (טרם רשומים/פעילים)
              </CardTitle>
              <CardDescription>רק תלמידים ומורים בסטטוס &quot;מתעניין&quot; – לאחר רישום או מעבר לפעיל/לא פעיל הם לא יופיעו כאן</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">שם קורס</TableHead>
                <TableHead className="text-right">תאריך רישום</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                    <TableCell>
                      {registration.type === "student"
                        ? (registration.courseId ? (courseMap.get(registration.courseId) || "קורס לא נמצא") : "לא נבחר")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {registration.createdAt
                        ? new Date(registration.createdAt).toLocaleDateString("he-IL")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(registration)}>
                          <Eye className="h-4 w-4" />
                          צפיה
                        </Button>
                        {registration.type === "student" && (
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={approvingId === registration.id}
                            onClick={() => handleApprove(registration)}
                          >
                            {approvingId === registration.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            אישור
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
