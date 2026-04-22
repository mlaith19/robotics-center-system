"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, Mail, Phone, Edit, BookOpen, CalendarCheck, Plus, Loader2, Printer, Trash2 } from "lucide-react"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole, canDeleteTeacherAttendanceRecord } from "@/lib/permissions"
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
  pricingMethod?: "standard" | "per_student_tier" | null
  studentTierRates?: { upToStudents: number; hourlyRate: number }[] | null
  bonusEnabled?: boolean | null
  bonusMinStudents?: number | null
  bonusPerHour?: number | null
  createdAt?: string
  updatedAt?: string
  profileImage?: string | null
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
      tariffProfileId?: string | null
      tariffProfileName?: string | null
      pricingMethod?: string
      effectiveHourlyRate?: number | null
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

type TeacherCourseRow = NonNullable<Teacher["teacherCourses"]>[number]["course"]

type GafanProgramForTeacher = {
  id: string
  name?: string | null
  schoolId?: string | null
  schoolName?: string | null
  teacherIds?: string[]
  teacherRates?: Record<string, { teachingHourlyRate?: number; travelHourlyRate?: number; officeHourlyRate?: number }>
  hourRows?: Array<{
    date?: string
    teacherName?: string
    teacherId?: string
    startTime?: string
    endTime?: string
    totalHours?: number | string
    pendingAssignment?: boolean
  }>
}

const DEFAULT_GAFAN_TEACHING_HOURLY_RATE = 50
const DEFAULT_GAFAN_TRAVEL_HOURLY_RATE = 30

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

