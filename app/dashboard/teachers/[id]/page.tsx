"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, Mail, Phone, User, Edit, BookOpen, Receipt, CalendarCheck, Plus, Loader2 } from "lucide-react"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { courseTimeToDisplayValue } from "@/lib/course-db-fields"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Teacher = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  idNumber?: string | null
  birthDate?: string | null
  city?: string | null
  specialty?: string | null
  status?: string | null
  bio?: string | null
  centerHourlyRate?: number | null
  travelRate?: number | null
  externalCourseRate?: number | null
  createdAt?: string
  updatedAt?: string
  teacherCourses?: { 
    course: { 
      id: string
      name: string
      daysOfWeek?: string[]
      startTime?: string
      endTime?: string
      startDate?: string
      endDate?: string
      price?: number
      status?: string
      location?: string
      enrollmentCount?: number
    } 
  }[]
  payments?: {
    id: string
    date: string
    amount: number
    status: string
    method?: string | null
    note?: string | null
  }[]
  attendance?: {
    id: string
    date: string
    status: string
    hours: number
    note?: string | null
    course?: { id: string; name: string } | null
  }[]
}

function fmtDate(d?: string) {
  if (!d) return "-"
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return "-"
  return new Intl.DateTimeFormat("he-IL").format(dt)
}

function fmtTimeRange(start?: string, end?: string) {
  const s = courseTimeToDisplayValue(start)
  const e = courseTimeToDisplayValue(end)
  if (!s || !e) return "-"
  return `${s}-${e}`
}

function parseClockToHours(raw?: string | null): number | null {
  const hhmm = courseTimeToDisplayValue(raw ?? undefined)
  if (!hhmm) return null
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  return h + min / 60
}

function calcAttendanceHours(a: any): number {
  if (a?.hours != null && a?.hours !== "") {
    const explicit = Number(a.hours)
    if (Number.isFinite(explicit) && explicit > 0) return explicit
  }
  const startHours = parseClockToHours(a?.courseStartTime)
  const endHours = parseClockToHours(a?.courseEndTime)
  if (startHours != null && endHours != null) {
    const delta = endHours - startHours
    if (Number.isFinite(delta) && delta > 0) return delta
  }
  // We intentionally do not use courseDuration fallback here.
  // In this system duration is often "number of sessions" and not hours/minutes.
  return 0
}

