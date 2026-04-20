"use client"

import { useState, useEffect, useMemo, useCallback, Fragment } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Rocket,
  CalendarCheck,
  BarChart3,
  DollarSign,
  Plus,
  UserPlus,
  Trash2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, sessionRolesGrantFullAccess } from "@/lib/permissions"

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
  linkId?: string | null
  name: string
  programNumber?: string | null
  validYear?: string | null
  status?: string | null
  schoolId?: string | null
  teacherIds?: unknown
  workshopRows?: unknown
  allocatedHours?: number | string | null
  hourRows?: unknown
}

function parseGafanTeacherIds(row: GafanRow): string[] {
  const t = row.teacherIds
  if (Array.isArray(t)) return t.map((x) => String(x)).filter(Boolean)
  return []
}

type TeacherMini = { id: string; name: string }

type GafanWorkshopRow = {
  kind: string
  groupsCount: number
  studentsCount: number
  grade: string
  hours: number
  price: number
  total: number
}

function parseGafanWorkshopRows(row: GafanRow): GafanWorkshopRow[] {
  const rows = row.workshopRows
  if (!Array.isArray(rows)) return []
  return rows.map((r) => {
    const x = (r ?? {}) as Record<string, unknown>
    const hours = Number(x.hours ?? 0)
    const price = Number(x.price ?? 0)
    return {
      kind: String(x.kind ?? ""),
      groupsCount: Number(x.groupsCount ?? 1) || 1,
      studentsCount: Number(x.studentsCount ?? 1) || 1,
      grade: String(x.grade ?? ""),
      hours: Number.isFinite(hours) ? hours : 0,
      price: Number.isFinite(price) ? price : 0,
      total: Number(x.total ?? hours * price) || 0,
    }
  })
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

type GafanHourRow = {
  date: string
  dayOfWeek?: string
  startTime: string
  endTime: string
  totalHours: number
}

function parseGafanHourRows(row: GafanRow): GafanHourRow[] {
  const rows = row.hourRows
  if (!Array.isArray(rows)) return []
  return rows.map((r) => {
    const x = (r ?? {}) as Record<string, unknown>
    return {
      date: String(x.date ?? ""),
      dayOfWeek: String(x.dayOfWeek ?? ""),
      startTime: String(x.startTime ?? ""),
      endTime: String(x.endTime ?? ""),
      totalHours: Number(x.totalHours ?? 0) || 0,
    }
  })
}

const WEEKDAY_OPTIONS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

function weekdayFromDate(value: string): string {
  const normalized = String(value || "").trim()
  if (!normalized) return ""
  const d = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  return WEEKDAY_OPTIONS[d.getDay()] || ""
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

function calcHoursFromTimes(startTime: string, endTime: string): number {
  const s = String(startTime || "")
  const e = String(endTime || "")
  const m1 = /^(\d{2}):(\d{2})$/.exec(s)
  const m2 = /^(\d{2}):(\d{2})$/.exec(e)
  if (!m1 || !m2) return 0
  const startMin = Number(m1[1]) * 60 + Number(m1[2])
  const endMin = Number(m2[1]) * 60 + Number(m2[2])
  const diff = endMin - startMin
  if (!Number.isFinite(diff) || diff <= 0) return 0
  return Math.round((diff / 60) * 100) / 100
}

export default function SchoolViewPage() {
  const params = useParams()
  const id = params.id as string
  const isNewPage = id === "new"
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)

  const [gafanPrograms, setGafanPrograms] = useState<GafanRow[]>([])
  const [schoolEnrollments, setSchoolEnrollments] = useState<EnrollmentRow[]>([])
  const [schoolPayments, setSchoolPayments] = useState<PaymentRow[]>([])
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttRow[]>([])
  const [teachersMini, setTeachersMini] = useState<TeacherMini[]>([])
  const [tabDataLoading, setTabDataLoading] = useState(true)

  const [gafanLinkOpen, setGafanLinkOpen] = useState(false)
  const [gafanUnlinkedOptions, setGafanUnlinkedOptions] = useState<GafanRow[]>([])
  const [gafanLinkPickId, setGafanLinkPickId] = useState("")
  const [gafanLinkSaving, setGafanLinkSaving] = useState(false)
  const [gafanTeacherProgram, setGafanTeacherProgram] = useState<GafanRow | null>(null)
  const [gafanTeacherPickId, setGafanTeacherPickId] = useState("")
  const [gafanTeacherSaving, setGafanTeacherSaving] = useState(false)
  const [workshopProgram, setWorkshopProgram] = useState<GafanRow | null>(null)
  const [workshopKind, setWorkshopKind] = useState("סדנה כולל חומרים")
  const [workshopGroupsCount, setWorkshopGroupsCount] = useState("1")
  const [workshopStudentsCount, setWorkshopStudentsCount] = useState("1")
  const [workshopGrade, setWorkshopGrade] = useState("א")
  const [workshopHours, setWorkshopHours] = useState("1")
  const [workshopPrice, setWorkshopPrice] = useState("0")
  const [workshopSaving, setWorkshopSaving] = useState(false)
  const [hoursProgramId, setHoursProgramId] = useState("")
  const [hourDialogOpen, setHourDialogOpen] = useState(false)
  const [hourDate, setHourDate] = useState("")
  const [hourStartTime, setHourStartTime] = useState("")
  const [hourEndTime, setHourEndTime] = useState("")
  const [hourTotal, setHourTotal] = useState("0")
  const [hourEditIdx, setHourEditIdx] = useState<number | null>(null)
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState("")
  const [hoursSaving, setHoursSaving] = useState(false)
  const currentUser = useCurrentUser()
  const userPerms = currentUser?.permissions || []
  const isFullAccess = sessionRolesGrantFullAccess(currentUser?.roleKey, currentUser?.role)
  const canViewGeneralTab = isFullAccess || hasPermission(userPerms, "schools.tab.general")
  const canViewGafanTab = isFullAccess || hasPermission(userPerms, "schools.tab.gafan")
  const canViewAttendanceTab = isFullAccess || hasPermission(userPerms, "schools.tab.attendance")
  const canViewDebtorsTab = isFullAccess || hasPermission(userPerms, "schools.tab.debtors")
  const canViewPaymentsTab = isFullAccess || hasPermission(userPerms, "schools.tab.payments")
  const canEditSchool = isFullAccess || hasPermission(userPerms, "schools.edit")
  const defaultTab = canViewGeneralTab
    ? "general"
    : canViewGafanTab
      ? "gafan"
      : canViewAttendanceTab
        ? "teacher-attendance"
        : canViewDebtorsTab
          ? "debtors"
          : canViewPaymentsTab
            ? "payments"
            : "general"

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

  const reloadTabData = useCallback(async () => {
    if (isNewPage || !school?.id) return
    const sid = school.id
    setTabDataLoading(true)
    try {
      const [gRes, eRes, pRes, aRes, tRes] = await Promise.all([
        fetch(`/api/gafan?schoolId=${encodeURIComponent(sid)}`),
        fetch(`/api/enrollments?schoolId=${encodeURIComponent(sid)}`),
        fetch(`/api/payments?schoolId=${encodeURIComponent(sid)}`),
        fetch(`/api/attendance?schoolId=${encodeURIComponent(sid)}`),
        fetch(`/api/teachers`),
      ])
      setGafanPrograms(gRes.ok ? await gRes.json() : [])
      setSchoolEnrollments(eRes.ok ? await eRes.json() : [])
      setSchoolPayments(pRes.ok ? await pRes.json() : [])
      const att = aRes.ok ? await aRes.json() : []
      setTeacherAttendance(Array.isArray(att) ? att : [])
      const tJson = tRes.ok ? await tRes.json() : []
      const tArr = Array.isArray(tJson) ? tJson : []
      setTeachersMini(
        tArr.map((x: { id?: string; name?: string }) => ({
          id: String(x.id ?? ""),
          name: String(x.name ?? ""),
        })).filter((x) => x.id),
      )
    } catch {
      setGafanPrograms([])
      setSchoolEnrollments([])
      setSchoolPayments([])
      setTeacherAttendance([])
      setTeachersMini([])
    } finally {
      setTabDataLoading(false)
    }
  }, [isNewPage, school?.id])

  useEffect(() => {
    void reloadTabData()
  }, [reloadTabData])

  const teacherNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teachersMini) m.set(t.id, t.name || t.id)
    return m
  }, [teachersMini])

  useEffect(() => {
    if (hoursProgramId && !gafanPrograms.some((g) => g.id === hoursProgramId)) {
      setHoursProgramId("")
    }
  }, [gafanPrograms, hoursProgramId])

  useEffect(() => {
    const auto = calcHoursFromTimes(hourStartTime, hourEndTime)
    setHourTotal(String(auto))
  }, [hourStartTime, hourEndTime])

  const openGafanLinkDialog = async () => {
    setGafanLinkOpen(true)
    setGafanLinkPickId("")
    try {
      const res = await fetch(`/api/gafan`, { credentials: "include" })
      const all = res.ok ? await res.json() : []
      const rows = Array.isArray(all) ? all : []
      setGafanUnlinkedOptions(rows)
    } catch {
      setGafanUnlinkedOptions([])
    }
  }

  const submitGafanLink = async () => {
    if (!school?.id || !gafanLinkPickId) return
    setGafanLinkSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(gafanLinkPickId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id }),
      })
      if (res.ok) {
        setGafanLinkOpen(false)
        await reloadTabData()
      }
    } finally {
      setGafanLinkSaving(false)
    }
  }

  const submitGafanTeacher = async () => {
    if (!gafanTeacherProgram || !gafanTeacherPickId) return
    const cur = parseGafanTeacherIds(gafanTeacherProgram)
    if (cur.includes(gafanTeacherPickId)) {
      setGafanTeacherProgram(null)
      return
    }
    const next = [...cur, gafanTeacherPickId]
    setGafanTeacherSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(gafanTeacherProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school?.id, linkId: gafanTeacherProgram.linkId, teacherIds: next }),
      })
      if (res.ok) {
        setGafanTeacherProgram(null)
        setGafanTeacherPickId("")
        await reloadTabData()
      }
    } finally {
      setGafanTeacherSaving(false)
    }
  }

  const deleteGafanCard = async (program: GafanRow) => {
    if (!school?.id) return
    setGafanLinkSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(program.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: program.linkId, unlink: true }),
      })
      if (res.ok) await reloadTabData()
    } finally {
      setGafanLinkSaving(false)
    }
  }

  const submitWorkshopRow = async () => {
    if (!workshopProgram || !school?.id) return
    const current = parseGafanWorkshopRows(workshopProgram)
    const hours = Math.max(0, Number(workshopHours || 0))
    const price = Math.max(0, Number(workshopPrice || 0))
    const next = [
      ...current,
      {
        kind: workshopKind,
        groupsCount: Math.max(1, Number(workshopGroupsCount || 1)),
        studentsCount: Math.max(1, Number(workshopStudentsCount || 1)),
        grade: workshopGrade,
        hours,
        price,
        total: Math.round(hours * price * 100) / 100,
      },
    ]
    setWorkshopSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(workshopProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: workshopProgram.linkId, workshopRows: next }),
      })
      if (res.ok) {
        setWorkshopProgram(null)
        await reloadTabData()
      }
    } finally {
      setWorkshopSaving(false)
    }
  }

  const resetHourForm = () => {
    setHourDate("")
    setHourStartTime("")
    setHourEndTime("")
    setHourTotal("0")
    setHourEditIdx(null)
  }

  const saveHourRow = async () => {
    if (!hoursProgramId || !school?.id) return
    const hoursProgram = gafanPrograms.find((g) => g.id === hoursProgramId)
    if (!hoursProgram) return
    const rows = parseGafanHourRows(hoursProgram)
    const resolvedDayOfWeek = weekdayFromDate(hourDate)
    const row: GafanHourRow = {
      date: hourDate,
      dayOfWeek: resolvedDayOfWeek,
      startTime: hourStartTime,
      endTime: hourEndTime,
      totalHours: Math.max(0, Number(hourTotal || 0)),
    }
    const next = [...rows]
    if (hourEditIdx == null) next.push(row)
    else next[hourEditIdx] = row
    setHoursSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(hoursProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: hoursProgram.linkId, hourRows: next }),
      })
      if (res.ok) {
        resetHourForm()
        setHourDialogOpen(false)
        setHoursProgramId("")
        await reloadTabData()
      }
    } finally {
      setHoursSaving(false)
    }
  }

  const deleteHourRow = async (program: GafanRow, idx: number) => {
    if (!school?.id) return
    const rows = parseGafanHourRows(program)
    const next = rows.filter((_, i) => i !== idx)
    setHoursSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(program.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: program.linkId, hourRows: next }),
      })
      if (res.ok) await reloadTabData()
    } finally {
      setHoursSaving(false)
    }
  }

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

  const attendanceMonthGroups = useMemo(() => {
    const monthMap = new Map<
      string,
      { monthLabel: string; totalHours: number; rows: Array<{ date: string; startTime: string; endTime: string; totalHours: number }> }
    >()
    for (const program of gafanPrograms) {
      const rows = parseGafanHourRows(program)
      for (const row of rows) {
        const d = new Date(`${row.date}T12:00:00`)
        if (Number.isNaN(d.getTime())) continue
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(d)
        const bucket = monthMap.get(key) ?? { monthLabel, totalHours: 0, rows: [] }
        bucket.rows.push({
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          totalHours: Number(row.totalHours || 0),
        })
        bucket.totalHours += Number(row.totalHours || 0)
        monthMap.set(key, bucket)
      }
    }
    const out = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, value]) => ({
        monthKey,
        monthLabel: value.monthLabel,
        totalHours: Math.round(value.totalHours * 100) / 100,
        rows: value.rows.sort((a, b) => a.date.localeCompare(b.date)),
      }))
    return out
  }, [gafanPrograms])

  useEffect(() => {
    if (attendanceMonthGroups.length === 0) {
      setSelectedAttendanceMonth("")
      return
    }
    if (!selectedAttendanceMonth || !attendanceMonthGroups.some((g) => g.monthKey === selectedAttendanceMonth)) {
      setSelectedAttendanceMonth(attendanceMonthGroups[attendanceMonthGroups.length - 1].monthKey)
    }
  }, [attendanceMonthGroups, selectedAttendanceMonth])

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

        {canEditSchool && (
          <Link href={`/dashboard/schools/${school.id}/edit`} className="w-full shrink-0 sm:w-auto">
            <Button className="w-full gap-2 sm:w-auto">
              <Pencil className="h-4 w-4 shrink-0" />
              ערוך פרטים
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden">
        <Tabs defaultValue={defaultTab} dir="rtl">
          <div className="overflow-x-auto border-b bg-muted/30">
            <TabsList className="inline-flex h-auto min-h-10 w-max min-w-full flex-wrap justify-start gap-0 rounded-none bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-5">
              {canViewGeneralTab && (
                <TabsTrigger
                  value="general"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  כללי
                </TabsTrigger>
              )}
              {canViewGafanTab && (
                <TabsTrigger
                  value="gafan"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  תוכניות גפ&quot;ן
                </TabsTrigger>
              )}
              {canViewAttendanceTab && (
                <TabsTrigger
                  value="teacher-attendance"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  נוכחות
                </TabsTrigger>
              )}
              {canViewDebtorsTab && (
                <TabsTrigger
                  value="debtors"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  חייבים
                </TabsTrigger>
              )}
              {canViewPaymentsTab && (
                <TabsTrigger
                  value="payments"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  תשלומים
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {canViewGeneralTab && <TabsContent value="general" className="space-y-4 p-3 sm:space-y-6 sm:p-6">
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
          </TabsContent>}

          {canViewGafanTab && <TabsContent value="gafan" className="space-y-6 p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-rose-600" />
                      <h3 className="text-lg font-semibold">תוכניות גפ&quot;ן משויכות</h3>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => void openGafanLinkDialog()}
                    >
                      <Plus className="h-4 w-4" />
                      שיוך תוכנית
                    </Button>
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
                            <TableHead className="min-w-[140px] text-right">מורים</TableHead>
                            <TableHead className="min-w-[200px] text-center">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gafanPrograms.map((g) => {
                            const tids = parseGafanTeacherIds(g)
                            const workshopRows = parseGafanWorkshopRows(g)
                            const teacherLabel =
                              tids.length === 0
                                ? "—"
                                : tids.map((tid) => teacherNameById.get(tid) || tid).join(", ")
                            return (
                              <Fragment key={g.id}>
                                <TableRow key={`${g.id}-main`}>
                                  <TableCell className="font-medium">{g.name}</TableCell>
                                  <TableCell>{safe(g.programNumber)}</TableCell>
                                  <TableCell>{safe(g.validYear)}</TableCell>
                                  <TableCell>{safe(g.status)}</TableCell>
                                  <TableCell className="max-w-[220px] text-right text-sm text-muted-foreground">
                                    {teacherLabel}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                      <Button variant="outline" size="sm" asChild>
                                        <Link href={`/dashboard/gafan/${g.id}`}>צפה</Link>
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => {
                                          setGafanTeacherPickId("")
                                          setGafanTeacherProgram(g)
                                        }}
                                      >
                                        <UserPlus className="h-3.5 w-3.5" />
                                        שיוך מורה
                                      </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setHoursProgramId(g.id)
                                        resetHourForm()
                                        setHourDialogOpen(true)
                                      }}
                                    >
                                      עריכת כרטסת
                                    </Button>
                                      <Button type="button" variant="outline" size="sm" onClick={() => setWorkshopProgram(g)}>
                                        +
                                      </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      disabled={gafanLinkSaving}
                                      onClick={() => void deleteGafanCard(g)}
                                    >
                                      מחיקה
                                    </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                <TableRow key={`${g.id}-details`}>
                                  <TableCell colSpan={6}>
                                    <div className="overflow-x-auto rounded-md border bg-slate-50/50 p-2">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-right">מס׳</TableHead>
                                            <TableHead className="text-right">סדנה</TableHead>
                                            <TableHead className="text-right">קבוצות כמות</TableHead>
                                            <TableHead className="text-right">תלמידים</TableHead>
                                            <TableHead className="text-right">שכבה</TableHead>
                                            <TableHead className="text-right">שעות</TableHead>
                                            <TableHead className="text-right">מחיר</TableHead>
                                            <TableHead className="text-right">סה&quot;כ</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {workshopRows.length === 0 ? (
                                            <TableRow>
                                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                                אין שורות לתוכנית זו
                                              </TableCell>
                                            </TableRow>
                                          ) : (
                                            workshopRows.map((row, idx) => (
                                              <TableRow key={`${g.id}-row-${idx}`}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell>{safe(row.kind)}</TableCell>
                                                <TableCell>{row.groupsCount}</TableCell>
                                                <TableCell>{row.studentsCount}</TableCell>
                                                <TableCell>{safe(row.grade)}</TableCell>
                                                <TableCell>{row.hours}</TableCell>
                                                <TableCell>{Number(row.price || 0)}</TableCell>
                                                <TableCell>{Number(row.total || 0)}</TableCell>
                                              </TableRow>
                                            ))
                                          )}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Dialog open={gafanLinkOpen} onOpenChange={setGafanLinkOpen}>
                    <DialogContent dir="rtl" className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>שיוך תוכנית גפ&quot;ן לבית הספר</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label>בחר תוכנית לשיוך לבית ספר (ניתן לבחור גם תוכנית קיימת)</Label>
                          {gafanUnlinkedOptions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">כל התוכניות כבר משויכות לבית ספר זה.</p>
                          ) : (
                            <Select value={gafanLinkPickId} onValueChange={setGafanLinkPickId}>
                              <SelectTrigger>
                                <SelectValue placeholder="בחר תוכנית…" />
                              </SelectTrigger>
                              <SelectContent>
                                {gafanUnlinkedOptions.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                    {p.programNumber ? ` (${p.programNumber})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          disabled={!gafanLinkPickId || gafanLinkSaving || gafanUnlinkedOptions.length === 0}
                          onClick={() => void submitGafanLink()}
                        >
                          {gafanLinkSaving ? (
                            <>
                              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                              שומר…
                            </>
                          ) : (
                            "שמור שיוך"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={gafanTeacherProgram !== null}
                    onOpenChange={(open) => {
                      if (!open) {
                        setGafanTeacherProgram(null)
                        setGafanTeacherPickId("")
                      }
                    }}
                  >
                    <DialogContent dir="rtl" className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          שיוך מורה לתוכנית
                          {gafanTeacherProgram ? ` — ${gafanTeacherProgram.name}` : ""}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label>בחר מורה</Label>
                          {(() => {
                            const assigned = gafanTeacherProgram ? parseGafanTeacherIds(gafanTeacherProgram) : []
                            const pool = teachersMini.filter((t) => !assigned.includes(t.id))
                            if (pool.length === 0) {
                              return (
                                <p className="text-sm text-muted-foreground">
                                  {teachersMini.length === 0
                                    ? "אין מורים במערכת."
                                    : "כל המורים כבר משויכים לתוכנית זו."}
                                </p>
                              )
                            }
                            return (
                              <Select value={gafanTeacherPickId} onValueChange={setGafanTeacherPickId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="בחר מורה…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {pool.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name || t.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )
                          })()}
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          disabled={(() => {
                            const assigned = gafanTeacherProgram ? parseGafanTeacherIds(gafanTeacherProgram) : []
                            const pool = teachersMini.filter((t) => !assigned.includes(t.id))
                            return !gafanTeacherPickId || gafanTeacherSaving || pool.length === 0
                          })()}
                          onClick={() => void submitGafanTeacher()}
                        >
                          {gafanTeacherSaving ? (
                            <>
                              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                              שומר…
                            </>
                          ) : (
                            "הוסף מורה לתוכנית"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={workshopProgram !== null} onOpenChange={(open) => !open && setWorkshopProgram(null)}>
                    <DialogContent dir="rtl" className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>הוספת שורה לתוכנית</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-3 py-2 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>סדנה</Label>
                          <Select value={workshopKind} onValueChange={setWorkshopKind}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="סדנה כולל חומרים">סדנה כולל חומרים</SelectItem>
                              <SelectItem value="סדנה ללא חומרים">סדנה ללא חומרים</SelectItem>
                              <SelectItem value="הרצאה">הרצאה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>קבוצות כמות</Label>
                          <Input type="number" min={1} value={workshopGroupsCount} onChange={(e) => setWorkshopGroupsCount(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>תלמידים</Label>
                          <Input type="number" min={1} value={workshopStudentsCount} onChange={(e) => setWorkshopStudentsCount(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>שכבה</Label>
                          <Select value={workshopGrade} onValueChange={setWorkshopGrade}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["מכינה","א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב"].map((g) => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>שעות</Label>
                          <Input type="number" min={0} step="0.5" value={workshopHours} onChange={(e) => setWorkshopHours(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>מחיר</Label>
                          <Input type="number" min={0} value={workshopPrice} onChange={(e) => setWorkshopPrice(e.target.value)} />
                        </div>
                      </div>
                      <Button type="button" disabled={workshopSaving} onClick={() => void submitWorkshopRow()}>
                        {workshopSaving ? "שומר..." : "הוסף"}
                      </Button>
                    </DialogContent>
                  </Dialog>

                </div>

              </>
            )}
          </TabsContent>}

          {canViewAttendanceTab && <TabsContent value="teacher-attendance" className="p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {gafanPrograms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <CalendarCheck className="mb-4 h-12 w-12 opacity-50" />
                    <p>אין תוכניות גפ&quot;ן משויכות לבית הספר</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">רישום נוכחות מורים</div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setHoursProgramId(gafanPrograms[0]?.id || "")
                          resetHourForm()
                          setHourDialogOpen(true)
                        }}
                      >
                        הוספה
                      </Button>
                    </div>

                    {attendanceMonthGroups.length === 0 ? (
                      <div className="rounded-lg border p-6 text-center text-muted-foreground">אין נתוני נוכחות להצגה</div>
                    ) : (
                      <Tabs
                        value={selectedAttendanceMonth}
                        onValueChange={setSelectedAttendanceMonth}
                        dir="rtl"
                        className="space-y-3"
                      >
                        <TabsList className="h-auto w-full flex-wrap justify-start gap-2">
                          {attendanceMonthGroups.map((group) => (
                            <TabsTrigger key={group.monthKey} value={group.monthKey}>
                              {group.monthLabel} ({group.totalHours.toLocaleString("he-IL")})
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {attendanceMonthGroups.map((group) => (
                          <TabsContent key={group.monthKey} value={group.monthKey} className="mt-0">
                            <div className="overflow-x-auto rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-right">מס׳</TableHead>
                                    <TableHead className="text-right">תאריך</TableHead>
                                    <TableHead className="text-right">שעת התחלה</TableHead>
                                    <TableHead className="text-right">שעת סיום</TableHead>
                                    <TableHead className="text-right">סה&quot;כ שעות</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.rows.map((row, idx) => (
                                    <TableRow key={`${group.monthKey}-${idx}`}>
                                      <TableCell>{idx + 1}</TableCell>
                                      <TableCell>{safe(row.date)}</TableCell>
                                      <TableCell>{safe(row.startTime)}</TableCell>
                                      <TableCell>{safe(row.endTime)}</TableCell>
                                      <TableCell>{Number(row.totalHours || 0)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </>
                )}
                <Dialog open={hourDialogOpen} onOpenChange={setHourDialogOpen}>
                  <DialogContent dir="rtl" className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>הוספת שעות</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>תוכנית</Label>
                      <Select value={hoursProgramId} onValueChange={setHoursProgramId}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תוכנית" />
                        </SelectTrigger>
                        <SelectContent>
                          {gafanPrograms.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      <Input type="date" value={hourDate} onChange={(e) => setHourDate(e.target.value)} />
                      <Input type="time" value={hourStartTime} onChange={(e) => setHourStartTime(e.target.value)} />
                      <Input type="time" value={hourEndTime} onChange={(e) => setHourEndTime(e.target.value)} />
                      <Input type="number" min={0} step="0.25" value={hourTotal} readOnly />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" disabled={!hoursProgramId || hoursSaving} onClick={() => void saveHourRow()}>
                        הוספה
                      </Button>
                      <Button type="button" variant="outline" onClick={resetHourForm}>נקה</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </TabsContent>}

          {canViewDebtorsTab && <TabsContent value="debtors" className="p-3 sm:p-6">
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
          </TabsContent>}

          {canViewPaymentsTab && <TabsContent value="payments" className="p-3 sm:p-6">
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
          </TabsContent>}
        </Tabs>
      </Card>
    </div>
  )
}