function normalizeTeacherRatesMap(
  raw: unknown,
): Record<string, { teachingHourlyRate: number; travelHourlyRate: number; officeHourlyRate?: number }> {
  let input: unknown = raw
  if (typeof input === "string") {
    try {
      input = JSON.parse(input)
    } catch {
      input = {}
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  const out: Record<string, { teachingHourlyRate: number; travelHourlyRate: number; officeHourlyRate?: number }> = {}
  for (const [teacherId, value] of Object.entries(input as Record<string, unknown>)) {
    const tid = String(teacherId || "").trim()
    if (!tid) continue
    const v = (value ?? {}) as Record<string, unknown>
    const teaching = Number(v.teachingHourlyRate ?? 0)
    const travel = Number(v.travelHourlyRate ?? v.officeHourlyRate ?? 0)
    out[tid] = {
      teachingHourlyRate: Number.isFinite(teaching) && teaching >= 0 ? teaching : 0,
      travelHourlyRate: Number.isFinite(travel) && travel >= 0 ? travel : 0,
    }
  }
  return out
}

function normalizeTeacherIdsList(raw: unknown): string[] {
  let input: unknown = raw
  if (typeof input === "string") {
    const s = input.trim()
    if (!s) return []
    try {
      input = JSON.parse(s)
    } catch {
      input = s.includes(",") ? s.split(",").map((x) => x.trim()) : [s]
    }
  }
  if (!Array.isArray(input)) return []
  return input.map((x) => String(x || "").trim()).filter(Boolean)
}

function normalizeGafanHourRowsList(
  raw: unknown,
): Array<{ date?: string; teacherName?: string; teacherId?: string; startTime?: string; endTime?: string; totalHours?: number | string; pendingAssignment?: boolean }> {
  let input: unknown = raw
  if (typeof input === "string") {
    try {
      input = JSON.parse(input)
    } catch {
      input = []
    }
  }
  if (!Array.isArray(input)) return []
  return input as Array<{ date?: string; teacherName?: string; teacherId?: string; startTime?: string; endTime?: string; totalHours?: number | string; pendingAssignment?: boolean }>
}

function normalizePersonName(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ")
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
  const [schoolGafanPrograms, setSchoolGafanPrograms] = useState<GafanProgramForTeacher[]>([])
  const [centerName, setCenterName] = useState("")
  const [centerLogo, setCenterLogo] = useState("")
  const [selectedAttendanceCourse, setSelectedAttendanceCourse] = useState<string>("all")
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>("all")
  const [attendanceTableTab, setAttendanceTableTab] = useState<"regular" | "gafan">("regular")
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null)
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
  const canDeleteTeacherAttendanceRow = canDeleteTeacherAttendanceRecord({
    roleKey: currentUser?.roleKey,
    role: currentUser?.role,
    permissions: userPerms,
  })
  /** מחיר קורס / נתונים כספיים של קורס — כמו בדף הקורסים; מורה בלי הרשאה לא רואה בפופאפ */
  const canSeeCourseFinancial = isAdmin || hasPermission(userPerms, "courses.financial")
  const hasAnyPermission = (...permissionIds: string[]) => permissionIds.some((perm) => hasPermission(userPerms, perm))
  // בפרופיל מורה מחובר: נאפשר גם הרשאות myProfile וגם teachers כדי שלא יהיו פערים בניהול הרשאות בדף משתמשים.
  const hasAnyProfileTabPermission = hasAnyPermission(
    "myProfile.tab.general",
    "myProfile.tab.courses",
    "myProfile.tab.payments",
    "myProfile.tab.attendance",
    "teachers.tab.general",
    "teachers.tab.courses",
    "teachers.tab.payments",
    "teachers.tab.attendance",
  )
  const selfProfileFallback = isTeacherUser && !isAdmin && !hasAnyProfileTabPermission
  const canTabGeneral = isAdmin || selfProfileFallback || hasAnyPermission("myProfile.tab.general", "teachers.tab.general")
  const canTabCourses = isAdmin || selfProfileFallback || hasAnyPermission("myProfile.tab.courses", "teachers.tab.courses")
  const canTabPayments = isAdmin || selfProfileFallback || hasAnyPermission("myProfile.tab.payments", "teachers.tab.payments")
  const canTabAttendance = isAdmin || selfProfileFallback || hasAnyPermission("myProfile.tab.attendance", "teachers.tab.attendance")
  const canSeeTeacherTariffUi =
    isTeacherUser ||
    isAdmin ||
    hasPermission(userPerms, "teachers.financial")

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
  const [selectedCourse, setSelectedCourse] = useState<TeacherCourseRow | null>(null)
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false)

  // Attendance dialog state
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0])
  const [attendanceHours, setAttendanceHours] = useState("")
  const [attendanceStatus, setAttendanceStatus] = useState<"נוכח" | "חיסור" | "איחור">("נוכח")
  const [attendanceCourseId, setAttendanceCourseId] = useState("")
  const [attendanceNote, setAttendanceNote] = useState("")
  const [isAddingAttendance, setIsAddingAttendance] = useState(false) // Declare isAddingAttendance variable

  const openCourseDialog = (course: TeacherCourseRow) => {
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
        fetch("/api/settings").then((r) => r.ok ? r.json() : {}).then((s) => {
          if (!cancelled) { setCenterName(String(s.center_name || "")); setCenterLogo(String(s.logo || "")) }
        }).catch(() => {})
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
  
  const refreshSchoolGafanPrograms = useCallback(() => {
    fetch("/api/gafan", { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSchoolGafanPrograms(Array.isArray(data) ? data : []))
      .catch(() => setSchoolGafanPrograms([]))
  }, [])

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

    refreshSchoolGafanPrograms()
  }, [id, loading, teacher, refreshSchoolGafanPrograms])

  // Auto-refresh school Gafan assignments/rates so attendance prices stay up-to-date.
  useEffect(() => {
    if (!id || id === "create" || loading || !teacher) return
    const intervalId = window.setInterval(() => {
      refreshSchoolGafanPrograms()
    }, 30000)
    return () => window.clearInterval(intervalId)
  }, [id, loading, teacher, refreshSchoolGafanPrograms])


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

  const teacherSchoolAttendanceRows = useMemo(() => {
    if (!teacher || !id || selectedAttendanceCourse !== "all") return [] as any[]
    const teacherNameNormalized = normalizePersonName(teacher.name)
    const teacherIdStr = String(id)
    const out: any[] = []
    for (const program of schoolGafanPrograms) {
      const teacherIds = normalizeTeacherIdsList(program.teacherIds)
      const rateMap = normalizeTeacherRatesMap(program.teacherRates)
      const assignedById = teacherIds.includes(teacherIdStr)
      const programRows = normalizeGafanHourRowsList(program.hourRows)
      for (const r of programRows) {
        if (r?.pendingAssignment === true) continue
        const rowTeacherId = String(r?.teacherId || "").trim()
        const rowTeacherName = normalizePersonName(r?.teacherName)
        const belongsById = rowTeacherId && rowTeacherId === teacherIdStr
        const belongsByName = teacherNameNormalized && rowTeacherName && rowTeacherName === teacherNameNormalized
        // Legacy rows may miss teacherId.
        // - If exactly one teacher is assigned: attribute safely to that teacher.
        // - If multiple teachers are assigned: fallback only to the primary teacher.
        const belongsBySingleAssignedFallback = !rowTeacherId && assignedById && teacherIds.length === 1
        const belongsByPrimaryFallback = !rowTeacherId && assignedById && teacherIds.length > 1 && teacherIds[0] === teacherIdStr
        const belongs = Boolean(belongsById || belongsByName || belongsBySingleAssignedFallback || belongsByPrimaryFallback)
        if (!belongs) continue
        const date = String(r?.date || "").trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        const startTime = String(r?.startTime || "").slice(0, 5)
        const endTime = String(r?.endTime || "").slice(0, 5)
        const hours = Number(r?.totalHours || 0)
        const teacherRateRow =
          (rowTeacherId && Object.prototype.hasOwnProperty.call(rateMap, rowTeacherId) ? rateMap[rowTeacherId] : undefined) ??
          (Object.prototype.hasOwnProperty.call(rateMap, teacherIdStr) ? rateMap[teacherIdStr] : undefined) ??
          // Fallback for legacy/inconsistent records: use the first assigned teacher rate.
          (() => {
            const assignedRate = teacherIds.map((tid) => rateMap[tid]).find(Boolean)
            if (assignedRate) return assignedRate
            const onlyRate = Object.values(rateMap)[0]
            return onlyRate
          })()
        const teachingRate = Number(teacherRateRow?.teachingHourlyRate ?? DEFAULT_GAFAN_TEACHING_HOURLY_RATE)
        const travelRate = Number(
          teacherRateRow?.travelHourlyRate ?? teacherRateRow?.officeHourlyRate ?? DEFAULT_GAFAN_TRAVEL_HOURLY_RATE,
        )
        out.push({
          id: `school-gafan-${program.id}-${date}-${startTime}-${endTime}-${out.length}`,
          date,
          status: "נוכח",
          courseName: `${String(program.name || "גפ\"ן")}`,
          schoolName: String(program.schoolName || "בית ספר"),
          courseStartTime: startTime,
          courseEndTime: endTime,
          hours: Number.isFinite(hours) && hours > 0 ? hours : 0,
          notes: "נוכחות בית ספר (גפ\"ן)",
          hourKind: "teaching",
          appliedHourlyRate: Math.max(0, teachingRate + travelRate),
          sourceType: "school-gafan",
        })
      }
    }
    return out
  }, [teacher, id, selectedAttendanceCourse, schoolGafanPrograms])

  const combinedAttendance = useMemo(() => {
    const merged = [...filteredAttendance, ...teacherSchoolAttendanceRows]
    return merged.sort((a: any, b: any) => String(b.date || "").localeCompare(String(a.date || "")))
  }, [filteredAttendance, teacherSchoolAttendanceRows])

  const attendanceMonthStats = useMemo(() => {
    const monthMap = new Map<string, { label: string; totalHours: number; totalPayment: number; count: number }>()
    for (const a of combinedAttendance) {
      const ymd = String(a?.date || "").trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
      const monthKey = ymd.slice(0, 7)
      const dt = new Date(`${ymd}T12:00:00`)
      const label = Number.isNaN(dt.getTime())
        ? monthKey
        : new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(dt)
      const prev = monthMap.get(monthKey) ?? { label, totalHours: 0, totalPayment: 0, count: 0 }
      const rawStatus = String(a?.status || "").trim().toLowerCase()
      const isPresent = rawStatus === "present" || rawStatus === "נוכח"
      const hours = isPresent ? calcAttendanceHours(a) : 0
      const appliedRate =
        a?.appliedHourlyRate != null && a?.appliedHourlyRate !== "" && Number.isFinite(Number(a.appliedHourlyRate))
          ? Number(a.appliedHourlyRate)
          : 0
      prev.totalHours += hours
      prev.totalPayment += hours * appliedRate
      prev.count += 1
      monthMap.set(monthKey, prev)
    }
    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => ({
        key,
        label: value.label,
        totalHours: Math.round(value.totalHours * 100) / 100,
        totalPayment: Math.round(value.totalPayment * 100) / 100,
        count: value.count,
      }))
  }, [combinedAttendance])

  useEffect(() => {
    if (attendanceMonthStats.length === 0) {
      setSelectedAttendanceMonth("all")
      return
    }
    if (selectedAttendanceMonth === "all") return
    if (!attendanceMonthStats.some((m) => m.key === selectedAttendanceMonth)) {
      setSelectedAttendanceMonth(attendanceMonthStats[0].key)
    }
  }, [attendanceMonthStats, selectedAttendanceMonth])

  const filteredAttendanceByMonth = useMemo(() => {
    if (selectedAttendanceMonth === "all") return combinedAttendance
    return combinedAttendance.filter((a: any) =>
      String(a?.date || "").trim().slice(0, 7) === selectedAttendanceMonth,
    )
  }, [combinedAttendance, selectedAttendanceMonth])

  const regularAttendanceRows = useMemo(
    () => filteredAttendanceByMonth.filter((a: any) => String(a?.sourceType || "") !== "school-gafan"),
    [filteredAttendanceByMonth],
  )

  const gafanAttendanceRows = useMemo(
    () => filteredAttendanceByMonth.filter((a: any) => String(a?.sourceType || "") === "school-gafan"),
    [filteredAttendanceByMonth],
  )

  const hasGafanAttendanceRows = gafanAttendanceRows.length > 0

  useEffect(() => {
    if (!hasGafanAttendanceRows && attendanceTableTab === "gafan") {
      setAttendanceTableTab("regular")
    }
  }, [hasGafanAttendanceRows, attendanceTableTab])

  const activeAttendanceMonthSummary = useMemo(() => {
    if (selectedAttendanceMonth === "all") {
      const totalHours = attendanceMonthStats.reduce((sum, m) => sum + Number(m.totalHours || 0), 0)
      const totalPayment = attendanceMonthStats.reduce((sum, m) => sum + Number(m.totalPayment || 0), 0)
      return {
        label: "כל החודשים",
        totalHours: Math.round(totalHours * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
      }
    }
    const month = attendanceMonthStats.find((m) => m.key === selectedAttendanceMonth)
    return {
      label: month?.label || selectedAttendanceMonth,
      totalHours: Number(month?.totalHours || 0),
      totalPayment: Number(month?.totalPayment || 0),
    }
  }, [attendanceMonthStats, selectedAttendanceMonth])

  const attendancePaymentSplitSummary = useMemo(() => {
    let regularTotal = 0
    let gafanTotal = 0
    for (const a of filteredAttendanceByMonth) {
      const status = String(a?.status || "").trim().toLowerCase()
      const isPresent = status === "present" || status === "נוכח"
      if (!isPresent) continue
      const hours = calcAttendanceHours(a)
      const rate =
        a?.appliedHourlyRate != null && a?.appliedHourlyRate !== "" && Number.isFinite(Number(a.appliedHourlyRate))
          ? Number(a.appliedHourlyRate)
          : 0
      const amount = hours * rate
      if (String(a?.sourceType || "") === "school-gafan") gafanTotal += amount
      else regularTotal += amount
    }
    const total = regularTotal + gafanTotal
    return {
      regularTotal: Math.round(regularTotal * 100) / 100,
      gafanTotal: Math.round(gafanTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    }
  }, [filteredAttendanceByMonth])
  
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
  
  // Calculate total owed to teacher based on hours worked - filtered by period
  const owedToTeacher = useMemo(() => {
    const courseMeta = new Map<string, { location?: string; enrollmentCount: number; effectiveRate: number }>()
    courses.forEach((c: TeacherCourseRow) => {
      const ec = Number(c.enrollmentCount || 0)
      const rate = Number(c.effectiveHourlyRate ?? 0)
      courseMeta.set(c.id, { location: c.location, enrollmentCount: ec, effectiveRate: rate })
    })
    return filteredAttendanceForPayments.reduce((sum, a: any) => {
      const status = a.status?.toLowerCase()
      const isPresent = status === "נוכח" || status === "present"
      if (!isPresent) return sum
      const hours = calcAttendanceHours(a)
      const cid = a.courseId ? String(a.courseId) : ""
      const meta = cid ? courseMeta.get(cid) : undefined
      const applied = a.appliedHourlyRate
      const rate =
        applied != null && applied !== "" && Number.isFinite(Number(applied))
          ? Number(applied)
          : Number(meta?.effectiveRate ?? 0)
      return sum + hours * rate
    }, 0)
  }, [filteredAttendanceForPayments, courses])
  
  // Pending/debt = total owed minus manual expense payments only.
  const pendingSum = useMemo(() => {
    return Math.max(0, owedToTeacher - expensesSum)
  }, [owedToTeacher, expensesSum])
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

  async function handleDeleteAttendanceRecord(recordId: string) {
    if (!canDeleteTeacherAttendanceRow || !id || typeof id !== "string") return
    if (!window.confirm("למחוק את רשומת הנוכחות?")) return
    setDeletingAttendanceId(recordId)
    try {
      const res = await fetch(`/api/attendance?id=${encodeURIComponent(recordId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) return
      const refresh = await fetch(`/api/attendance?teacherId=${id}`, { cache: "no-store" })
      const data = refresh.ok ? await refresh.json() : []
      setTeacherAttendance(Array.isArray(data) ? data : [])
    } catch {
      // ignore
    } finally {
      setDeletingAttendanceId(null)
    }
  }

  // Note: if id is "create", the useEffect above handles redirect
  // We show a brief loading state while redirecting
  if (loading || isCreateRoute) return <div className="p-3 sm:p-6" dir="rtl">טוען...</div>
  
  if (error)
    return (
      <div className="p-3 sm:p-6" dir="rtl">
        <div className="font-medium text-red-600">שגיאה</div>
        <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => router.refresh()} className="bg-transparent">
            נסה שוב
          </Button>
          {isTeacherUser ? (
            <Button variant="outline" onClick={() => router.push("/dashboard")} className="bg-transparent">
              חזרה לדף הבית
            </Button>
          ) : (
            <Button variant="outline" onClick={() => router.push("/dashboard/teachers")} className="bg-transparent">
              חזרה למורים
            </Button>
          )}
        </div>
      </div>
    )

  if (!teacher)
    return (
      <div className="p-3 sm:p-6" dir="rtl">
        <div className="font-medium">מורה לא נמצא</div>
        {isTeacherUser ? (
          <Button variant="outline" className="mt-4 bg-transparent" onClick={() => router.push("/dashboard")}>
            חזרה לדף הבית
          </Button>
        ) : (
          <Button variant="outline" className="mt-4 bg-transparent" onClick={() => router.push("/dashboard/teachers")}>
            חזרה למורים
          </Button>
        )}
      </div>
    )

  const visibleTabCount = [canTabGeneral, canTabCourses, canTabPayments, canTabAttendance].filter(Boolean).length

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
      {/* Compact Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-gradient-to-l from-blue-50 to-indigo-50 p-4 dark:border-blue-900 dark:from-blue-950/30 dark:to-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 bg-transparent hover:bg-white/50">
            <ArrowRight className="h-5 w-5" />
          </Button>
          {teacher.profileImage ? (
            <img src={teacher.profileImage} alt={teacher.name} className="h-12 w-12 rounded-full border bg-white object-cover shadow-lg" />
          ) : (
            <img src="/api/og-logo" alt="Center logo" className="h-12 w-12 rounded-full border bg-white object-contain p-1.5 shadow-lg" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-foreground sm:text-xl">{teacher.name}</div>
            <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
              <span className="flex min-w-0 items-center gap-1">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{teacher.email ?? "-"}</span>
              </span>
              <span className="flex items-center gap-1" dir="ltr">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {teacher.phone ?? "-"}
              </span>
            </div>
          </div>
        </div>

        {!isTeacherUser && (
          <Link href={`/dashboard/teachers/${teacher.id}/edit`} className="w-full shrink-0 sm:w-auto">
            <Button className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 sm:w-auto">
              <Edit className="h-4 w-4" />
              ערוך
            </Button>
          </Link>
        )}
      </div>

      <Card className="border-0 bg-white/50 p-3 shadow-sm dark:bg-card/50 sm:p-4">
        <Tabs defaultValue={canTabGeneral ? "general" : canTabCourses ? "courses" : canTabPayments ? "payments" : "attendance"} dir="rtl" className="w-full">
          <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <TabsList
              className="mb-3 flex h-auto min-h-10 w-max min-w-full max-w-none flex-nowrap justify-start gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1 sm:mb-4 md:grid md:w-full md:overflow-visible"
              style={visibleTabCount > 0 ? { gridTemplateColumns: `repeat(${visibleTabCount}, minmax(0, 1fr))` } : undefined}
            >
              {canTabGeneral && (
                <TabsTrigger
                  value="general"
                  className="shrink-0 rounded-md px-2 text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm sm:text-sm md:min-w-0"
                >
                  כללי
                </TabsTrigger>
              )}
              {canTabCourses && (
                <TabsTrigger
                  value="courses"
                  className="shrink-0 rounded-md px-2 text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm sm:text-sm md:min-w-0"
                >
                  קורסים
                </TabsTrigger>
              )}
              {canTabPayments && (
                <TabsTrigger
                  value="payments"
                  className="shrink-0 rounded-md px-2 text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm sm:text-sm md:min-w-0"
                >
                  תשלומים
                </TabsTrigger>
              )}
              {canTabAttendance && (
                <TabsTrigger
                  value="attendance"
                  className="shrink-0 rounded-md px-2 text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm sm:text-sm md:min-w-0"
                >
                  נוכחות
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {canTabGeneral && (
          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">תעודת זהות</div>
                <div className="font-semibold text-sm">{teacher.idNumber ?? "-"}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-muted-foreground mb-1">תאריך לידה</div>
                <div className="font-semibold text-sm">{fmtDate(teacher.birthDate ?? undefined)}</div>
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

            {canSeeTeacherTariffUi ? (
              <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                <div className="text-xs text-green-600 dark:text-green-400 mb-1">תעריפי שכר</div>
                <p className="text-sm text-muted-foreground">
                  התעריף לכל קורס מוגדר ב&quot;הגדרות המרכז&quot; (פרופיל תעריף) ונבחר בעריכת הקורס לכל מורה בנפרד. הפרטים מופיעים בטאב &quot;קורסים&quot;.
                </p>
              </div>
            ) : null}
          </TabsContent>
          )}

          {canTabCourses && (
          <TabsContent value="courses" className="mt-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <h4 className="font-semibold text-blue-700 dark:text-blue-400">קורסים משויכים ({courses.length})</h4>
            </div>

            {courses.length ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="text-right p-3 font-medium">שם הקורס</th>
                      <th className="text-right p-3 font-medium">ימים</th>
                      <th className="text-right p-3 font-medium">שעות</th>
                      <th className="text-right p-3 font-medium">תלמידים</th>
                      {canSeeTeacherTariffUi && (
                        <>
                          <th className="text-right p-3 font-medium">פרופיל תעריף</th>
                          <th className="text-right p-3 font-medium">שיטה</th>
                          <th className="text-right p-3 font-medium">שעה משוערת (₪)</th>
                        </>
                      )}
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
                        {canSeeTeacherTariffUi && (
                          <>
                            <td className="p-3 text-muted-foreground">{c.tariffProfileName || "—"}</td>
                            <td className="p-3 text-muted-foreground">
                              {c.pricingMethod === "per_student_tier" ? "לפי תלמידים" : "רגיל (מרכז/חיצוני)"}
                            </td>
                            <td className="p-3 font-medium text-green-700 dark:text-green-400">
                              {c.effectiveHourlyRate != null ? Number(c.effectiveHourlyRate).toFixed(2) : "—"}
                            </td>
                          </>
                        )}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">תקופה:</span>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {/* Paid to Teacher - shows expenses sum */}
              <Card className="bg-green-50 p-4 dark:bg-green-950/20">
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
              {/* Balance - remaining amount to pay teacher */}
              <Card className={`p-4 ${pendingSum > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-bold ${pendingSum > 0 ? "text-red-600" : "text-green-600"}`}>₪</span>
                  <span className={`text-xs ${pendingSum > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>יתרה לתשלום</span>
                </div>
                <div className={`text-2xl font-bold ${pendingSum > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                  {pendingSum.toLocaleString("he-IL")} ₪
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <Card className="border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {attendanceCourses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground">סנן לפי קורס:</span>
                    <Select value={selectedAttendanceCourse} onValueChange={setSelectedAttendanceCourse}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="כל הקורסים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הקורסים</SelectItem>
                        {attendanceCourses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground">סנן לפי חודש:</span>
                  <Select value={selectedAttendanceMonth} onValueChange={setSelectedAttendanceMonth}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="כל החודשים" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל החודשים</SelectItem>
                      {attendanceMonthStats.map((m) => (
                        <SelectItem key={m.key} value={m.key}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  const printRows = attendanceTableTab === "gafan" ? gafanAttendanceRows : regularAttendanceRows
                  const printTypeLabel = attendanceTableTab === "gafan" ? "גפ\"ן" : "רגיל"
                  const w = window.open("", "_blank")
                  if (!w) return
                  const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>נוכחות מורה (${printTypeLabel}) - ${teacher?.name || ""}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:900px;margin:0 auto}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}.header h1{font-size:22px;color:#1e40af;margin-top:6px}.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}td{border:1px solid #d1d5db;padding:8px 10px;text-align:center;vertical-align:middle}tr:nth-child(even) td{background:#f9fafb}.status-present{color:#166534;font-weight:600}.status-absent{color:#991b1b;font-weight:600}@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}}</style></head><body>`)
                  w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1><h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${teacher?.name || "מורה"}</h2><h2>דוח נוכחות ${printTypeLabel} - ${activeAttendanceMonthSummary.label}</h2></div>`)
                  w.document.write(`<table><thead><tr><th>#</th><th>תאריך</th><th>בית ספר</th><th>קורס/תוכנית</th><th>משעה</th><th>עד שעה</th><th>סה"כ שעות</th><th>סטטוס</th><th>הערה</th></tr></thead><tbody>`)
                  printRows.forEach((a: any, idx: number) => {
                    const statusLabel = getStatusLabel(a.status)
                    const isPresent = statusLabel === "נוכח"
                    const startDisplay = courseTimeToDisplayValue(a.courseStartTime) || "—"
                    const endDisplay = courseTimeToDisplayValue(a.courseEndTime) || "—"
                    const hours = calcAttendanceHours(a)
                    const cls = isPresent ? "status-present" : "status-absent"
                    const schoolName = a.schoolName || "—"
                    w.document.write(`<tr><td>${idx + 1}</td><td>${fmtDate(a.date)}</td><td>${schoolName}</td><td>${a.courseName || "—"}</td><td>${startDisplay}</td><td>${endDisplay}</td><td>${hours > 0 ? hours.toFixed(1) : "—"}</td><td class="${cls}">${statusLabel}</td><td>${a.notes || "—"}</td></tr>`)
                  })
                  w.document.write(`</tbody></table></body></html>`)
                  w.document.close()
                  setTimeout(() => w.print(), 300)
                }}
              >
                <Printer className="h-4 w-4" />
                הדפסת נוכחות מורה
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/20">
                <div className="text-sm text-teal-700 dark:text-teal-300">סה״כ לתשלום קורסים רגילים ({activeAttendanceMonthSummary.label})</div>
                <div className="text-2xl font-bold text-teal-700 dark:text-teal-200">
                  ₪{attendancePaymentSplitSummary.regularTotal.toLocaleString("he-IL")}
                </div>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <div className="text-sm text-emerald-700 dark:text-emerald-300">סה״כ לתשלום גפ״ן ({activeAttendanceMonthSummary.label})</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                  ₪{attendancePaymentSplitSummary.gafanTotal.toLocaleString("he-IL")}
                </div>
              </Card>
              <Card className="border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/20">
                <div className="text-sm text-purple-700 dark:text-purple-300">סה״כ לתשלום כולל ({activeAttendanceMonthSummary.label})</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-200">
                  ₪{attendancePaymentSplitSummary.total.toLocaleString("he-IL")}
                </div>
              </Card>
            </div>

            {/* Attendance Records */}
            {filteredAttendanceByMonth.length ? (
              <div className="space-y-2">
                {hasGafanAttendanceRows ? (
                  <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={attendanceTableTab === "regular" ? "default" : "ghost"}
                      onClick={() => setAttendanceTableTab("regular")}
                    >
                      רגיל ({regularAttendanceRows.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={attendanceTableTab === "gafan" ? "default" : "ghost"}
                      onClick={() => setAttendanceTableTab("gafan")}
                    >
                      גפ&quot;ן ({gafanAttendanceRows.length})
                    </Button>
                  </div>
                ) : null}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm border-collapse" dir="rtl">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border p-2 text-right font-medium">תאריך</th>
                        <th className="border p-2 text-right font-medium">בית ספר</th>
                        <th className="border p-2 text-right font-medium">קורס</th>
                        <th className="border p-2 text-center font-medium">משעה</th>
                        <th className="border p-2 text-center font-medium">עד שעה</th>
                        <th className="border p-2 text-center font-medium">סה&quot;כ שעות</th>
                        <th className="border p-2 text-center font-medium">סטטוס</th>
                        {canSeeTeacherTariffUi ? (
                          <>
                            <th className="border p-2 text-center font-medium">סוג שעה</th>
                            <th className="border p-2 text-center font-medium">תעריף לשעה</th>
                          </>
                        ) : null}
                        <th className="border p-2 text-right font-medium">הערה</th>
                        {canDeleteTeacherAttendanceRow ? <th className="border p-2 text-center font-medium w-14">מחיקה</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(attendanceTableTab === "gafan" ? gafanAttendanceRows : regularAttendanceRows).map((a: any) => {
                        const statusLabel = getStatusLabel(a.status)
                        const isPresent = statusLabel === "נוכח"
                        const isAbsent = statusLabel === "חיסור"
                        const startDisplay = courseTimeToDisplayValue(a.courseStartTime) || "—"
                        const endDisplay = courseTimeToDisplayValue(a.courseEndTime) || "—"
                        const hours = calcAttendanceHours(a)
                        return (
                          <tr key={a.id} className={isPresent ? "bg-green-50/50" : isAbsent ? "bg-red-50/50" : "bg-orange-50/50"}>
                            <td className="border p-2 text-right font-medium">{fmtDate(a.date)}</td>
                            <td className="border p-2 text-right text-muted-foreground">{a.schoolName || "—"}</td>
                            <td className="border p-2 text-right text-muted-foreground">{a.courseName ?? "—"}</td>
                            <td className="border p-2 text-center">{startDisplay}</td>
                            <td className="border p-2 text-center">{endDisplay}</td>
                            <td className="border p-2 text-center font-medium">{hours > 0 ? hours.toFixed(1) : "—"}</td>
                            <td className="border p-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isPresent ? "bg-green-100 text-green-700" :
                                isAbsent ? "bg-red-100 text-red-700" :
                                "bg-orange-100 text-orange-700"
                              }`}>{statusLabel}</span>
                            </td>
                            {canSeeTeacherTariffUi ? (
                              <>
                                <td className="border p-2 text-center text-muted-foreground">
                                  {String(a.hourKind || "").toLowerCase() === "office" ? "משרד" : "הוראה"}
                                </td>
                                <td className="border p-2 text-center font-medium tabular-nums">
                                  {a.appliedHourlyRate != null && a.appliedHourlyRate !== ""
                                    ? `₪${Number(a.appliedHourlyRate).toFixed(2)}`
                                    : "—"}
                                </td>
                              </>
                            ) : null}
                            <td className="border p-2 text-right text-muted-foreground">{a.notes || "—"}</td>
                            {canDeleteTeacherAttendanceRow ? (
                              <td className="border p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={deletingAttendanceId === a.id}
                                  onClick={() => handleDeleteAttendanceRecord(String(a.id))}
                                  aria-label="מחיקת רשומת נוכחות"
                                >
                                  {deletingAttendanceId === a.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {attendanceTableTab === "gafan" && gafanAttendanceRows.length === 0 ? (
                  <Card className="p-4 text-center text-muted-foreground">אין רשומות נוכחות גפ&quot;ן בחודש שנבחר</Card>
                ) : null}
                {attendanceTableTab === "regular" && regularAttendanceRows.length === 0 ? (
                  <Card className="p-4 text-center text-muted-foreground">אין רשומות נוכחות רגילות בחודש שנבחר</Card>
                ) : null}
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
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto" dir="rtl">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-700 dark:text-blue-400">{selectedCourse?.name}</DialogTitle>
            <DialogDescription>פרטי הקורס</DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button 
                  variant="outline" 
                  className="w-full flex-1 bg-transparent sm:w-auto"
                  onClick={() => setIsCourseDialogOpen(false)}
                >
                  סגור
                </Button>
                <Button 
                  className="w-full flex-1 bg-blue-600 hover:bg-blue-700 sm:w-auto"
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