export default function TeacherViewPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const isCreateRoute = id === "create" || id === "new" // Declare isCreateRoute variable
  
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(!isCreateRoute) // Don't show loading for create route
  const [error, setError] = useState<string | null>(null)
  const [teacherExpenses, setTeacherExpenses] = useState<any[]>([])
  const [teacherAttendance, setTeacherAttendance] = useState<any[]>([])
  const [selectedAttendanceCourse, setSelectedAttendanceCourse] = useState<string>("all")
  const [payments, setPayments] = useState<any[]>([]) // Declare payments variable
  const [isTeacherUser, setIsTeacherUser] = useState(false)

  // Redirect to new page if id is "create" or "new"
  useEffect(() => {
    if (isCreateRoute && typeof window !== 'undefined') {
      window.location.replace("/dashboard/teachers/new")
    }
  }, [isCreateRoute])

  // Check if user is linked to this teacher (viewing own profile)
  const currentUser = useCurrentUser()
  useEffect(() => {
    if (!currentUser?.id) return
    fetch(`/api/teachers/by-user/${currentUser.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setIsTeacherUser(true) })
      .catch(() => {})
  }, [currentUser?.id])
  
  // Period filter for payments tab (default: current month)
  const [paymentsPeriod, setPaymentsPeriod] = useState<"month" | "3months" | "6months" | "year">("month")

  // Payment dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit" | "transfer" | "check" | "bit">("cash")
  const [paymentDescription, setPaymentDescription] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [cardLastDigits, setCardLastDigits] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankBranch, setBankBranch] = useState("")
  const [accountNumber, setAccountNumber] = useState("")

  const roleKey = (currentUser?.roleKey || currentUser?.role)?.toString().toLowerCase()
  const isAdmin =
    hasFullAccessRole(currentUser?.roleKey) ||
    hasFullAccessRole(currentUser?.role) ||
    roleKey === "admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "אדמין" ||
    currentUser?.role === "מנהל"
  const userPerms = currentUser?.permissions || []
  /** מחיר קורס / נתונים כספיים של קורס — כמו בדף הקורסים; מורה בלי הרשאה לא רואה בפופאפ */
  const canSeeCourseFinancial = isAdmin || hasPermission(userPerms, "courses.financial")
  // בפרופיל שלי (מורה צופה בעצמו) – הרשאות מהכרטסת "הפרופיל שלי"; אחרת – מכרטסת מורים
  const canTabGeneral = isAdmin || (isTeacherUser ? hasPermission(userPerms, "myProfile.tab.general") : hasPermission(userPerms, "teachers.tab.general"))
  const canTabCourses = isAdmin || (isTeacherUser ? hasPermission(userPerms, "myProfile.tab.courses") : hasPermission(userPerms, "teachers.tab.courses"))
  const canTabPayments = isAdmin || (isTeacherUser ? hasPermission(userPerms, "myProfile.tab.payments") : hasPermission(userPerms, "teachers.tab.payments"))
  const canTabAttendance = isAdmin || (isTeacherUser ? hasPermission(userPerms, "myProfile.tab.attendance") : hasPermission(userPerms, "teachers.tab.attendance"))

  const israeliBanks = [
    "בנק לאומי",
    "בנק הפועלים",
    "בנק דיסקונט",
    "בנק מזרחי טפחות",
    "בנק מרכנתיל",
    "בנק הבינלאומי הראשון",
    "בנק אוצר החייל",
    "בנק יהב",
    "בנק ירושלים",
    "בנק מסד",
    "בנק הדואר",
    "וואן זירו (ONE ZERO)",
  ]

  // Course dialog state
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false)

  // Attendance dialog state
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0])
  const [attendanceHours, setAttendanceHours] = useState("")
  const [attendanceStatus, setAttendanceStatus] = useState<"נוכח" | "חיסור" | "איחור">("נוכח")
  const [attendanceCourseId, setAttendanceCourseId] = useState("")
  const [attendanceNote, setAttendanceNote] = useState("")
  const [isAddingAttendance, setIsAddingAttendance] = useState(false) // Declare isAddingAttendance variable

  const openCourseDialog = (course) => {
    setSelectedCourse(course)
    setIsCourseDialogOpen(true)
  }

  const daysMap: Record<string, string> = {
    sunday: "ראשון",
    monday: "שני",
    tuesday: "שלישי",
    wednesday: "רביעי",
    thursday: "חמישי",
    friday: "שישי",
    saturday: "שבת"
  }

  const formatDays = (days?: string[]) => {
    if (!days || days.length === 0) return "-"
    return days.map(d => daysMap[d.toLowerCase()] || d).join(", ")
  }

  useEffect(() => {
    if (!id || id === "create") return
    
    let cancelled = false

    const loadTeacher = async () => {
      try {
        setLoading(true)
        setError(null)

        const teacherRes = await fetch(`/api/teachers/${id}?include=1`, { cache: "no-store" })
        
        if (teacherRes.status === 429) {
          throw new Error("יותר מדי בקשות, אנא המתן מספר שניות ונסה שוב")
        }
        if (!teacherRes.ok) throw new Error(`Failed to load teacher (${teacherRes.status})`)

        const data = (await teacherRes.json()) as Teacher | null
        
        if (!cancelled) {
          setTeacher(data)
          setPayments(data?.payments ?? [])
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "שגיאה בטעינת מורה")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTeacher()

    return () => {
      cancelled = true
    }
  }, [id])
  
  // Fetch expenses and attendance separately (after main data loads)
  useEffect(() => {
    if (!id || id === "create" || loading || !teacher) return
    
    // Fetch expenses
    fetch(`/api/expenses?teacherId=${id}`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : [])
      .then(data => setTeacherExpenses(Array.isArray(data) ? data : []))
      .catch(() => {})
    
    // Fetch attendance with delay
    setTimeout(() => {
      fetch(`/api/attendance?teacherId=${id}`, { cache: "no-store" })
        .then(res => res.ok ? res.json() : [])
        .then(data => setTeacherAttendance(Array.isArray(data) ? data : []))
        .catch(() => {})
    }, 500)
  }, [id, loading, teacher])

  // Teacher payments are expenses for the center (paying the teacher for their work)
  const handleAddPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return
    if (paymentMethod === "credit" && cardLastDigits.length !== 4) return
    if ((paymentMethod === "transfer" || paymentMethod === "check") && (!bankName || !bankBranch || !accountNumber)) return

    setIsAddingPayment(true)
    try {
      // Save as expense since paying a teacher is an expense for the center
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          date: paymentDate,
          paymentMethod,
          description: paymentDescription || `תשלום למורה ${teacher?.name}`,
          category: "משכורת מורה",
          teacherId: id,
        }),
      })

      if (res.ok) {
        // Reset form and close dialog
        setPaymentAmount("")
        setPaymentMethod("cash")
        setPaymentDescription("")
        setPaymentDate(new Date().toISOString().split("T")[0])
        setCardLastDigits("")
        setBankName("")
        setBankBranch("")
        setAccountNumber("")
        setIsPaymentDialogOpen(false)
        // Refresh page to get updated data
        window.location.reload()
      }
    } catch (err) {
      console.error("Failed to add expense:", err)
    } finally {
      setIsAddingPayment(false)
    }
  }

  const courses = useMemo(() => teacher?.teacherCourses?.map((x) => x.course) ?? [], [teacher])
  // Use teacherAttendance from API instead of teacher?.attendance
  const attendance = teacherAttendance
  
  // Get unique courses from attendance records for the filter dropdown
  const attendanceCourses = useMemo(() => {
    const uniqueCourses = new Map<string, string>()
    teacherAttendance.forEach((a: any) => {
      if (a.courseId && a.courseName) {
        uniqueCourses.set(a.courseId, a.courseName)
      }
    })
    return Array.from(uniqueCourses, ([id, name]) => ({ id, name }))
  }, [teacherAttendance])
  
  // Filter attendance by selected course
  const filteredAttendance = useMemo(() => {
    if (selectedAttendanceCourse === "all") return attendance
    return attendance.filter((a: any) => a.courseId === selectedAttendanceCourse)
  }, [attendance, selectedAttendanceCourse])
  
  // Helper to translate status to Hebrew
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      "present": "נוכח",
      "absent": "חיסור",
      "late": "איחור",
      "נוכח": "נוכח",
      "חיסור": "חיסור",
      "לא נוכח": "חיסור",
      "איחור": "איחור",
      "חולה": "חולה",
      "חופש": "חופש",
    }
    return statusMap[status] || status
  }

  // Helper function to get date range based on period
  const getDateRange = (period: "month" | "3months" | "6months" | "year") => {
    const now = new Date()
    const startDate = new Date()
    
    switch (period) {
      case "month":
        startDate.setDate(1) // First day of current month
        break
      case "3months":
        startDate.setMonth(now.getMonth() - 3)
        break
      case "6months":
        startDate.setMonth(now.getMonth() - 6)
        break
      case "year":
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }
    
    return { startDate, endDate: now }
  }
  
  // Filter expenses by period
  const filteredExpenses = useMemo(() => {
    const { startDate } = getDateRange(paymentsPeriod)
    return teacherExpenses.filter((e: any) => {
      const expenseDate = new Date(e.date || e.createdAt)
      return expenseDate >= startDate
    })
  }, [teacherExpenses, paymentsPeriod])
  
  // Filter attendance by period for payments calculation
  const filteredAttendanceForPayments = useMemo(() => {
    const { startDate } = getDateRange(paymentsPeriod)
    return attendance.filter((a: any) => {
      const attendanceDate = new Date(a.date)
      return attendanceDate >= startDate
    })
  }, [attendance, paymentsPeriod])
  
  // Calculate total expenses (הוצאות) - filtered by period
  const expensesSum = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [filteredExpenses],
  )
  
  // Calculate total salary payments to teacher - filtered by period
  const paidSum = useMemo(() => {
    const { startDate } = getDateRange(paymentsPeriod)
    return (payments || [])
      .filter((p: any) => {
        const paymentDate = new Date(p.date || p.createdAt)
        const isSalary = p.type === "salary" || p.type === "שכר" || p.description?.includes("שכר")
        return isSalary && paymentDate >= startDate
      })
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
  }, [payments, paymentsPeriod])
  
  // Calculate total owed to teacher based on hours worked - filtered by period
  const owedToTeacher = useMemo(() => {
    const centerRate = teacher?.centerHourlyRate || 0
    const externalRate = teacher?.externalCourseRate || 0
    
    return filteredAttendanceForPayments.reduce((sum, a: any) => {
      const status = a.status?.toLowerCase()
      const isPresent = status === "נוכח" || status === "present"
      if (!isPresent) return sum
      
      const hours = calcAttendanceHours(a)
      
      // Determine rate based on course location
      const location = a.courseLocation?.toLowerCase() || ""
      const isCenter = location.includes("מרכז") || location === "center" || location === ""
      const rate = isCenter ? centerRate : externalRate
      
      return sum + (hours * rate)
    }, 0)
  }, [filteredAttendanceForPayments, teacher?.centerHourlyRate, teacher?.externalCourseRate])
  
  // Pending/debt = total owed minus what was paid as salary
  const pendingSum = useMemo(() => {
    return Math.max(0, owedToTeacher - paidSum)
  }, [owedToTeacher, paidSum])
  // Calculate hours based on course start/end time for each "present" attendance
  const totalHours = useMemo(() => {
    return attendance.reduce((sum, a: any) => {
      const status = a.status?.toLowerCase()
      const isPresent = status === "נוכח" || status === "present"
      if (!isPresent) return sum
      
      return sum + calcAttendanceHours(a)
    }, 0)
  }, [attendance])
  
  // Count present attendance (support both Hebrew and English status)
  const presentCount = useMemo(() => {
    return attendance.filter((a) => {
      const status = a.status?.toLowerCase()
      return status === "נוכח" || status === "present"
    }).length
  }, [attendance])
  
  const totalCount = useMemo(() => attendance.length, [attendance])
  const attendancePct = useMemo(() => (totalCount ? Math.round((presentCount / totalCount) * 100) : 0), [
    presentCount,
    totalCount,
  ])

  const handleAddAttendance = async () => {
    if (!attendanceDate || !attendanceHours || Number(attendanceHours) <= 0) return

    setIsAddingAttendance(true)
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: attendanceDate,
          hours: Number(attendanceHours),
          status: attendanceStatus,
          courseId: attendanceCourseId,
          note: attendanceNote,
          teacherId: id,
        }),
      })

      if (res.ok) {
        // Reset form and close dialog
        setAttendanceDate(new Date().toISOString().split("T")[0])
        setAttendanceHours("")
        setAttendanceStatus("נוכח")
        setAttendanceCourseId("")
        setAttendanceNote("")
        setIsAttendanceDialogOpen(false)
        // Refresh page to get updated data
        window.location.reload()
      }
    } catch (err) {
      console.error("Failed to add attendance:", err)
    } finally {
      setIsAddingAttendance(false)
    }
  }

  // Note: if id is "create", the useEffect above handles redirect
  // We show a brief loading state while redirecting
  if (loading || isCreateRoute) return <div className="p-6" dir="rtl">טוען...</div>
  
  if (error)
    return (
      <div className="p-6" dir="rtl">
        <div className="text-red-600 font-medium">שגיאה</div>
        <div className="text-sm text-muted-foreground mt-1">{error}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => router.refresh()} className="bg-transparent">
            נסה שוב
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/teachers")} className="bg-transparent">
            חזרה למורים
          </Button>
        </div>
      </div>
    )

  if (!teacher)
    return (
      <div className="p-6" dir="rtl">
        <div className="font-medium">מורה לא נמצא</div>
        <Button variant="outline" className="mt-4 bg-transparent" onClick={() => router.push("/dashboard/teachers")}>
          חזרה למורים
        </Button>
      </div>
    )

  return (
    <div dir="rtl" className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="bg-transparent hover:bg-white/50">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground">{teacher.name}</div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {teacher.email ?? "-"}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {teacher.phone ?? "-"}
              </span>
            </div>
          </div>
        </div>

        {!isTeacherUser && (
          <Link href={`/dashboard/teachers/${teacher.id}/edit`}>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Edit className="h-4 w-4" />
              ערוך
            </Button>
          </Link>
        )}
      </div>

      <Card className="p-4 border-0 shadow-sm bg-white/50 dark:bg-card/50">
        <Tabs defaultValue={canTabGeneral && !isTeacherUser ? "general" : canTabCourses ? "courses" : canTabPayments ? "payments" : "attendance"} dir="rtl" className="w-full">
          <TabsList className="grid w-full bg-muted/50 p-1 rounded-lg" style={{ gridTemplateColumns: `repeat(${[canTabGeneral && !isTeacherUser, canTabCourses, canTabPayments, canTabAttendance].filter(Boolean).length}, 1fr)` }}>
            {!isTeacherUser && canTabGeneral && <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-md transition-all">כללי</TabsTrigger>}
            {canTabCourses && <TabsTrigger value="courses" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-md transition-all">קורסים</TabsTrigger>}
            {canTabPayments && <TabsTrigger value="payments" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-md transition-all">תשלומים</TabsTrigger>}
            {canTabAttendance && <TabsTrigger value="attendance" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 rounded-md transition-all">נוכחות</TabsTrigger>}
          </TabsList>

          {canTabGeneral && (
          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">תעודת זהות</div>
                <div className="font-semibold text-sm">{teacher.idNumber ?? "-"}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">תאריך לידה</div>
                <div className="font-semibold text-sm">{fmtDate(teacher.birthDate)}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">עיר</div>
                <div className="font-semibold text-sm">{teacher.city ?? "-"}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">התמחות</div>
                <div className="font-semibold text-sm">{teacher.specialty ?? "-"}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">סטטוס</div>
                <div className="font-semibold text-sm">{teacher.status ?? "-"}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">נוצר</div>
                <div className="font-semibold text-sm">{fmtDate(teacher.createdAt)}</div>
              </div>
            </div>

            {teacher.bio && (
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">אודות</div>
                <div className="text-sm">{teacher.bio}</div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
              <div className="text-xs text-green-600 dark:text-green-400 mb-2">תעריפים</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">מחיר שעה במרכז</div>
                  <div className="font-semibold text-green-700 dark:text-green-400">{teacher.centerHourlyRate ?? 0} ₪</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">נסיעות</div>
                  <div className="font-semibold text-green-700 dark:text-green-400">{teacher.travelRate ?? 0} ₪</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">מחיר שעה בקורס חיצוני</div>
                  <div className="font-semibold text-green-700 dark:text-green-400">{teacher.externalCourseRate ?? 0} ₪</div>
                </div>
              </div>
            </div>
          </TabsContent>
          )}

          {canTabCourses && (
          <TabsContent value="courses" className="mt-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <h4 className="font-semibold text-blue-700 dark:text-blue-400">קורסים משויכים ({courses.length})</h4>
            </div>

            {courses.length ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="text-right p-3 font-medium">שם הקורס</th>
                      <th className="text-right p-3 font-medium">ימים</th>
                      <th className="text-right p-3 font-medium">שעות</th>
                      <th className="text-right p-3 font-medium">תלמידים</th>
                      <th className="text-right p-3 font-medium">ת. התחלה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr 
                        key={c.id} 
                        className="border-t hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                        onClick={() => openCourseDialog(c)}
                      >
                        <td className="p-3 font-medium text-blue-700 dark:text-blue-400">{c.name}</td>
                        <td className="p-3 text-muted-foreground">{formatDays(c.daysOfWeek)}</td>
                        <td className="p-3 text-muted-foreground">{fmtTimeRange(c.startTime, c.endTime)}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {c.enrollmentCount || 0}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{fmtDate(c.startDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                אין קורסים משויכים למורה
              </div>
            )}
          </TabsContent>
          )}

          {canTabPayments && (
          <TabsContent value="payments" className="mt-6 space-y-4">
            {/* Period Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground ml-2">תקופה:</span>
              <Button
                variant={paymentsPeriod === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentsPeriod("month")}
                className={paymentsPeriod === "month" ? "" : "bg-transparent"}
              >
                חודש נוכחי
              </Button>
              <Button
                variant={paymentsPeriod === "3months" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentsPeriod("3months")}
                className={paymentsPeriod === "3months" ? "" : "bg-transparent"}
              >
                3 חודשים
              </Button>
              <Button
                variant={paymentsPeriod === "6months" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentsPeriod("6months")}
                className={paymentsPeriod === "6months" ? "" : "bg-transparent"}
              >
                6 חודשים
              </Button>
              <Button
                variant={paymentsPeriod === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentsPeriod("year")}
                className={paymentsPeriod === "year" ? "" : "bg-transparent"}
              >
                שנה
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Paid to Teacher - shows expenses sum */}
              <Card className="p-4 bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">₪</span>
                    <span className="text-xs text-green-700 dark:text-green-400">שולם למורה</span>
                  </div>
                  {!isTeacherUser && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 text-green-600 hover:bg-green-100"
                      onClick={() => setIsPaymentDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{expensesSum.toLocaleString("he-IL")} ₪</div>
              </Card>
              {/* Debt to Teacher - owed amount */}
              <Card className="p-4 bg-orange-50 dark:bg-orange-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-orange-600 font-bold">₪</span>
                  <span className="text-xs text-orange-700 dark:text-orange-400">חוב למורה</span>
                </div>
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{owedToTeacher.toLocaleString("he-IL")} ₪</div>
              </Card>
              {/* Balance - paid minus debt */}
              <Card className={`p-4 ${expensesSum - owedToTeacher >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-bold ${expensesSum - owedToTeacher >= 0 ? "text-blue-600" : "text-red-600"}`}>₪</span>
                  <span className={`text-xs ${expensesSum - owedToTeacher >= 0 ? "text-blue-700 dark:text-blue-400" : "text-red-700 dark:text-red-400"}`}>יתרה</span>
                </div>
                <div className={`text-2xl font-bold ${expensesSum - owedToTeacher >= 0 ? "text-blue-700 dark:text-blue-400" : "text-red-700 dark:text-red-400"}`}>
                  {(expensesSum - owedToTeacher).toLocaleString("he-IL")} ₪
                </div>
              </Card>
            </div>

            {filteredExpenses.length ? (
              <div className="space-y-2">
                {filteredExpenses.map((e) => {
                  const paymentMethodLabel = e.paymentMethod === "cash" ? "מזומן" : e.paymentMethod === "transfer" ? "העברה" : e.paymentMethod === "check" ? "שיק" : e.paymentMethod === "bit" ? "ביט" : e.paymentMethod
                  return (
                    <Card key={e.id} dir="rtl" className="p-3 border-r-4 border-r-green-500 bg-green-50/50 dark:bg-green-950/10">
                      <div className="flex items-center justify-between gap-4 flex-row-reverse">
                        {/* Right side - Date, Payment Method, Description */}
                        <div className="flex items-center gap-2 text-right flex-wrap">
                          <span className="font-medium">{fmtDate(e.date)}</span>
                          {paymentMethodLabel && (
                            <>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-sm text-muted-foreground">{paymentMethodLabel}</span>
                            </>
                          )}
                          {e.description && (
                            <>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-sm text-muted-foreground">{e.description}</span>
                            </>
                          )}
                        </div>
                        {/* Left side - Amount and Badge */}
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                            תשלום
                          </span>
                          <span className="font-bold text-green-600">{Number(e.amount).toLocaleString("he-IL")} ₪</span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">אין תשלומים למורה</Card>
            )}
          </TabsContent>
          )}

          {canTabAttendance && (
          <TabsContent value="attendance" className="mt-6 space-y-4">
            {/* Stats Cards with Colors */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 mb-2">
                  <CalendarCheck className="h-4 w-4" />
                  נוכחות
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{attendancePct}%</div>
              </Card>
              <Card className="p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-400 mb-2">
                  <CalendarCheck className="h-4 w-4" />
                  מפגשים
                </div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {presentCount}/{totalCount}
                </div>
              </Card>
              <Card className="p-4 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800">
                <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-400 mb-2">
                  <CalendarCheck className="h-4 w-4" />
                  שעות
                </div>
                <div className="text-2xl font-bold text-teal-700 dark:text-teal-400">{totalHours}</div>
              </Card>
            </div>

            {/* Course Filter Dropdown */}
            {attendanceCourses.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">סנן לפי קורס:</span>
                <Select value={selectedAttendanceCourse} onValueChange={setSelectedAttendanceCourse}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="כל הקורסים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הקורסים</SelectItem>
                    {attendanceCourses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Attendance Records */}
            {filteredAttendance.length ? (
              <div className="space-y-2">
                {filteredAttendance.map((a: any) => {
                  const statusLabel = getStatusLabel(a.status)
                  const isPresent = statusLabel === "נוכח"
                  const isAbsent = statusLabel === "חיסור"
                  
                  return (
                    <Card key={a.id} dir="rtl" className={`p-3 border-r-4 ${
                      isPresent ? "border-r-green-500 bg-green-50/50 dark:bg-green-950/10" :
                      isAbsent ? "border-r-red-500 bg-red-50/50 dark:bg-red-950/10" :
                      "border-r-orange-500 bg-orange-50/50 dark:bg-orange-950/10"
                    }`}>
                      <div className="flex items-center justify-between gap-4 flex-row-reverse">
                        {/* Right side - Date and Course */}
                        <div className="flex items-center gap-2 text-right">
                          <span className="font-medium">{fmtDate(a.date)}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-sm text-muted-foreground">{a.courseName ?? "-"}</span>
                          {a.hours && (
                            <>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-sm text-muted-foreground">{a.hours} שעות</span>
                            </>
                          )}
                        </div>
                        {/* Left side - Status badge */}
                        <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${
                          isPresent ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          isAbsent ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                        }`}>{statusLabel}</span>
                      </div>
                      {a.notes && <div className="text-sm text-muted-foreground mt-2 pt-2 border-t text-right">{a.notes}</div>}
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="p-8 text-center bg-gray-50 dark:bg-gray-900/20">
                <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <div className="text-muted-foreground">אין רשומות נוכחות למורה</div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                  נוכחות המורה תוצג כאן לאחר רישום בדף הנוכחות
                </div>
              </Card>
            )}
          </TabsContent>
          )}
        </Tabs>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>תשלום למורה (הוצאה)</DialogTitle>
            <DialogDescription>הזן את פרטי התשלום למורה - יירשם כהוצאה במערכת</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">סכום *</Label>
              <Input
                id="payment-amount"
                type="number"
                placeholder="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">תאריך</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">אמצעי תשלום</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v)}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">מזומן</SelectItem>
                  <SelectItem value="credit">אשראי</SelectItem>
                  <SelectItem value="transfer">העברה בנקאית</SelectItem>
                  <SelectItem value="check">שיק</SelectItem>
                  <SelectItem value="bit">ביט</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "credit" && (
              <div className="space-y-2">
                <Label htmlFor="card-digits">4 ספרות אחרונות של כרטיס *</Label>
                <Input
                  id="card-digits"
                  placeholder="1234"
                  maxLength={4}
                  value={cardLastDigits}
                  onChange={(e) => setCardLastDigits(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {(paymentMethod === "transfer" || paymentMethod === "check") && (
              <div className="grid gap-3 grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bank-name">בנק *</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger id="bank-name">
                      <SelectValue placeholder="בחר בנק" />
                    </SelectTrigger>
                    <SelectContent>
                      {israeliBanks.map((bank) => (
                        <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-branch">סניף *</Label>
                  <Input
                    id="bank-branch"
                    placeholder="מספר סניף"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-number">מס' חשבון *</Label>
                  <Input
                    id="account-number"
                    placeholder="מספר חשבון"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="payment-description">תיאור</Label>
              <Input
                id="payment-description"
                placeholder="תיאור התשלום (אופציונלי)"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAddPayment}
              disabled={isAddingPayment || !paymentAmount || Number(paymentAmount) <= 0}
            >
              {isAddingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מוסיף...
                </>
              ) : (
                "שלם למורה"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Details Dialog */}
      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-700 dark:text-blue-400">{selectedCourse?.name}</DialogTitle>
            <DialogDescription>פרטי הקורס</DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-muted-foreground mb-1">ימים</div>
                  <div className="font-semibold text-sm">{formatDays(selectedCourse.daysOfWeek)}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-muted-foreground mb-1">שעות</div>
                  <div className="font-semibold text-sm">
                    {fmtTimeRange(selectedCourse.startTime, selectedCourse.endTime)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-muted-foreground mb-1">תאריך התחלה</div>
                  <div className="font-semibold text-sm">{fmtDate(selectedCourse.startDate)}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-muted-foreground mb-1">תאריך סיום</div>
                  <div className="font-semibold text-sm">{fmtDate(selectedCourse.endDate)}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="text-xs text-green-600 mb-1">תלמידים רשומים</div>
                  <div className="font-semibold text-lg text-green-700 dark:text-green-400">{selectedCourse.enrollmentCount || 0}</div>
                </div>
                {canSeeCourseFinancial && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <div className="text-xs text-blue-600 mb-1">מחיר</div>
                    <div className="font-semibold text-lg text-blue-700 dark:text-blue-400">
                      {selectedCourse.price?.toLocaleString("he-IL") || 0} ₪
                    </div>
                  </div>
                )}
              </div>
              
              {selectedCourse.location && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-muted-foreground mb-1">מיקום</div>
                  <div className="font-semibold text-sm">{selectedCourse.location}</div>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 bg-transparent"
                  onClick={() => setIsCourseDialogOpen(false)}
                >
                  סגור
                </Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setIsCourseDialogOpen(false)
                    router.push(`/dashboard/courses/${selectedCourse.id}`)
                  }}
                >
                  צפה בקורס
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
