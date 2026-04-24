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
  CircleOff,
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
import { useUserType } from "@/lib/use-user-type"

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
  teacherRates?: unknown
  workshopRows?: unknown
  allocatedHours?: number | string | null
  hourRows?: unknown
}

function parseGafanTeacherIds(row: GafanRow): string[] {
  const t = row.teacherIds
  if (Array.isArray(t)) return t.map((x) => String(x)).filter(Boolean)
  return []
}

type GafanTeacherRate = { teachingHourlyRate: number; travelHourlyRate: number }
const DEFAULT_GAFAN_TEACHING_HOURLY_RATE = 50
const DEFAULT_GAFAN_TRAVEL_HOURLY_RATE = 30

function parseGafanTeacherRates(row: GafanRow): Record<string, GafanTeacherRate> {
  const raw = row.teacherRates
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, GafanTeacherRate> = {}
  for (const [teacherId, value] of Object.entries(raw as Record<string, unknown>)) {
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
  teacherName?: string
  teacherId?: string
  startTime: string
  endTime: string
  totalHours: number
  pendingAssignment?: boolean
}

function isSameHourRow(a: GafanHourRow, b: GafanHourRow): boolean {
  return (
    a.date === b.date &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    Number(a.totalHours || 0) === Number(b.totalHours || 0) &&
    Boolean(a.pendingAssignment) === Boolean(b.pendingAssignment)
  )
}

function parseGafanHourRows(row: GafanRow): GafanHourRow[] {
  const rows = row.hourRows
  if (!Array.isArray(rows)) return []
  return rows.map((r) => {
    const x = (r ?? {}) as Record<string, unknown>
    return {
      date: String(x.date ?? ""),
      dayOfWeek: String(x.dayOfWeek ?? ""),
      teacherName: String(x.teacherName ?? ""),
      teacherId: String(x.teacherId ?? ""),
      startTime: String(x.startTime ?? ""),
      endTime: String(x.endTime ?? ""),
      totalHours: Number(x.totalHours ?? 0) || 0,
      pendingAssignment: Boolean(x.pendingAssignment),
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

const SCHOOL_PAYOUT_PREFIX = "[SCHOOL_PAYOUT:"
const SCHOOL_CHECK_IN_PREFIX = "[SCHOOL_CHECK_IN:"
const SCHOOL_CHECK_OUT_PREFIX = "[SCHOOL_CHECK_OUT:"
const VAT_RATE = 0.18

function buildSchoolPayoutDescription(input: {
  schoolId: string
  teacherId: string
  teacherName: string
  programId: string
  programName: string
  monthKey: string
  monthLabel: string
  notes?: string
}) {
  const notesPart = input.notes ? `|notes=${encodeURIComponent(input.notes)}` : ""
  return `${SCHOOL_PAYOUT_PREFIX}${input.schoolId}]|teacherId=${encodeURIComponent(input.teacherId)}|teacherName=${encodeURIComponent(input.teacherName)}|programId=${encodeURIComponent(input.programId)}|programName=${encodeURIComponent(input.programName)}|month=${encodeURIComponent(input.monthKey)}|monthLabel=${encodeURIComponent(input.monthLabel)}${notesPart}`
}

function parseSchoolPayoutDescription(raw: string | null | undefined) {
  const text = String(raw || "")
  if (!text.startsWith(SCHOOL_PAYOUT_PREFIX)) return null
  const parts = text.split("|")
  if (parts.length === 0) return null
  const schoolId = parts[0].replace(SCHOOL_PAYOUT_PREFIX, "").replace("]", "").trim()
  const kv: Record<string, string> = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    const key = part.slice(0, eq)
    const val = part.slice(eq + 1)
    kv[key] = decodeURIComponent(val || "")
  }
  return {
    schoolId,
    teacherId: kv.teacherId || "",
    teacherName: kv.teacherName || "",
    programId: kv.programId || "",
    programName: kv.programName || "",
    monthKey: kv.month || "",
    monthLabel: kv.monthLabel || "",
    notes: kv.notes || "",
  }
}

function buildSchoolCheckInDescription(input: {
  schoolId: string
  rowId: string
  dueDate: string
  checkNumber: string
  programName: string
  amount: number
}) {
  return `${SCHOOL_CHECK_IN_PREFIX}${input.schoolId}]|rowId=${encodeURIComponent(input.rowId)}|dueDate=${encodeURIComponent(input.dueDate)}|checkNo=${encodeURIComponent(input.checkNumber)}|program=${encodeURIComponent(input.programName)}|amount=${encodeURIComponent(String(input.amount))}`
}

function parseSchoolCheckInDescription(raw: string | null | undefined) {
  const text = String(raw || "")
  if (!text.startsWith(SCHOOL_CHECK_IN_PREFIX)) return null
  const parts = text.split("|")
  if (parts.length === 0) return null
  const schoolId = parts[0].replace(SCHOOL_CHECK_IN_PREFIX, "").replace("]", "").trim()
  const kv: Record<string, string> = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    kv[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1))
  }
  return {
    schoolId,
    rowId: kv.rowId || "",
    dueDate: kv.dueDate || "",
    checkNumber: kv.checkNo || "",
    programName: kv.program || "",
    amount: Number(kv.amount || 0),
  }
}

function buildSchoolCheckOutDescription(input: {
  schoolId: string
  rowId: string
  checkNumber: string
  payee: string
  amount: number
  noVat?: boolean
}) {
  return `${SCHOOL_CHECK_OUT_PREFIX}${input.schoolId}]|rowId=${encodeURIComponent(input.rowId)}|checkNo=${encodeURIComponent(input.checkNumber)}|payee=${encodeURIComponent(input.payee)}|amount=${encodeURIComponent(String(input.amount))}|noVat=${input.noVat ? "1" : "0"}`
}

function parseSchoolCheckOutDescription(raw: string | null | undefined) {
  const text = String(raw || "")
  if (!text.startsWith(SCHOOL_CHECK_OUT_PREFIX)) return null
  const parts = text.split("|")
  if (parts.length === 0) return null
  const schoolId = parts[0].replace(SCHOOL_CHECK_OUT_PREFIX, "").replace("]", "").trim()
  const kv: Record<string, string> = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    kv[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1))
  }
  return {
    schoolId,
    rowId: kv.rowId || "",
    checkNumber: kv.checkNo || "",
    payee: kv.payee || "",
    amount: Number(kv.amount || 0),
    noVat: kv.noVat === "1",
  }
}

function normalizeAmountInput(raw: string): string {
  const clean = String(raw || "").replace(/[^\d.]/g, "")
  const parts = clean.split(".")
  if (parts.length <= 1) return parts[0] || ""
  return `${parts[0]}.${parts.slice(1).join("")}`
}

function formatAmountInput(raw: string): string {
  const normalized = normalizeAmountInput(raw)
  if (!normalized) return ""
  const [intPart, decPart] = normalized.split(".")
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  if (decPart === undefined) return withCommas
  return `${withCommas}.${decPart.slice(0, 2)}`
}

function parseAmountValue(raw: string): number {
  const n = Number(String(raw || "").replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
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
  const [gafanTeacherTeachingRate, setGafanTeacherTeachingRate] = useState(String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE))
  const [gafanTeacherOfficeRate, setGafanTeacherOfficeRate] = useState(String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE))
  const [gafanTeacherEditIds, setGafanTeacherEditIds] = useState<string[]>([])
  const [gafanTeacherEditRates, setGafanTeacherEditRates] = useState<Record<string, GafanTeacherRate>>({})
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
  const [hourEditSourceRow, setHourEditSourceRow] = useState<GafanHourRow | null>(null)
  const [hourDialogContext, setHourDialogContext] = useState<"attendance" | "ngafan">("attendance")
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState("")
  const [selectedAttendanceTeacher, setSelectedAttendanceTeacher] = useState("")
  const [pendingAssignTargetByKey, setPendingAssignTargetByKey] = useState<Record<string, string>>({})
  const [hoursSaving, setHoursSaving] = useState(false)
  const [hourSaveError, setHourSaveError] = useState("")
  const [schoolPayoutTargetKey, setSchoolPayoutTargetKey] = useState("")
  const [schoolPayoutDate, setSchoolPayoutDate] = useState(new Date().toISOString().slice(0, 10))
  const [schoolPayoutAmount, setSchoolPayoutAmount] = useState("")
  const [schoolPayoutMethod, setSchoolPayoutMethod] = useState<"cash" | "transfer" | "check">("transfer")
  const [schoolPayoutNotes, setSchoolPayoutNotes] = useState("")
  const [schoolPayoutSaving, setSchoolPayoutSaving] = useState(false)
  const [checkInDueDate, setCheckInDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [checkInNumber, setCheckInNumber] = useState("")
  const [checkInProgramName, setCheckInProgramName] = useState("")
  const [checkInAmount, setCheckInAmount] = useState("")
  const [checkInSaving, setCheckInSaving] = useState(false)
  const [checkOutTargetRowId, setCheckOutTargetRowId] = useState("")
  const [checkOutNumber, setCheckOutNumber] = useState("")
  const [checkOutPayee, setCheckOutPayee] = useState("")
  const [checkOutAmount, setCheckOutAmount] = useState("")
  const [checkOutSaving, setCheckOutSaving] = useState(false)
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false)
  const [checkModalType, setCheckModalType] = useState<"credit" | "debit">("credit")
  const currentUser = useCurrentUser()
  const { data: currentUserTypeData } = useUserType(currentUser?.id, currentUser?.roleKey ?? currentUser?.role)
  const currentTeacherId = currentUserTypeData?.teacherId ? String(currentUserTypeData.teacherId) : ""
  const userPerms = currentUser?.permissions || []
  const isFullAccess = sessionRolesGrantFullAccess(currentUser?.roleKey, currentUser?.role)
  const canViewGeneralTab = isFullAccess || hasPermission(userPerms, "schools.tab.general")
  const canViewGafanTab = isFullAccess || hasPermission(userPerms, "schools.tab.gafan")
  const roleToken = (currentUser?.roleKey ?? currentUser?.role ?? "").toString().trim().toLowerCase()
  const isTeacherRole = roleToken === "teacher" || roleToken.includes("teacher") || roleToken.includes("מורה")
  const teacherSelfNames = useMemo<string[]>(() => {
    if (!isTeacherRole) return []
    const names = [currentUser?.full_name, currentUser?.username]
      .map((n) => (n ?? "").toString().trim().toLowerCase())
      .filter((n) => n.length > 0)
    return Array.from(new Set(names))
  }, [isTeacherRole, currentUser?.full_name, currentUser?.username])
  const rowBelongsToCurrentTeacher = useCallback(
    (teacherName: string | null | undefined) => {
      if (!isTeacherRole) return true
      const normalized = (teacherName ?? "").toString().trim().toLowerCase()
      if (!normalized) return false
      return teacherSelfNames.includes(normalized)
    },
    [isTeacherRole, teacherSelfNames],
  )
  const canViewNgafanTab =
    !isTeacherRole && (isFullAccess || hasPermission(userPerms, "schools.tab.ngafan"))
  const canViewAttendanceTab = isFullAccess || hasPermission(userPerms, "schools.tab.attendance")
  const canViewDebtorsTab =
    isFullAccess ||
    hasPermission(userPerms, "schools.tab.debtors") ||
    hasPermission(userPerms, "schools.tab.debtors.view") ||
    hasPermission(userPerms, "schools.tab.debtors.edit") ||
    hasPermission(userPerms, "schools.tab.debtors.delete")
  const canEditDebtorsTab =
    isFullAccess || hasPermission(userPerms, "schools.tab.debtors.edit") || hasPermission(userPerms, "schools.tab.debtors.delete")
  const canDeleteDebtorsTab = isFullAccess || hasPermission(userPerms, "schools.tab.debtors.delete")

  const canViewPaymentsTab =
    isFullAccess ||
    hasPermission(userPerms, "schools.tab.payments") ||
    hasPermission(userPerms, "schools.tab.payments.view") ||
    hasPermission(userPerms, "schools.tab.payments.edit") ||
    hasPermission(userPerms, "schools.tab.payments.delete")
  const canEditPaymentsTab =
    isFullAccess || hasPermission(userPerms, "schools.tab.payments.edit") || hasPermission(userPerms, "schools.tab.payments.delete")
  const canDeletePaymentsTab = isFullAccess || hasPermission(userPerms, "schools.tab.payments.delete")
  const canEditSchool = isFullAccess || hasPermission(userPerms, "schools.edit")
  const defaultTab = canViewGeneralTab
    ? "general"
    : canViewGafanTab
      ? "gafan"
      : canViewNgafanTab
        ? "ngafan"
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
    const ts = Date.now()
    setTabDataLoading(true)
    try {
      const [gRes, eRes, pRes, aRes, tRes] = await Promise.all([
        fetch(`/api/gafan?schoolId=${encodeURIComponent(sid)}&_ts=${ts}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/enrollments?schoolId=${encodeURIComponent(sid)}&_ts=${ts}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/payments?schoolId=${encodeURIComponent(sid)}&_ts=${ts}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/attendance?schoolId=${encodeURIComponent(sid)}&_ts=${ts}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/teachers?_ts=${ts}`, { cache: "no-store", credentials: "include" }),
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
    const currentRates = parseGafanTeacherRates(gafanTeacherProgram)
    if (cur.includes(gafanTeacherPickId)) {
      setGafanTeacherProgram(null)
      return
    }
    const next = [...cur, gafanTeacherPickId]
    const nextRates = {
      ...currentRates,
      [gafanTeacherPickId]: {
        teachingHourlyRate: Math.max(0, Number(gafanTeacherTeachingRate || DEFAULT_GAFAN_TEACHING_HOURLY_RATE)),
        travelHourlyRate: Math.max(0, Number(gafanTeacherOfficeRate || DEFAULT_GAFAN_TRAVEL_HOURLY_RATE)),
      },
    }
    setGafanTeacherSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(gafanTeacherProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: school?.id,
          linkId: gafanTeacherProgram.linkId,
          teacherIds: next,
          teacherRates: nextRates,
        }),
      })
      if (res.ok) {
        setGafanTeacherProgram(null)
        setGafanTeacherPickId("")
        setGafanTeacherTeachingRate(String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE))
        setGafanTeacherOfficeRate(String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE))
        await reloadTabData()
      }
    } finally {
      setGafanTeacherSaving(false)
    }
  }

  const saveGafanTeacherAssignments = async () => {
    if (!gafanTeacherProgram) return
    const nextIds = gafanTeacherEditIds.filter(Boolean)
    const nextRates: Record<string, GafanTeacherRate> = {}
    nextIds.forEach((tid) => {
      const rr = gafanTeacherEditRates[tid]
      nextRates[tid] = {
        teachingHourlyRate: Math.max(0, Number(rr?.teachingHourlyRate ?? DEFAULT_GAFAN_TEACHING_HOURLY_RATE)),
        travelHourlyRate: Math.max(0, Number(rr?.travelHourlyRate ?? DEFAULT_GAFAN_TRAVEL_HOURLY_RATE)),
      }
    })
    setGafanTeacherSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(gafanTeacherProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: school?.id,
          linkId: gafanTeacherProgram.linkId,
          teacherIds: nextIds,
          teacherRates: nextRates,
        }),
      })
      if (res.ok) {
        setGafanTeacherProgram(null)
        setGafanTeacherPickId("")
        setGafanTeacherTeachingRate(String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE))
        setGafanTeacherOfficeRate(String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE))
        setGafanTeacherEditIds([])
        setGafanTeacherEditRates({})
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
    setHourEditSourceRow(null)
    setHourSaveError("")
  }

  const saveHourRow = async () => {
    setHourSaveError("")
    if (!school?.id) return
    if (!hourDate) {
      setHourSaveError("יש לבחור תאריך תקין.")
      return
    }
    if (!hourStartTime || !hourEndTime) {
      setHourSaveError("יש לבחור שעת התחלה ושעת סיום.")
      return
    }
    const computedHours = calcHoursFromTimes(hourStartTime, hourEndTime)
    if (!Number.isFinite(computedHours) || computedHours <= 0) {
      setHourSaveError("טווח השעות לא תקין. שעת סיום חייבת להיות אחרי שעת התחלה.")
      return
    }
    const holderProgramId = hourDialogContext === "attendance" ? (hoursProgramId || gafanPrograms[0]?.id || "") : hoursProgramId
    if (!holderProgramId) return
    const hoursProgram = gafanPrograms.find((g) => g.id === holderProgramId)
    if (!hoursProgram) return
    const rows = parseGafanHourRows(hoursProgram)
    const assignedTeacherIds = parseGafanTeacherIds(hoursProgram)
    const fallbackTeacherId = assignedTeacherIds[0] ? String(assignedTeacherIds[0]) : ""
    const fallbackTeacherName = fallbackTeacherId ? (teacherNameById.get(fallbackTeacherId) || "") : ""
    const resolvedDayOfWeek = weekdayFromDate(hourDate)
    const row: GafanHourRow = {
      date: hourDate,
      dayOfWeek: resolvedDayOfWeek,
      teacherName: currentUser?.full_name || currentUser?.username || fallbackTeacherName || "",
      teacherId: currentTeacherId || fallbackTeacherId,
      startTime: hourStartTime,
      endTime: hourEndTime,
      totalHours: Math.max(0, Number(computedHours || hourTotal || 0)),
      pendingAssignment: hourDialogContext === "attendance",
    }
    const next = [...rows]
    if (hourEditIdx != null && hourEditIdx >= 0 && hourEditIdx < next.length) {
      next[hourEditIdx] = row
    } else if (hourEditSourceRow) {
      const fallbackIdx = next.findIndex((x) => isSameHourRow(x, hourEditSourceRow))
      if (fallbackIdx >= 0) next[fallbackIdx] = row
      else next.push(row)
    } else {
      next.push(row)
    }
    setHoursSaving(true)
    try {
      const res = await fetch(`/api/gafan/${encodeURIComponent(hoursProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: hoursProgram.linkId, hourRows: next }),
      })
      if (res.ok) {
        const rowDate = new Date(`${row.date}T12:00:00`)
        if (!Number.isNaN(rowDate.getTime())) {
          const monthKey = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}`
          setSelectedAttendanceMonth(monthKey)
        }
        resetHourForm()
        setHourDialogOpen(false)
        setHoursProgramId("")
        await reloadTabData()
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setHourSaveError(body?.error?.trim() || "שמירת הנוכחות נכשלה. נסה שוב.")
      }
    } catch (err) {
      console.error("saveHourRow error:", err)
      setHourSaveError("אירעה שגיאת רשת בזמן השמירה. בדוק חיבור ונסה שוב.")
    } finally {
      setHoursSaving(false)
    }
  }

  const deleteHourRow = async (program: GafanRow, idx: number, sourceRow?: GafanHourRow) => {
    if (!school?.id) return
    const rows = parseGafanHourRows(program)
    let targetIdx = Number.isInteger(idx) && idx >= 0 && idx < rows.length ? idx : -1
    if (targetIdx < 0 && sourceRow) {
      targetIdx = rows.findIndex((x) => isSameHourRow(x, sourceRow))
    }
    if (targetIdx < 0) return
    const next = rows.filter((_, i) => i !== targetIdx)
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

  const attendanceByTeacher = useMemo(() => {
    type AttendanceRow = {
      programId: string
      programName: string
      rowIndex: number
      date: string
      dayOfWeek: string
      teacherName: string
      teacherId: string
      startTime: string
      endTime: string
      totalHours: number
      status: "approved" | "pending"
      teacherRoleLabel: string
    }
    type MonthBucket = {
      monthKey: string
      monthLabel: string
      totalHours: number
      approvedHours: number
      rows: AttendanceRow[]
    }
    type TeacherBucket = {
      teacherKey: string
      teacherDisplayName: string
      totalHours: number
      approvedHours: number
      monthMap: Map<string, MonthBucket>
    }
    const teacherMap = new Map<string, TeacherBucket>()
    for (const program of gafanPrograms) {
      const rows = parseGafanHourRows(program)
      const programIndex = gafanPrograms.findIndex((g) => g.id === program.id)
      const programSerial = programIndex >= 0 ? programIndex + 1 : 0
      const programName = `${program.name}${programSerial ? ` (#${programSerial})` : ""}`
      const programTeacherIds = parseGafanTeacherIds(program)
      const programTeacherNames = programTeacherIds.map((tid) =>
        (teacherNameById.get(tid) || tid || "").toString().trim().toLowerCase(),
      )
      rows.forEach((row, rowIndex) => {
        if (!rowBelongsToCurrentTeacher(row.teacherName)) return
        const displayName = (row.teacherName || "").trim() || "ללא שם"
        const teacherKey = displayName.toLowerCase()
        const teacherPositionInProgram = programTeacherNames.indexOf(teacherKey)
        const teacherRoleLabel =
          programTeacherIds.length === 0 || teacherPositionInProgram < 0
            ? ""
            : teacherPositionInProgram === 0
              ? "ראשי"
              : "מחליף"
        const d = new Date(`${row.date}T12:00:00`)
        const isValidDate = !Number.isNaN(d.getTime())
        const monthKey = isValidDate
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : "unknown"
        const monthLabel = isValidDate
          ? new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(d)
          : "ללא תאריך תקין"

        let teacher = teacherMap.get(teacherKey)
        if (!teacher) {
          teacher = {
            teacherKey,
            teacherDisplayName: displayName,
            totalHours: 0,
            approvedHours: 0,
            monthMap: new Map(),
          }
          teacherMap.set(teacherKey, teacher)
        }
        let bucket = teacher.monthMap.get(monthKey)
        if (!bucket) {
          bucket = { monthKey, monthLabel, totalHours: 0, approvedHours: 0, rows: [] }
          teacher.monthMap.set(monthKey, bucket)
        }
        const hrs = Number(row.totalHours || 0)
        const status: "approved" | "pending" = row.pendingAssignment ? "pending" : "approved"
        bucket.rows.push({
          programId: program.id,
          programName,
          rowIndex,
          date: row.date,
          dayOfWeek: row.dayOfWeek || weekdayFromDate(row.date),
          teacherName: row.teacherName || "",
          teacherId: row.teacherId || "",
          startTime: row.startTime,
          endTime: row.endTime,
          totalHours: hrs,
          status,
          teacherRoleLabel,
        })
        bucket.totalHours += hrs
        teacher.totalHours += hrs
        if (status === "approved") {
          bucket.approvedHours += hrs
          teacher.approvedHours += hrs
        }
      })
    }
    return Array.from(teacherMap.values())
      .map((t) => {
        const months = Array.from(t.monthMap.values())
          .sort((a, b) => {
            if (a.monthKey === "unknown") return 1
            if (b.monthKey === "unknown") return -1
            return a.monthKey.localeCompare(b.monthKey)
          })
          .map((m) => ({
            ...m,
            totalHours: Math.round(m.totalHours * 100) / 100,
            approvedHours: Math.round(m.approvedHours * 100) / 100,
            rows: m.rows.sort((a, b) => a.date.localeCompare(b.date)),
          }))
        return {
          teacherKey: t.teacherKey,
          teacherDisplayName: t.teacherDisplayName,
          totalHours: Math.round(t.totalHours * 100) / 100,
          approvedHours: Math.round(t.approvedHours * 100) / 100,
          months,
        }
      })
      .sort((a, b) =>
        a.teacherDisplayName.localeCompare(b.teacherDisplayName, "he", { sensitivity: "base" }),
      )
  }, [gafanPrograms, rowBelongsToCurrentTeacher, teacherNameById])

  const pendingAttendanceRows = useMemo(() => {
    const out: Array<{
      key: string
      holderProgramId: string
      holderProgramName: string
      rowIndex: number
      row: GafanHourRow
    }> = []
    for (const program of gafanPrograms) {
      const rows = parseGafanHourRows(program)
      rows.forEach((row, idx) => {
        if (!row.pendingAssignment) return
        if (!rowBelongsToCurrentTeacher(row.teacherName)) return
        out.push({
          key: `${program.id}::${idx}`,
          holderProgramId: program.id,
          holderProgramName: program.name,
          rowIndex: idx,
          row,
        })
      })
    }
    return out.sort((a, b) => a.row.date.localeCompare(b.row.date))
  }, [gafanPrograms, rowBelongsToCurrentTeacher])

  const assignPendingAttendanceRow = async (rowKey: string) => {
    if (!school?.id) return
    const pending = pendingAttendanceRows.find((r) => r.key === rowKey)
    const targetProgramId = pendingAssignTargetByKey[rowKey]
    if (!pending || !targetProgramId) return
    const sourceProgram = gafanPrograms.find((g) => g.id === pending.holderProgramId)
    const targetProgram = gafanPrograms.find((g) => g.id === targetProgramId)
    if (!sourceProgram || !targetProgram) return

    setHoursSaving(true)
    try {
      if (targetProgramId === pending.holderProgramId) {
        const sourceRowsAfterApprove = parseGafanHourRows(sourceProgram).map((r, idx) =>
          idx === pending.rowIndex ? { ...r, pendingAssignment: false } : r,
        )
        const sourceRes = await fetch(`/api/gafan/${encodeURIComponent(sourceProgram.id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId: school.id, linkId: sourceProgram.linkId, hourRows: sourceRowsAfterApprove }),
        })
        if (!sourceRes.ok) throw new Error("failed approving row in source")
        setPendingAssignTargetByKey((prev) => {
          const next = { ...prev }
          delete next[rowKey]
          return next
        })
        await reloadTabData()
        return
      }

      const sourceRows = parseGafanHourRows(sourceProgram).filter((_, idx) => idx !== pending.rowIndex)
      const sourceRes = await fetch(`/api/gafan/${encodeURIComponent(sourceProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: sourceProgram.linkId, hourRows: sourceRows }),
      })
      if (!sourceRes.ok) throw new Error("failed updating source")

      const targetRows = parseGafanHourRows(targetProgram)
      const assignedRow: GafanHourRow = { ...pending.row, pendingAssignment: false }
      const targetRes = await fetch(`/api/gafan/${encodeURIComponent(targetProgram.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, linkId: targetProgram.linkId, hourRows: [...targetRows, assignedRow] }),
      })
      if (!targetRes.ok) throw new Error("failed updating target")

      setPendingAssignTargetByKey((prev) => {
        const next = { ...prev }
        delete next[rowKey]
        return next
      })
      await reloadTabData()
    } finally {
      setHoursSaving(false)
    }
  }

  const createSchoolPayout = async () => {
    if (!canEditPaymentsTab) return
    if (!school?.id || !schoolPayoutTargetKey || !schoolPayoutDate) return
    const target = teacherProgramMonthlyRows.find((r) => r.key === schoolPayoutTargetKey)
    if (!target) return
    const amount = parseAmountValue(schoolPayoutAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("יש להזין סכום תשלום תקין")
      return
    }
    const description = buildSchoolPayoutDescription({
      schoolId: school.id,
      teacherId: target.teacherId,
      teacherName: target.teacherName,
      programId: target.programId,
      programName: target.programName,
      monthKey: target.monthKey,
      monthLabel: target.monthLabel,
      notes: schoolPayoutNotes.trim() || undefined,
    })
    setSchoolPayoutSaving(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: null,
          amount,
          date: schoolPayoutDate,
          paymentType: schoolPayoutMethod,
          description,
        }),
      })
      if (!res.ok) throw new Error("failed")
      setSchoolPayoutAmount("")
      setSchoolPayoutNotes("")
      await reloadTabData()
    } catch {
      alert("שגיאה בשמירת תשלום לבית הספר")
    } finally {
      setSchoolPayoutSaving(false)
    }
  }

  const createSchoolCheckIn = async () => {
    if (!canEditDebtorsTab) return false
    if (!school?.id || !checkInDueDate) return false
    const amount = parseAmountValue(checkInAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("יש להזין סכום שיק תקין")
      return false
    }
    if (!checkInNumber.trim()) {
      alert("יש להזין מספר שיק מצד בית הספר")
      return false
    }
    const rowId = crypto.randomUUID()
    const description = buildSchoolCheckInDescription({
      schoolId: school.id,
      rowId,
      dueDate: checkInDueDate,
      checkNumber: checkInNumber.trim(),
      programName: checkInProgramName.trim() || "ללא תוכנית",
      amount,
    })
    setCheckInSaving(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: null,
          amount,
          date: checkInDueDate,
          paymentType: "check",
          description,
        }),
      })
      if (!res.ok) throw new Error("failed")
      setCheckInNumber("")
      setCheckInProgramName("")
      setCheckInAmount("")
      await reloadTabData()
      return true
    } catch {
      alert("שגיאה בשמירת שיק בית ספר")
      return false
    } finally {
      setCheckInSaving(false)
    }
  }

  const createSchoolCheckOut = async () => {
    if (!canEditDebtorsTab) return false
    if (!school?.id || !checkOutTargetRowId) return false
    const amount = parseAmountValue(checkOutAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("יש להזין סכום שיק בצד שלך")
      return false
    }
    if (!checkOutNumber.trim()) {
      alert("יש להזין מספר שיק בצד שלך")
      return false
    }
    if (!checkOutPayee.trim()) {
      alert("יש להזין למי מיועד השיק")
      return false
    }
    const description = buildSchoolCheckOutDescription({
      schoolId: school.id,
      rowId: checkOutTargetRowId,
      checkNumber: checkOutNumber.trim(),
      payee: checkOutPayee.trim(),
      amount,
      noVat: false,
    })
    setCheckOutSaving(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: null,
          amount,
          date: new Date().toISOString().slice(0, 10),
          paymentType: "check",
          description,
        }),
      })
      if (!res.ok) throw new Error("failed")
      setCheckOutNumber("")
      setCheckOutPayee("")
      setCheckOutAmount("")
      await reloadTabData()
      return true
    } catch {
      alert("שגיאה בשמירת שיק בצד שלך")
      return false
    } finally {
      setCheckOutSaving(false)
    }
  }

  const submitCheckFromModal = async () => {
    const ok = checkModalType === "credit"
      ? await createSchoolCheckIn()
      : await createSchoolCheckOut()
    if (ok) setIsCheckModalOpen(false)
  }

  const updateSchoolCheckIn = async (paymentId: string, meta: NonNullable<ReturnType<typeof parseSchoolCheckInDescription>>) => {
    if (!canEditDebtorsTab) return
    if (!school?.id || !paymentId) return
    const dueDate = window.prompt("תאריך פרעון (YYYY-MM-DD)", meta.dueDate || "")?.trim()
    if (!dueDate) return
    const checkNumber = window.prompt("מספר שיק (בית ספר)", meta.checkNumber || "")?.trim()
    if (!checkNumber) return
    const programName = window.prompt("שם תוכנית", meta.programName || "")?.trim() || "ללא תוכנית"
    const amountRaw = window.prompt("סכום", String(meta.amount || 0))?.trim()
    if (!amountRaw) return
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("סכום לא תקין")
      return
    }
    const description = buildSchoolCheckInDescription({
      schoolId: school.id,
      rowId: meta.rowId,
      dueDate,
      checkNumber,
      programName,
      amount,
    })
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentDate: dueDate,
          paymentType: "check",
          description,
        }),
      })
      if (!res.ok) throw new Error("failed")
      await reloadTabData()
    } catch {
      alert("שגיאה בעדכון שיק בית ספר")
    }
  }

  const updateSchoolCheckOut = async (
    paymentId: string,
    paymentDate: string,
    meta: NonNullable<ReturnType<typeof parseSchoolCheckOutDescription>>,
  ) => {
    if (!canEditDebtorsTab) return
    if (!school?.id || !paymentId) return
    const checkNumber = window.prompt("מספר שיק (צד שלי)", meta.checkNumber || "")?.trim()
    if (!checkNumber) return
    const payee = window.prompt("למי מיועד השיק", meta.payee || "")?.trim()
    if (!payee) return
    const amountRaw = window.prompt("סכום", String(meta.amount || 0))?.trim()
    if (!amountRaw) return
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("סכום לא תקין")
      return
    }
    const description = buildSchoolCheckOutDescription({
      schoolId: school.id,
      rowId: meta.rowId,
      checkNumber,
      payee,
      amount,
      noVat: Boolean(meta.noVat),
    })
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentDate: paymentDate ? String(paymentDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
          paymentType: "check",
          description,
        }),
      })
      if (!res.ok) throw new Error("failed")
      await reloadTabData()
    } catch {
      alert("שגיאה בעדכון שיק בצד שלי")
    }
  }

  const deleteSchoolCheckPayment = async (paymentId: string) => {
    if (!canDeleteDebtorsTab) return
    if (!paymentId) return
    if (!window.confirm("למחוק את השיק?")) return
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("failed")
      await reloadTabData()
    } catch {
      alert("שגיאה במחיקת שיק")
    }
  }

  const toggleSchoolCheckOutVatZero = async (
    paymentId: string,
    paymentDate: string,
    meta: NonNullable<ReturnType<typeof parseSchoolCheckOutDescription>>,
  ) => {
    if (!canEditDebtorsTab) return
    if (!school?.id || !paymentId) return
    const description = buildSchoolCheckOutDescription({
      schoolId: school.id,
      rowId: meta.rowId,
      checkNumber: meta.checkNumber || "",
      payee: meta.payee || "",
      amount: Number(meta.amount || 0),
      noVat: !Boolean(meta.noVat),
    })
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(meta.amount || 0),
          paymentDate: paymentDate ? String(paymentDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
          paymentType: "check",
          description,
        }),
      })
      if (!res.ok) throw new Error("failed")
      await reloadTabData()
    } catch {
      alert("שגיאה בעדכון מע\"מ לשיק")
    }
  }

  const editPayoutRow = (rowKey: string) => {
    if (!canEditPaymentsTab) return
    const row = teacherProgramMonthlyRows.find((r) => r.key === rowKey)
    if (!row) return
    setSchoolPayoutTargetKey(row.key)
    setSchoolPayoutMethod("transfer")
    setSchoolPayoutDate(new Date().toISOString().slice(0, 10))
    setSchoolPayoutAmount(String(Math.max(0, Number(row.balance || 0))))
    setSchoolPayoutNotes(`עדכון תשלום עבור ${row.teacherName} | ${row.programName} | ${row.monthLabel}`)
  }

  const deletePayoutRowPayments = async (rowKey: string) => {
    if (!canDeletePaymentsTab) return
    const row = teacherProgramMonthlyRows.find((r) => r.key === rowKey)
    if (!row || row.payoutPaymentIds.length === 0) return
    if (!window.confirm(`למחוק ${row.payoutPaymentIds.length} תשלומים משויכים לשורה זו?`)) return
    try {
      await Promise.all(
        row.payoutPaymentIds.map((pid) =>
          fetch(`/api/payments/${encodeURIComponent(pid)}`, {
            method: "DELETE",
            credentials: "include",
          }),
        ),
      )
      await reloadTabData()
    } catch {
      alert("שגיאה במחיקת תשלומים מהשורה")
    }
  }

  useEffect(() => {
    if (attendanceByTeacher.length === 0) {
      setSelectedAttendanceTeacher("")
      return
    }
    if (
      !selectedAttendanceTeacher ||
      !attendanceByTeacher.some((t) => t.teacherKey === selectedAttendanceTeacher)
    ) {
      setSelectedAttendanceTeacher(attendanceByTeacher[0].teacherKey)
    }
  }, [attendanceByTeacher, selectedAttendanceTeacher])

  const activeAttendanceTeacher =
    attendanceByTeacher.find((t) => t.teacherKey === selectedAttendanceTeacher) ||
    attendanceByTeacher[0]
  const activeTeacherMonths = activeAttendanceTeacher?.months ?? []

  useEffect(() => {
    if (activeTeacherMonths.length === 0) {
      setSelectedAttendanceMonth("")
      return
    }
    if (
      !selectedAttendanceMonth ||
      !activeTeacherMonths.some((m) => m.monthKey === selectedAttendanceMonth)
    ) {
      setSelectedAttendanceMonth(activeTeacherMonths[activeTeacherMonths.length - 1].monthKey)
    }
  }, [activeTeacherMonths, selectedAttendanceMonth])

  const activeAttendanceMonth =
    (activeTeacherMonths.some((m) => m.monthKey === selectedAttendanceMonth)
      ? selectedAttendanceMonth
      : activeTeacherMonths[activeTeacherMonths.length - 1]?.monthKey) || ""

  const teacherProgramMonthlyRows = useMemo(() => {
    type Row = {
      key: string
      teacherId: string
      teacherName: string
      programId: string
      programName: string
      monthKey: string
      monthLabel: string
      hours: number
      hourlyRate: number
      plannedAmount: number
      paidAmount: number
      balance: number
      payoutPaymentIds: string[]
    }
    const bucket = new Map<string, Row>()
    for (const program of gafanPrograms) {
      const programName = String(program.name || "—")
      const workshopRows = parseGafanWorkshopRows(program)
      const programHourlyRate =
        workshopRows
          .map((w) => Number(w.price || 0))
          .find((n) => Number.isFinite(n) && n > 0) || 0
      const assignedTeacherIds = parseGafanTeacherIds(program)
      const rows = parseGafanHourRows(program).filter((r) => !r.pendingAssignment)
      for (const row of rows) {
        const d = new Date(`${String(row.date || "").trim()}T12:00:00`)
        if (Number.isNaN(d.getTime())) continue
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "numeric", year: "numeric" }).format(d)
        const teacherIdFromRow = String(row.teacherId || "").trim()
        let teacherId = teacherIdFromRow
        if (!teacherId && assignedTeacherIds.length === 1) teacherId = assignedTeacherIds[0] || ""
        const teacherName = String(row.teacherName || "").trim() || (teacherId ? (teacherNameById.get(teacherId) || teacherId) : "ללא מורה")
        const rate = Number(programHourlyRate || 0)
        const key = `${teacherId || teacherName}|${program.id}|${monthKey}`
        const item = bucket.get(key) || {
          key,
          teacherId,
          teacherName,
          programId: program.id,
          programName,
          monthKey,
          monthLabel,
          hours: 0,
          hourlyRate: rate,
          plannedAmount: 0,
          paidAmount: 0,
          balance: 0,
          payoutPaymentIds: [],
        }
        const hrs = Number(row.totalHours || 0)
        item.hours += hrs
        item.hourlyRate = rate
        item.plannedAmount = item.hours * item.hourlyRate
        bucket.set(key, item)
      }
    }
    const payoutRows = schoolPayments
      .filter((p) => !p.studentId)
      .map((p) => ({
        paymentId: String(p.id || ""),
        amount: Number(p.amount || 0),
        meta: parseSchoolPayoutDescription(p.description || ""),
      }))
      .filter((x) => x.meta && String(x.meta.schoolId) === String(school?.id || "")) as Array<{
        paymentId: string
        amount: number
        meta: NonNullable<ReturnType<typeof parseSchoolPayoutDescription>>
      }>
    for (const pay of payoutRows) {
      const k = `${pay.meta.teacherId || pay.meta.teacherName}|${pay.meta.programId}|${pay.meta.monthKey}`
      const item = bucket.get(k)
      if (!item) continue
      item.paidAmount += pay.amount
      if (pay.paymentId) item.payoutPaymentIds.push(pay.paymentId)
    }
    const out = Array.from(bucket.values()).map((r) => {
      const hours = Math.round(r.hours * 100) / 100
      const plannedAmount = Math.round(r.plannedAmount * 100) / 100
      const paidAmount = Math.round(r.paidAmount * 100) / 100
      return {
        ...r,
        hours,
        plannedAmount,
        paidAmount,
        balance: Math.round((plannedAmount - paidAmount) * 100) / 100,
      }
    })
    out.sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.teacherName.localeCompare(b.teacherName, "he", { sensitivity: "base" }) || a.programName.localeCompare(b.programName, "he", { sensitivity: "base" }))
    return out
  }, [gafanPrograms, schoolPayments, school?.id, teacherNameById])

  const schoolPayoutTotals = useMemo(() => {
    const planned = teacherProgramMonthlyRows.reduce((s, r) => s + r.plannedAmount, 0)
    const paid = teacherProgramMonthlyRows.reduce((s, r) => s + r.paidAmount, 0)
    const balance = planned - paid
    return { planned, paid, balance }
  }, [teacherProgramMonthlyRows])

  const schoolChecksRows = useMemo(() => {
    const inRows = schoolPayments
      .filter((p) => !p.studentId)
      .map((p) => ({ paymentId: String(p.id || ""), paymentDate: String(p.paymentDate || ""), meta: parseSchoolCheckInDescription(p.description || "") }))
      .filter((x) => x.meta && String(x.meta.schoolId) === String(school?.id || "")) as Array<{
        paymentId: string
        paymentDate: string
        meta: NonNullable<ReturnType<typeof parseSchoolCheckInDescription>>
      }>
    const outRows = schoolPayments
      .filter((p) => !p.studentId)
      .map((p) => ({ paymentId: String(p.id || ""), paymentDate: String(p.paymentDate || ""), meta: parseSchoolCheckOutDescription(p.description || "") }))
      .filter((x) => x.meta && String(x.meta.schoolId) === String(school?.id || "")) as Array<{
        paymentId: string
        paymentDate: string
        meta: NonNullable<ReturnType<typeof parseSchoolCheckOutDescription>>
      }>
    const outByRowId = new Map<string, Array<{ paymentId: string; paymentDate: string; checkNumber: string; payee: string; amount: number; noVat: boolean }>>()
    for (const row of outRows) {
      const key = String(row.meta.rowId || "")
      if (!key) continue
      const arr = outByRowId.get(key) || []
      arr.push({
        paymentId: row.paymentId,
        paymentDate: row.paymentDate,
        checkNumber: row.meta.checkNumber || "",
        payee: row.meta.payee || "",
        amount: Number(row.meta.amount || 0),
        noVat: Boolean(row.meta.noVat),
      })
      outByRowId.set(key, arr)
    }
    const rows = inRows
      .map((row, idx) => {
        const rowId = String(row.meta.rowId || row.paymentId)
        const myChecks = outByRowId.get(rowId) || []
        const paid = myChecks.reduce((s, r) => s + Number(r.amount || 0), 0)
        const schoolAmount = Number(row.meta.amount || 0)
        const balance = Math.round((schoolAmount - paid) * 100) / 100
        const schoolVat = Math.round((schoolAmount * VAT_RATE) * 100) / 100
        const myVat = Math.round((myChecks.reduce((s, m) => s + (m.noVat ? 0 : Number(m.amount || 0) * VAT_RATE), 0)) * 100) / 100
        const vatBalance = Math.round((schoolVat - myVat) * 100) / 100
        return {
          serial: idx + 1,
          rowId,
          paymentId: row.paymentId,
          meta: row.meta,
          dueDate: row.meta.dueDate || row.paymentDate?.slice(0, 10) || "",
          checkNumber: row.meta.checkNumber || "",
          programName: row.meta.programName || "—",
          schoolAmount,
          schoolVat,
          myAmount: paid,
          myVat,
          vatBalance,
          myChecks,
          balance,
        }
      })
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    const totalSchool = rows.reduce((s, r) => s + r.schoolAmount, 0)
    const totalMine = rows.reduce((s, r) => s + r.myChecks.reduce((x, m) => x + Number(m.amount || 0), 0), 0)
    return { rows, totalSchool, totalMine, totalBalance: Math.round((totalSchool - totalMine) * 100) / 100 }
  }, [schoolPayments, school?.id])

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
            <TabsList className="inline-flex h-auto min-h-10 w-max min-w-full flex-wrap justify-start gap-0 rounded-none bg-transparent p-0 sm:flex sm:w-full">
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
              {canViewNgafanTab && (
                <TabsTrigger
                  value="ngafan"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  נ.גפ&quot;ן
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
              {canViewDebtorsTab && (
                <TabsTrigger
                  value="debtors"
                  className="rounded-none px-3 py-2.5 text-xs data-[state=active]:bg-background sm:text-sm"
                >
                  שיקים
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
                            const rateMap = parseGafanTeacherRates(g)
                            const workshopRows = parseGafanWorkshopRows(g)
                            const teacherLabel =
                              tids.length === 0
                                ? "—"
                                : tids
                                    .map((tid, i) => {
                                      const name = teacherNameById.get(tid) || tid
                                      const role = i === 0 ? "ראשי" : "מחליף"
                                      const rr = rateMap[tid]
                                      const ratePart = rr
                                        ? ` | שעה ₪${Number(rr.teachingHourlyRate || 0).toLocaleString("he-IL")}, נסיעות ₪${Number(rr.travelHourlyRate || 0).toLocaleString("he-IL")}`
                                        : ""
                                      return `${name} (${role}${ratePart})`
                                    })
                                    .join(", ")
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
                                          setGafanTeacherTeachingRate(String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE))
                                          setGafanTeacherOfficeRate(String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE))
                                        const assigned = parseGafanTeacherIds(g)
                                        const rateMap = parseGafanTeacherRates(g)
                                        setGafanTeacherEditIds(assigned)
                                        setGafanTeacherEditRates(rateMap)
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
                                        const assigned = parseGafanTeacherIds(g)
                                        const rateMap = parseGafanTeacherRates(g)
                                        setGafanTeacherPickId("")
                                        setGafanTeacherTeachingRate(String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE))
                                        setGafanTeacherOfficeRate(String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE))
                                        setGafanTeacherEditIds(assigned)
                                        setGafanTeacherEditRates(rateMap)
                                        setGafanTeacherProgram(g)
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
                    <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-md">
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
                        setGafanTeacherTeachingRate(String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE))
                        setGafanTeacherOfficeRate(String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE))
                        setGafanTeacherEditIds([])
                        setGafanTeacherEditRates({})
                      }
                    }}
                  >
                    <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          שיוך מורה לתוכנית
                          {gafanTeacherProgram ? ` — ${gafanTeacherProgram.name}` : ""}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2 rounded-md border p-3">
                          <Label>מורים משויכים לתוכנית (ראשי ראשון)</Label>
                          {gafanTeacherEditIds.length === 0 ? (
                            <p className="text-sm text-muted-foreground">אין מורים משויכים כרגע.</p>
                          ) : (
                            <div className="space-y-2">
                              {gafanTeacherEditIds.map((tid, idx) => {
                                const rr = gafanTeacherEditRates[tid] ?? {
                                  teachingHourlyRate: DEFAULT_GAFAN_TEACHING_HOURLY_RATE,
                                  travelHourlyRate: DEFAULT_GAFAN_TRAVEL_HOURLY_RATE,
                                }
                                return (
                                  <div key={`${tid}-${idx}`} className="rounded-md border p-2">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                      <div className="font-medium">
                                        {teacherNameById.get(tid) || tid} ({idx === 0 ? "ראשי" : "מחליף"})
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={idx === 0 || gafanTeacherSaving}
                                          onClick={() => {
                                            setGafanTeacherEditIds((prev) => {
                                              const next = [...prev]
                                              ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                              return next
                                            })
                                          }}
                                        >
                                          למעלה
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={idx === gafanTeacherEditIds.length - 1 || gafanTeacherSaving}
                                          onClick={() => {
                                            setGafanTeacherEditIds((prev) => {
                                              const next = [...prev]
                                              ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
                                              return next
                                            })
                                          }}
                                        >
                                          למטה
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="destructive"
                                          disabled={gafanTeacherSaving}
                                          onClick={() => {
                                            setGafanTeacherEditIds((prev) => prev.filter((x) => x !== tid))
                                            setGafanTeacherEditRates((prev) => {
                                              const next = { ...prev }
                                              delete next[tid]
                                              return next
                                            })
                                          }}
                                        >
                                          הסר
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <Label>מחיר שעה</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={String(rr.teachingHourlyRate ?? 0)}
                                          onChange={(e) =>
                                            setGafanTeacherEditRates((prev) => ({
                                              ...prev,
                                              [tid]: {
                                                teachingHourlyRate: Math.max(0, Number(e.target.value || 0)),
                                                travelHourlyRate: Math.max(
                                                  0,
                                                  Number(prev[tid]?.travelHourlyRate ?? DEFAULT_GAFAN_TRAVEL_HOURLY_RATE),
                                                ),
                                              },
                                            }))
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label>נסיעות לשעה</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={String(rr.travelHourlyRate ?? 0)}
                                          onChange={(e) =>
                                            setGafanTeacherEditRates((prev) => ({
                                              ...prev,
                                              [tid]: {
                                                teachingHourlyRate: Math.max(
                                                  0,
                                                  Number(prev[tid]?.teachingHourlyRate ?? DEFAULT_GAFAN_TEACHING_HOURLY_RATE),
                                                ),
                                                travelHourlyRate: Math.max(0, Number(e.target.value || 0)),
                                              },
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <Button
                            type="button"
                            className="w-full"
                            disabled={gafanTeacherSaving}
                            onClick={() => void saveGafanTeacherAssignments()}
                          >
                            {gafanTeacherSaving ? "שומר..." : "שמור עדכון כרטסת מורים"}
                          </Button>
                        </div>
                        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                          המורה הראשון שמשויך לתוכנית הוא <strong>המורה הראשי</strong>. כל מורה נוסף שיתווסף יישמר כ<strong>מחליף</strong>.
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {(() => {
                              const assigned = gafanTeacherProgram ? parseGafanTeacherIds(gafanTeacherProgram) : []
                              return assigned.length === 0 ? "בחר מורה ראשי" : "בחר מורה מחליף"
                            })()}
                          </Label>
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
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>מחיר שעה</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={gafanTeacherTeachingRate}
                              onChange={(e) => setGafanTeacherTeachingRate(e.target.value)}
                              placeholder={String(DEFAULT_GAFAN_TEACHING_HOURLY_RATE)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>נסיעות לשעה</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={gafanTeacherOfficeRate}
                              onChange={(e) => setGafanTeacherOfficeRate(e.target.value)}
                              placeholder={String(DEFAULT_GAFAN_TRAVEL_HOURLY_RATE)}
                            />
                          </div>
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
                    <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
                          setHourDialogContext("attendance")
                          setHoursProgramId(gafanPrograms[0]?.id || "")
                          resetHourForm()
                          setHourDialogOpen(true)
                        }}
                      >
                        הוספה
                      </Button>
                    </div>

                    {attendanceByTeacher.length === 0 ? (
                      <div className="rounded-lg border p-6 text-center text-muted-foreground">אין נתוני נוכחות להצגה</div>
                    ) : (
                      <Tabs
                        value={activeAttendanceTeacher?.teacherKey || ""}
                        onValueChange={setSelectedAttendanceTeacher}
                        dir="rtl"
                        className="space-y-3"
                      >
                        <TabsList className="h-auto w-full flex-wrap justify-start gap-2">
                          {attendanceByTeacher.map((teacher) => (
                            <TabsTrigger key={teacher.teacherKey} value={teacher.teacherKey}>
                              {teacher.teacherDisplayName} (סה&quot;כ: {teacher.approvedHours.toLocaleString("he-IL")})
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {attendanceByTeacher.map((teacher) => (
                          <TabsContent key={teacher.teacherKey} value={teacher.teacherKey} className="mt-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                              <div className="font-semibold">{teacher.teacherDisplayName}</div>
                              <div className="text-muted-foreground">
                                סה&quot;כ שעות מאושרות: <strong>{teacher.approvedHours.toLocaleString("he-IL")}</strong>
                              </div>
                              <div className="text-muted-foreground">
                                סה&quot;כ שעות (כולל ממתין): <strong>{teacher.totalHours.toLocaleString("he-IL")}</strong>
                              </div>
                            </div>
                            {teacher.months.length === 0 ? (
                              <div className="rounded-lg border p-6 text-center text-muted-foreground">אין נתוני נוכחות להצגה</div>
                            ) : (
                              <Tabs
                                value={activeAttendanceMonth}
                                onValueChange={setSelectedAttendanceMonth}
                                dir="rtl"
                                className="space-y-3"
                              >
                                <TabsList className="h-auto w-full flex-wrap justify-start gap-2">
                                  {teacher.months.map((group) => (
                                    <TabsTrigger key={group.monthKey} value={group.monthKey}>
                                      {group.monthLabel} (מאושר: {group.approvedHours.toLocaleString("he-IL")})
                                    </TabsTrigger>
                                  ))}
                                </TabsList>
                                {teacher.months.map((group) => (
                                  <TabsContent key={group.monthKey} value={group.monthKey} className="mt-0">
                                    <div className="overflow-x-auto rounded-md border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-muted/50">
                                            <TableHead className="text-right">מס׳</TableHead>
                                            <TableHead className="text-right">תוכנית</TableHead>
                                            <TableHead className="text-right">תפקיד</TableHead>
                                            <TableHead className="text-right">תאריך</TableHead>
                                            <TableHead className="text-right">יום</TableHead>
                                            <TableHead className="text-right">שעת התחלה</TableHead>
                                            <TableHead className="text-right">שעת סיום</TableHead>
                                            <TableHead className="text-right">סה&quot;כ שעות</TableHead>
                                            <TableHead className="text-right">סטטוס</TableHead>
                                            <TableHead className="text-center">פעולות</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.rows.map((row, idx) => (
                                            <TableRow key={`${teacher.teacherKey}-${group.monthKey}-${idx}`}>
                                              <TableCell>{idx + 1}</TableCell>
                                              <TableCell>{row.programName}</TableCell>
                                              <TableCell>
                                                {row.teacherRoleLabel ? (
                                                  <span
                                                    className={`rounded-full px-2 py-0.5 text-xs ${
                                                      row.teacherRoleLabel === "ראשי"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-purple-100 text-purple-700"
                                                    }`}
                                                  >
                                                    {row.teacherRoleLabel}
                                                  </span>
                                                ) : (
                                                  "—"
                                                )}
                                              </TableCell>
                                              <TableCell>{safe(row.date)}</TableCell>
                                              <TableCell>{safe(row.dayOfWeek)}</TableCell>
                                              <TableCell>{safe(row.startTime)}</TableCell>
                                              <TableCell>{safe(row.endTime)}</TableCell>
                                              <TableCell>{Number(row.totalHours || 0)}</TableCell>
                                              <TableCell>
                                                {row.status === "approved" ? (
                                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">מאושר</span>
                                                ) : (
                                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">ממתין לאישור</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    title="עריכה"
                                                    onClick={() => {
                                                      setHourDialogContext("attendance")
                                                      setHoursProgramId(row.programId)
                                                      setHourDate(row.date)
                                                      setHourStartTime(row.startTime)
                                                      setHourEndTime(row.endTime)
                                                      setHourTotal(String(row.totalHours))
                                                      setHourEditIdx(row.rowIndex)
                                                      setHourEditSourceRow({
                                                        date: row.date,
                                                        dayOfWeek: row.dayOfWeek,
                                                        teacherName: row.teacherName,
                                                teacherId: row.teacherId,
                                                        startTime: row.startTime,
                                                        endTime: row.endTime,
                                                        totalHours: Number(row.totalHours || 0),
                                                        pendingAssignment: row.status === "pending",
                                                      })
                                                      setHourDialogOpen(true)
                                                    }}
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    title="מחיקה"
                                                    onClick={() => {
                                                      const program = gafanPrograms.find((g) => g.id === row.programId)
                                                      if (!program) return
                                                      void deleteHourRow(program, row.rowIndex, {
                                                        date: row.date,
                                                        dayOfWeek: row.dayOfWeek,
                                                        teacherName: row.teacherName,
                                                teacherId: row.teacherId,
                                                        startTime: row.startTime,
                                                        endTime: row.endTime,
                                                        totalHours: Number(row.totalHours || 0),
                                                        pendingAssignment: row.status === "pending",
                                                      })
                                                    }}
                                                  >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TabsContent>
                                ))}
                              </Tabs>
                            )}
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </>
                )}
                <Dialog open={hourDialogOpen} onOpenChange={setHourDialogOpen}>
                  <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{hourDialogContext === "attendance" ? "הוספת נוכחות מורה" : "הוספת שעות"}</DialogTitle>
                    </DialogHeader>
                    {hourDialogContext === "ngafan" && (
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
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-5">
                      <Input
                        type="date"
                        className="sm:col-span-2 md:col-span-2"
                        value={hourDate}
                        onChange={(e) => setHourDate(e.target.value)}
                      />
                      <Input type="time" value={hourStartTime} onChange={(e) => setHourStartTime(e.target.value)} />
                      <Input type="time" value={hourEndTime} onChange={(e) => setHourEndTime(e.target.value)} />
                      <Input type="number" min={0} step="0.25" value={hourTotal} readOnly />
                    </div>
                    {hourSaveError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {hourSaveError}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        disabled={hourDialogContext === "ngafan" ? (!hoursProgramId || hoursSaving) : (gafanPrograms.length === 0 || hoursSaving)}
                        onClick={() => void saveHourRow()}
                      >
                        הוספה
                      </Button>
                      <Button type="button" variant="outline" onClick={resetHourForm}>נקה</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </TabsContent>}

          {canViewNgafanTab && <TabsContent value="ngafan" className="p-3 sm:p-6">
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
                  {pendingAttendanceRows.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                      <div className="font-semibold">שעות ממתינות לאישור</div>
                      <div className="overflow-x-auto rounded-md border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-right">מס׳</TableHead>
                              <TableHead className="text-right">תאריך</TableHead>
                              <TableHead className="text-right">שם מורה</TableHead>
                              <TableHead className="text-right">שעת התחלה</TableHead>
                              <TableHead className="text-right">שעת סיום</TableHead>
                              <TableHead className="text-right">סה&quot;כ שעות</TableHead>
                              <TableHead className="text-right">תוכנית מקור</TableHead>
                              <TableHead className="text-right">אישור לתוכנית</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingAttendanceRows.map((p, idx) => (
                              <TableRow key={p.key}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{safe(p.row.date)}</TableCell>
                                <TableCell>{safe(p.row.teacherName)}</TableCell>
                                <TableCell>{safe(p.row.startTime)}</TableCell>
                                <TableCell>{safe(p.row.endTime)}</TableCell>
                                <TableCell>{Number(p.row.totalHours || 0)}</TableCell>
                                <TableCell>{p.holderProgramName}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                                    <Select
                                      value={pendingAssignTargetByKey[p.key] || ""}
                                      onValueChange={(v) => setPendingAssignTargetByKey((prev) => ({ ...prev, [p.key]: v }))}
                                    >
                                      <SelectTrigger className="w-full sm:w-[220px]">
                                        <SelectValue placeholder="בחר תוכנית לאישור" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {gafanPrograms.map((g, programIdx) => (
                                          <SelectItem key={g.id} value={g.id}>
                                            {g.name} (#{programIdx + 1})
                                            {g.id === p.holderProgramId ? " - אותה תוכנית" : ""}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={!pendingAssignTargetByKey[p.key] || hoursSaving}
                                      onClick={() => void assignPendingAttendanceRow(p.key)}
                                    >
                                      אשר
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  {gafanPrograms.map((program) => {
                    const programIndex = gafanPrograms.findIndex((g) => g.id === program.id)
                    const workshopRows = parseGafanWorkshopRows(program)
                    const allocated = workshopRows.reduce((s, r) => s + Number(r.hours || 0), 0)
                    const hourRows = parseGafanHourRows(program)
                      .filter((r) => !r.pendingAssignment)
                      .sort((a, b) => a.date.localeCompare(b.date))
                    const used = hourRows.reduce((s, r) => s + Number(r.totalHours || 0), 0)
                    const balance = allocated - used
                    const programTeacherIds = parseGafanTeacherIds(program)
                    const programTeacherLabels = programTeacherIds
                      .map((tid, i) => {
                        const name = teacherNameById.get(tid) || tid
                        if (!name) return ""
                        const role = i === 0 ? "ראשי" : "מחליף"
                        return `${name} (${role})`
                      })
                      .filter(Boolean)
                    return (
                      <div key={program.id} className="space-y-3 rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                            <span>
                              {program.name} (#{programIndex + 1})
                            </span>
                            {programTeacherLabels.length > 0 && (
                              <span className="text-sm font-normal text-muted-foreground">
                                — מורה: {programTeacherLabels.join(", ")}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setHourDialogContext("ngafan")
                              setHoursProgramId(program.id)
                              resetHourForm()
                              setHourDialogOpen(true)
                            }}
                          >
                            הוספה
                          </Button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="rounded-md border bg-muted/30 px-3 py-2">
                            שעות מוקצה לתוכנית: <strong>{allocated.toFixed(2)}</strong>
                          </div>
                          <div className="rounded-md border bg-muted/30 px-3 py-2">
                            יתרת שעות: <strong>{balance.toFixed(2)}</strong>
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-right">מס׳</TableHead>
                                <TableHead className="text-right">תאריך</TableHead>
                                <TableHead className="text-right">שעת התחלה</TableHead>
                                <TableHead className="text-right">שעת סיום</TableHead>
                                <TableHead className="text-right">סה&quot;כ שעות</TableHead>
                                <TableHead className="text-center">פעולות</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {hourRows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center text-muted-foreground">אין נתוני שעות</TableCell>
                                </TableRow>
                              ) : (
                                hourRows.map((r, idx) => (
                                  <TableRow key={`${program.id}-hr-${idx}`}>
                                    <TableCell>{idx + 1}</TableCell>
                                    <TableCell>{safe(r.date)}</TableCell>
                                    <TableCell>{safe(r.startTime)}</TableCell>
                                    <TableCell>{safe(r.endTime)}</TableCell>
                                    <TableCell>{Number(r.totalHours || 0)}</TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setHourDialogContext("ngafan")
                                            setHoursProgramId(program.id)
                                            setHourDate(r.date)
                                            setHourStartTime(r.startTime)
                                            setHourEndTime(r.endTime)
                                            setHourTotal(String(r.totalHours))
                                            setHourEditIdx(idx)
                                            setHourEditSourceRow({
                                              date: r.date,
                                              dayOfWeek: r.dayOfWeek,
                                              teacherName: r.teacherName,
                                              teacherId: r.teacherId,
                                              startTime: r.startTime,
                                              endTime: r.endTime,
                                              totalHours: Number(r.totalHours || 0),
                                              pendingAssignment: false,
                                            })
                                            setHourDialogOpen(true)
                                          }}
                                          title="עריכה"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => void deleteHourRow(program, idx)}
                                          title="מחיקה"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )
                  })
                  }
                  </>
                )}
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
                      <CardTitle className="text-lg text-rose-800">שיקים - זכות / חובה</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-100 text-blue-800">סה"כ זכות: ₪{schoolChecksRows.totalSchool.toLocaleString()}</Badge>
                      <Badge className="bg-green-100 text-green-800">סה"כ חובה: ₪{schoolChecksRows.totalMine.toLocaleString()}</Badge>
                      <Badge className={schoolChecksRows.totalBalance >= 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}>
                        יתרה כוללת: ₪{schoolChecksRows.totalBalance.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <Button type="button" onClick={() => setIsCheckModalOpen(true)} disabled={!canEditDebtorsTab}>
                      הוספת שיק
                    </Button>
                  </div>

                  <Dialog open={isCheckModalOpen} onOpenChange={setIsCheckModalOpen}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>הוספת שיק</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>סוג שיק</Label>
                          <Select value={checkModalType} onValueChange={(v) => setCheckModalType(v as "credit" | "debit")}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="credit">זכות</SelectItem>
                              <SelectItem value="debit">חובה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {checkModalType === "credit" ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <div><Label>תאריך פרעון</Label><Input type="date" value={checkInDueDate} onChange={(e) => setCheckInDueDate(e.target.value)} /></div>
                            <div><Label>מספר שיק</Label><Input value={checkInNumber} onChange={(e) => setCheckInNumber(e.target.value)} placeholder="מס שיק" /></div>
                            <div className="md:col-span-2"><Label>תוכנית</Label><Input value={checkInProgramName} onChange={(e) => setCheckInProgramName(e.target.value)} placeholder="שם תוכנית" /></div>
                            <div><Label>סכום</Label><Input dir="ltr" value={checkInAmount} onChange={(e) => setCheckInAmount(formatAmountInput(e.target.value))} placeholder="1,000" /></div>
                          </div>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <Label>שורת זכות</Label>
                              <Select value={checkOutTargetRowId} onValueChange={setCheckOutTargetRowId}>
                                <SelectTrigger><SelectValue placeholder="בחר שורה" /></SelectTrigger>
                                <SelectContent>
                                  {schoolChecksRows.rows.map((r) => (
                                    <SelectItem key={r.rowId} value={r.rowId}>
                                      #{r.serial} | {r.checkNumber} | {r.programName} | ₪{r.schoolAmount.toLocaleString()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div><Label>מספר שיק</Label><Input value={checkOutNumber} onChange={(e) => setCheckOutNumber(e.target.value)} placeholder="מס שיק שלי" /></div>
                            <div><Label>למי מיועד</Label><Input value={checkOutPayee} onChange={(e) => setCheckOutPayee(e.target.value)} placeholder="שם יעד השיק" /></div>
                            <div><Label>סכום</Label><Input dir="ltr" value={checkOutAmount} onChange={(e) => setCheckOutAmount(formatAmountInput(e.target.value))} placeholder="1,000" /></div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                          <Button type="button" variant="outline" onClick={() => setIsCheckModalOpen(false)}>
                            ביטול
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void submitCheckFromModal()}
                            disabled={!canEditDebtorsTab || (checkModalType === "credit" ? checkInSaving : checkOutSaving)}
                          >
                            {checkModalType === "credit"
                              ? (checkInSaving ? "שומר..." : "שמור זכות")
                              : (checkOutSaving ? "שומר..." : "שמור חובה")}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {schoolChecksRows.rows.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">אין שיקים להצגה</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right">מס׳ סידורי</TableHead>
                            <TableHead className="text-right">פרטים</TableHead>
                            <TableHead className="text-right">זכות</TableHead>
                            <TableHead className="text-right">מע"מ זכות</TableHead>
                            <TableHead className="text-right">חובה</TableHead>
                            <TableHead className="text-right">מע"מ חובה</TableHead>
                            <TableHead className="text-right">יתרת מע"מ</TableHead>
                            <TableHead className="text-right">יתרה</TableHead>
                            <TableHead className="text-right">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schoolChecksRows.rows.map((r) => (
                            <Fragment key={r.rowId}>
                              <TableRow className="bg-rose-50/40">
                                <TableCell className="font-semibold">#{r.serial}</TableCell>
                                <TableCell className="text-sm">
                                  <div className="mb-1 font-medium text-rose-700">זכות</div>
                                  <div><b>תאריך פרעון:</b> {r.dueDate ? new Date(`${r.dueDate}T12:00:00`).toLocaleDateString("he-IL") : "—"}</div>
                                  <div><b>מס׳ שיק:</b> {r.checkNumber || "—"}</div>
                                  <div><b>תוכנית:</b> {r.programName || "—"}</div>
                                </TableCell>
                                <TableCell className="font-medium text-emerald-700">₪{r.schoolAmount.toLocaleString()}</TableCell>
                                <TableCell>₪{r.schoolVat.toLocaleString()}</TableCell>
                                <TableCell className="text-muted-foreground">—</TableCell>
                                <TableCell className="text-muted-foreground">—</TableCell>
                                <TableCell
                                  rowSpan={Math.max(1, r.myChecks.length) + 1}
                                  className={r.vatBalance >= 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}
                                >
                                  ₪{r.vatBalance.toLocaleString()}
                                </TableCell>
                                <TableCell
                                  rowSpan={Math.max(1, r.myChecks.length) + 1}
                                  className={r.balance >= 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}
                                >
                                  ₪{r.balance.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => void updateSchoolCheckIn(r.paymentId, r.meta)} disabled={!canEditDebtorsTab}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => void deleteSchoolCheckPayment(r.paymentId)} disabled={!canDeleteDebtorsTab}>
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {r.myChecks.length === 0 ? (
                                <TableRow className="bg-blue-50/20">
                                  <TableCell className="font-semibold">#{r.serial}</TableCell>
                                  <TableCell className="text-muted-foreground"><span className="font-medium text-blue-700">חובה</span> - אין שיקים</TableCell>
                                  <TableCell className="text-muted-foreground">—</TableCell>
                                  <TableCell className="text-muted-foreground">—</TableCell>
                                  <TableCell className="font-medium text-blue-700">₪0</TableCell>
                                  <TableCell>₪0</TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCheckOutTargetRowId(r.rowId)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                r.myChecks.map((c) => (
                                  <TableRow key={c.paymentId} className="bg-blue-50/20">
                                    <TableCell className="font-semibold">#{r.serial}</TableCell>
                                    <TableCell className="text-sm">
                                      <div className="mb-1 font-medium text-blue-700">חובה</div>
                                      <div><b>מס׳ שיק:</b> {c.checkNumber || "—"}</div>
                                      <div><b>למי מיועד:</b> {c.payee || "—"}</div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">—</TableCell>
                                    <TableCell className="text-muted-foreground">—</TableCell>
                                    <TableCell className="font-medium text-blue-700">₪{Number(c.amount || 0).toLocaleString()}</TableCell>
                                    <TableCell>₪{c.noVat ? 0 : Math.round(Number(c.amount || 0) * VAT_RATE * 100) / 100}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          title={c.noVat ? "בטל אפס מע\"מ" : "אפס מע\"מ לשיק הזה"}
                                          disabled={!canEditDebtorsTab}
                                          onClick={() =>
                                            void toggleSchoolCheckOutVatZero(
                                              c.paymentId,
                                              c.paymentDate,
                                              {
                                                schoolId: String(school?.id || ""),
                                                rowId: r.rowId,
                                                checkNumber: c.checkNumber,
                                                payee: c.payee,
                                                amount: Number(c.amount || 0),
                                                noVat: Boolean(c.noVat),
                                              },
                                            )
                                          }
                                        >
                                          <CircleOff className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={!canEditDebtorsTab}
                                          onClick={() =>
                                            void updateSchoolCheckOut(
                                              c.paymentId,
                                              c.paymentDate,
                                              {
                                                schoolId: String(school?.id || ""),
                                                rowId: r.rowId,
                                                checkNumber: c.checkNumber,
                                                payee: c.payee,
                                                amount: Number(c.amount || 0),
                                              },
                                            )
                                          }
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => void deleteSchoolCheckPayment(c.paymentId)} disabled={!canDeleteDebtorsTab}>
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>}

          {canViewPaymentsTab && <TabsContent value="payments" className="space-y-4 p-3 sm:p-6">
            {tabDataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-lg">תשלומי מורים לפי תוכנית וחודש</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-blue-100 text-blue-800">סה"כ עלות: ₪{schoolPayoutTotals.planned.toLocaleString()}</Badge>
                        <Badge className="bg-green-100 text-green-800">שולם: ₪{schoolPayoutTotals.paid.toLocaleString()}</Badge>
                        <Badge className={schoolPayoutTotals.balance >= 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}>
                          יתרה: ₪{schoolPayoutTotals.balance.toLocaleString()} {schoolPayoutTotals.balance >= 0 ? "(חוב)" : "(זכות)"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-12">
                      <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                        <Label>מורה/תוכנית/חודש</Label>
                        <Select value={schoolPayoutTargetKey} onValueChange={setSchoolPayoutTargetKey}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="בחר יעד תשלום" />
                          </SelectTrigger>
                          <SelectContent>
                            {teacherProgramMonthlyRows.map((r) => (
                              <SelectItem key={r.key} value={r.key}>
                                {r.teacherName} | {r.programName} | {r.monthLabel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        <Label>תאריך</Label>
                        <Input type="date" value={schoolPayoutDate} onChange={(e) => setSchoolPayoutDate(e.target.value)} />
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        <Label>שיטת תשלום</Label>
                        <Select value={schoolPayoutMethod} onValueChange={(v: "cash" | "transfer" | "check") => setSchoolPayoutMethod(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">מזומן</SelectItem>
                            <SelectItem value="transfer">העברה</SelectItem>
                            <SelectItem value="check">שיק</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        <Label>סכום</Label>
                        <Input
                          dir="ltr"
                          value={schoolPayoutAmount}
                          onChange={(e) => setSchoolPayoutAmount(formatAmountInput(e.target.value))}
                          placeholder="1,000"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2 lg:col-span-10">
                        <Label>פרטי תשלום</Label>
                        <Input value={schoolPayoutNotes} onChange={(e) => setSchoolPayoutNotes(e.target.value)} placeholder="מספר שיק / בנק / הערה" />
                      </div>
                      <div className="flex items-end lg:col-span-2">
                        <Button type="button" disabled={!canEditPaymentsTab || !schoolPayoutTargetKey || schoolPayoutSaving} onClick={() => void createSchoolPayout()} className="w-full">
                          {schoolPayoutSaving ? "שומר..." : "הוסף תשלום"}
                        </Button>
                      </div>
                    </div>

                    {teacherProgramMonthlyRows.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">אין שעות מורים לחישוב תשלומים</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-right">חודש</TableHead>
                              <TableHead className="text-right">מורה</TableHead>
                              <TableHead className="text-right">תוכנית</TableHead>
                              <TableHead className="text-right">כמות שעות</TableHead>
                              <TableHead className="text-right">עלות לשעה</TableHead>
                              <TableHead className="text-right">סה"כ לתשלום</TableHead>
                              <TableHead className="text-right">שולם</TableHead>
                              <TableHead className="text-right">יתרה</TableHead>
                              <TableHead className="text-right">פעולות</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teacherProgramMonthlyRows.map((r) => (
                              <TableRow key={r.key}>
                                <TableCell>{r.monthLabel}</TableCell>
                                <TableCell className="font-medium">{r.teacherName}</TableCell>
                                <TableCell>{r.programName}</TableCell>
                                <TableCell>{r.hours.toLocaleString()}</TableCell>
                                <TableCell>₪{r.hourlyRate.toLocaleString()}</TableCell>
                                <TableCell>₪{r.plannedAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-green-700">₪{r.paidAmount.toLocaleString()}</TableCell>
                                <TableCell className={r.balance >= 0 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>
                                  ₪{r.balance.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      title="עריכת תשלום לשורה"
                                      disabled={!canEditPaymentsTab}
                                      onClick={() => editPayoutRow(r.key)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      title="מחיקת תשלומים משורה זו"
                                      disabled={!canDeletePaymentsTab || r.payoutPaymentIds.length === 0}
                                      onClick={() => void deletePayoutRowPayments(r.key)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>}
        </Tabs>
      </Card>
    </div>
  )
}
