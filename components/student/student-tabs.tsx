"use client"

import { useEffect } from "react"

import { TableCell } from "@/components/ui/table"

import { TableBody } from "@/components/ui/table"

import { TableHead } from "@/components/ui/table"

import { TableRow } from "@/components/ui/table"

import { TableHeader } from "@/components/ui/table"

import { Table } from "@/components/ui/table"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { BookOpen, Receipt, CalendarCheck, Plus, Loader2, User, Phone, CreditCard, Users, Heart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { hasPermission } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/auth-context"
import { useLanguage } from "@/lib/i18n/context"

type Course = {
  id: string
  name: string
  duration?: number
}

type Enrollment = {
  id: string
  sessionsLeft?: number
  status: string
  joinedAt?: string
  enrollmentDate?: string
  courseName?: string
  coursePrice?: number | null
  course?: Course | null
  createdByUserName?: string | null
}

type Payment = {
  id: string
  amount: number
  status?: "PAID" | "PENDING" | "CANCELED"
  paymentType?: string
  paymentDate?: string
  description?: string | null
  createdByUserName?: string | null
}

type Attendance = {
  id: string
  date: string
  status: string
  courseName?: string | null
  courseDuration?: number | null
  courseId?: string
  note?: string | null
  createdByUserName?: string | null
}

type SiblingPackage = {
  id: string
  name: string
  firstAmount: number
  secondAmount: number
  thirdAmount: number
  isActive: boolean
}

type SiblingPreview = {
  rank: number | null
  amountForRank: number | null
  firstAmount: number
  discountAmount: number | null
}

function formatDate(dateString?: string, localeTag = "he-IL") {
  if (!dateString) return "-"
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return "-"
  return new Intl.DateTimeFormat(localeTag).format(d)
}

function formatDateTime(dateString?: string, localeTag = "he-IL") {
  if (!dateString) return "-"
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return "-"
  return new Intl.DateTimeFormat(localeTag, { dateStyle: "short", timeStyle: "short" }).format(d)
}

function paymentStatusHe(s: Payment["status"]) {
  if (s === "PAID") return "שולם"
  if (s === "PENDING") return "ממתין"
  return "בוטל"
}
function paymentStatusLabel(s: Payment["status"], isEn: boolean) {
  if (!isEn) return paymentStatusHe(s)
  if (s === "PAID") return "Paid"
  if (s === "PENDING") return "Pending"
  return "Canceled"
}

function paymentMethodHe(m?: string) {
  switch (m?.toLowerCase()) {
    case "cash":
      return "מזומן"
    case "credit":
      return "אשראי"
    case "transfer":
    case "bank_transfer":
      return "העברה בנקאית"
    case "check":
      return "שיק"
    case "bit":
      return "ביט"
    case "paybox":
      return "פייבוקס"
    default:
      return "מזומן"
  }
}
function paymentMethodLabel(m: string | undefined, isEn: boolean) {
  if (!isEn) return paymentMethodHe(m)
  switch (m?.toLowerCase()) {
    case "cash":
      return "Cash"
    case "credit":
      return "Credit Card"
    case "transfer":
    case "bank_transfer":
      return "Bank Transfer"
    case "check":
      return "Check"
    case "bit":
      return "Bit"
    case "paybox":
      return "PayBox"
    default:
      return "Cash"
  }
}

function attendanceStatusHe(s: string) {
  if (s === "present" || s === "PRESENT") return "נוכח"
  if (s === "absent" || s === "ABSENT") return "נעדר"
  if (s === "sick") return "חולה"
  if (s === "vacation") return "חופש"
  return s
}
function attendanceStatusLabel(s: string, isEn: boolean) {
  if (!isEn) return attendanceStatusHe(s)
  if (s === "present" || s === "PRESENT") return "Present"
  if (s === "absent" || s === "ABSENT") return "Absent"
  if (s === "sick") return "Sick"
  if (s === "vacation") return "Vacation"
  return s
}

type Student = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  birthDate: string | null
  idNumber: string | null
  father: string | null
  mother: string | null
  additionalPhone: string | null
  healthFund: string | null
  allergies: string | null
  status: string
  profileImage?: string | null
}

function safeText(v: any) {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

export function StudentTabs({
  studentId,
  student,
  enrollments,
  payments,
  attendances,
  enrolledCourseNames = [],
  onPaymentAdded,
  isOwnProfile = false,
}: {
  studentId: string
  student?: Student
  enrollments: Enrollment[]
  payments: Payment[]
  attendances: Attendance[]
  enrolledCourseNames?: string[]
  onPaymentAdded?: () => void
  /** כשהתלמיד צופה בפרופיל שלו – הרשאות מהכרטסת "הפרופיל שלי" */
  isOwnProfile?: boolean
}) {
  const { locale } = useLanguage()
  const isEn = locale === "en"
  const isAr = locale === "ar"
  const tx = (he: string, en: string, ar: string) => (isEn ? en : isAr ? ar : he)
  const localeTag = isEn ? "en-GB" : isAr ? "ar" : "he-IL"
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
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<"payment" | "discount" | "credit">("payment")
  const [sessionFeedbackRows, setSessionFeedbackRows] = useState<any[]>([])
  const [siblingPackages, setSiblingPackages] = useState<SiblingPackage[]>([])
  const [applySiblingDiscount, setApplySiblingDiscount] = useState(false)
  const [selectedSiblingPackageId, setSelectedSiblingPackageId] = useState<string>("")
  const [siblingPreview, setSiblingPreview] = useState<SiblingPreview | null>(null)
  const [isLoadingSiblingPreview, setIsLoadingSiblingPreview] = useState(false)
  const currentUser = useCurrentUser()

  const isAdmin =
    currentUser?.roleKey === "admin" ||
    currentUser?.roleKey === "super_admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "אדמין" ||
    currentUser?.role === "מנהל"
  const userPerms = currentUser?.permissions || []
  const roleKey = (currentUser?.roleKey || currentUser?.role)?.toString().toLowerCase()
  const isTeacher = roleKey === "teacher"
  const canSeeStudentFinancial = isAdmin || hasPermission(userPerms, "students.financial")
  // מצב מיוחד: מורה בלי הרשאת כספים – רואה רק פרופיל + נוכחות (fallback אם אין הרשאות טאב)
  const teacherLimitedView = isTeacher && !canSeeStudentFinancial
  // בפרופיל שלי (תלמיד צופה בעצמו) – הרשאות מהכרטסת "הפרופיל שלי"; אחרת – מכרטסת תלמידים
  const canTabProfile = isAdmin || (isOwnProfile ? hasPermission(userPerms, "myProfile.tab.profile") : hasPermission(userPerms, "students.tab.profile"))
  const canTabGeneral = isAdmin || (isOwnProfile ? hasPermission(userPerms, "myProfile.tab.general") : hasPermission(userPerms, "students.tab.general"))
  const canTabCourses = isAdmin || (isOwnProfile ? hasPermission(userPerms, "myProfile.tab.courses") : hasPermission(userPerms, "students.tab.courses"))
  const canTabPayments = isAdmin || (isOwnProfile ? hasPermission(userPerms, "myProfile.tab.payments") : hasPermission(userPerms, "students.tab.payments"))
  const canTabAttendance = isAdmin || (isOwnProfile ? hasPermission(userPerms, "myProfile.tab.attendance") : hasPermission(userPerms, "students.tab.attendance"))
  const hasAnyTabPerm = canTabProfile || canTabGeneral || canTabCourses || canTabPayments || canTabAttendance
  // בפרופיל שלי – רק הרשאות מפורשות (myProfile.tab.*); לא פרופיל שלי – כמו עד כה + fallback למורה
  const showProfile = canTabProfile || (!isOwnProfile && ((!hasAnyTabPerm && !teacherLimitedView) || (!hasAnyTabPerm && isTeacher)))
  const showGeneral = canTabGeneral || (!isOwnProfile && !hasAnyTabPerm && !teacherLimitedView)
  const showCourses = canTabCourses || (!isOwnProfile && !hasAnyTabPerm && !teacherLimitedView)
  const showPayments = canTabPayments || (!isOwnProfile && !hasAnyTabPerm && !teacherLimitedView)
  const showAttendance = canTabAttendance || (!isOwnProfile && ((!hasAnyTabPerm && !teacherLimitedView) || (!hasAnyTabPerm && isTeacher)))
  const showSessionFeedback = isOwnProfile || isAdmin || hasPermission(userPerms, "students.tab.feedback")
  const canAddDiscount = isAdmin || hasPermission(userPerms, "cashier.discount")
  const canAddCredit = isAdmin || hasPermission(userPerms, "cashier.credit")
  const canApplySiblingDiscount = isAdmin || hasPermission(userPerms, "cashier.siblingDiscount")

  useEffect(() => {
    if (!studentId) return
    fetch(`/api/students/${studentId}/session-feedback`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setSessionFeedbackRows(Array.isArray(rows) ? rows : []))
      .catch(() => setSessionFeedbackRows([]))
  }, [studentId])

  useEffect(() => {
    if (!canApplySiblingDiscount) return
    fetch("/api/sibling-discount-packages", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        const active = Array.isArray(rows) ? rows.filter((r: any) => r?.isActive !== false) : []
        setSiblingPackages(active)
      })
      .catch(() => setSiblingPackages([]))
  }, [canApplySiblingDiscount])

  useEffect(() => {
    if (!applySiblingDiscount || !selectedSiblingPackageId || !studentId) {
      setSiblingPreview(null)
      return
    }
    setIsLoadingSiblingPreview(true)
    fetch(`/api/students/${studentId}/sibling-discount-preview?packageId=${encodeURIComponent(selectedSiblingPackageId)}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setSiblingPreview(null)
          return
        }
        setSiblingPreview({
          rank: data.rank ?? null,
          amountForRank: data.amountForRank ?? null,
          firstAmount: Number(data.firstAmount || 0),
          discountAmount: data.discountAmount == null ? null : Number(data.discountAmount),
        })
      })
      .catch(() => setSiblingPreview(null))
      .finally(() => setIsLoadingSiblingPreview(false))
  }, [applySiblingDiscount, selectedSiblingPackageId, studentId])

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

  const paymentsSummary = useMemo(() => {
    // Sum all payments (payments without status are considered paid)
    const paid = payments.reduce((sum, p) => {
      if (!p.status || p.status === "PAID") {
        return sum + Number(p.amount)
      }
      return sum
    }, 0)
    // Calculate total course costs (charges) from enrollments
    const charges = enrollments.reduce((sum, e) => sum + Number(e.coursePrice || 0), 0)
    // Balance = charges - paid (positive means student still owes)
    const balance = charges - paid
    return { paid, charges, balance }
  }, [payments, enrollments])

  // Filter attendances by selected course
  const filteredAttendances = useMemo(() => {
    if (!selectedCourseId) return attendances
    return attendances.filter((a) => a.courseId === selectedCourseId)
  }, [attendances, selectedCourseId])

  // Calculate remaining sessions for a specific course
  const getRemainingSessions = (courseId: string, totalSessions: number) => {
    const presentCount = attendances.filter(
      (a) => a.courseId === courseId && (a.status === "present" || a.status === "PRESENT")
    ).length
    return Math.max(0, totalSessions - presentCount)
  }

  // Calculate total paid amount (all payments for this student)
  const totalPaidAmount = useMemo(() => {
    return payments.reduce((sum, p) => {
      if (!p.status || p.status === "PAID") {
        return sum + Number(p.amount || 0)
      }
      return sum
    }, 0)
  }, [payments])

  // Calculate total course prices
  const totalCoursePrices = useMemo(() => {
    return enrollments.reduce((sum, e: any) => sum + Number(e.coursePrice || 0), 0)
  }, [enrollments])

  // Calculate paid amount for a specific course (proportionally distributed)
  const getPaidForCourse = (coursePrice: number) => {
    if (totalCoursePrices === 0) return 0
    // If only one course, all payments go to it
    if (enrollments.length === 1) return totalPaidAmount
    // Otherwise distribute proportionally based on course price
    const proportion = coursePrice / totalCoursePrices
    return Math.round(totalPaidAmount * proportion)
  }

  // Get selected course details from enrollment (flat structure)
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null
    const enrollment = enrollments.find((e: any) => e.courseId === selectedCourseId || e.courseIdRef === selectedCourseId)
    if (!enrollment) return null
    return {
      id: enrollment.courseId || enrollment.courseIdRef,
      name: enrollment.courseName,
      duration: enrollment.courseDuration,
      price: enrollment.coursePrice
    }
  }, [enrollments, selectedCourseId])

  const attendanceSummary = useMemo(() => {
    // Count present attendance records (filtered by course if selected)
    const present = filteredAttendances.filter((a) => a.status === "present" || a.status === "PRESENT").length
    
    // Calculate total sessions based on selected course or all courses
    let totalSessions: number
    if (selectedCourseId && selectedCourse) {
      totalSessions = selectedCourse.duration || 0
    } else {
      // Sum duration from all enrolled courses (flat structure from API)
      totalSessions = enrollments.reduce((sum, e: any) => {
        const courseDuration = e.courseDuration || 0
        return sum + courseDuration
      }, 0)
    }
    
    // Calculate remaining sessions (total - attended)
    const remaining = Math.max(0, totalSessions - present)
    
    // Calculate attendance percentage
    const percent = totalSessions === 0 ? 0 : Math.round((present / totalSessions) * 100)
    
    return { totalSessions, present, remaining, percent }
  }, [filteredAttendances, enrollments, selectedCourseId, selectedCourse])

  const handleAddPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return
    if (paymentType === "payment" && paymentMethod === "credit" && cardLastDigits.length !== 4) return
    if (paymentType === "payment" && (paymentMethod === "transfer" || paymentMethod === "check") && (!bankName || !bankBranch || !accountNumber)) return

    if (paymentType === "discount" && !canAddDiscount) {
      alert("נדרשת הרשאה להנחה (תשלומים). ניתן להפעיל בדף משתמשים → הרשאות.")
      return
    }
    if (paymentType === "credit" && !canAddCredit) {
      alert("נדרשת הרשאה לזיכוי (תשלומים). ניתן להפעיל בדף משתמשים → הרשאות.")
      return
    }

    setIsAddingPayment(true)
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          date: paymentDate,
          paymentMethod: paymentType === "payment" ? paymentMethod : paymentType,
          description: paymentDescription || (paymentType === "discount" ? "הנחה" : paymentType === "credit" ? "זיכוי" : ""),
          studentId,
          paymentType,
          cardLastDigits: paymentType === "payment" && paymentMethod === "credit" ? cardLastDigits : undefined,
          bankName: paymentType === "payment" && (paymentMethod === "transfer" || paymentMethod === "check") ? bankName : undefined,
          bankBranch: paymentType === "payment" && (paymentMethod === "transfer" || paymentMethod === "check") ? bankBranch : undefined,
          accountNumber: paymentType === "payment" && (paymentMethod === "transfer" || paymentMethod === "check") ? accountNumber : undefined,
          applySiblingDiscount: paymentType === "payment" && applySiblingDiscount && !!selectedSiblingPackageId,
          siblingPackageId: paymentType === "payment" && applySiblingDiscount ? selectedSiblingPackageId : undefined,
        }),
      })

      if (response.ok) {
        // Reset form
        setPaymentAmount("")
        setPaymentMethod("cash")
        setPaymentDescription("")
        setPaymentDate(new Date().toISOString().split("T")[0])
        setCardLastDigits("")
        setBankName("")
        setBankBranch("")
        setAccountNumber("")
        setPaymentType("payment")
        setApplySiblingDiscount(false)
        setSelectedSiblingPackageId("")
        setIsPaymentDialogOpen(false)
        onPaymentAdded?.()
      }
    } catch (error) {
      console.error("Failed to add payment:", error)
    }
    setIsAddingPayment(false)
  }

  const defaultTab = showProfile ? "profile" : showGeneral ? "general" : showCourses ? "courses" : showPayments ? "payments" : "attendance"
  const tabCount = [showProfile, showGeneral, showCourses, showPayments, showAttendance, showSessionFeedback].filter(Boolean).length

  return (
    <Tabs defaultValue={defaultTab} className="w-full" dir={isEn ? "ltr" : "rtl"}>
      <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <TabsList
          className="mb-4 flex h-auto min-h-10 w-max min-w-full max-w-none flex-nowrap justify-start gap-1 overflow-x-auto p-[3px] sm:mb-6 md:grid md:w-full md:max-w-full md:overflow-visible"
          style={
            tabCount > 0 ? { gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` } : undefined
          }
        >
          {showProfile && (
            <TabsTrigger value="profile" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
              {tx("פרופיל", "Profile", "الملف الشخصي")}
            </TabsTrigger>
          )}
          {showGeneral && (
            <TabsTrigger value="general" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
              {tx("כללי", "General", "عام")}
            </TabsTrigger>
          )}
          {showCourses && (
            <TabsTrigger value="courses" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
              {tx("קורסים", "Courses", "الدورات")}
            </TabsTrigger>
          )}
          {showPayments && (
            <TabsTrigger value="payments" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
              {tx("תשלומים", "Payments", "الدفعات")}
            </TabsTrigger>
          )}
          {showAttendance && (
            <TabsTrigger value="attendance" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
              {tx("נוכחות", "Attendance", "الحضور")}
            </TabsTrigger>
          )}
          {showSessionFeedback && (
            <TabsTrigger value="sessionFeedback" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
              {tx("משוב מפגשים", "Session Feedback", "ملاحظات الجلسات")}
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {/* Profile Tab - All student details */}
      {showProfile && (
      <TabsContent value="profile" className="space-y-6 mt-6">
        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Info Card */}
          <Card className="overflow-hidden border-2">
            <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4 bg-green-50/50 dark:bg-green-950/20">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="text-lg">{isEn ? "Personal Info" : "מידע אישי"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "ID Number:" : "תעודת זהות:"}</span>
                <span className="break-words font-medium">{safeText(student?.idNumber)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Birth Date:" : "תאריך לידה:"}</span>
                <span className="font-medium">{formatDate(student?.birthDate || undefined, localeTag)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Address:" : "כתובת:"}</span>
                <span className="break-words font-medium">{safeText(student?.address)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "City:" : "עיר:"}</span>
                <span className="break-words font-medium">{safeText(student?.city)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info Card */}
          <Card className="overflow-hidden border-2">
            <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4 bg-blue-50/50 dark:bg-blue-950/20">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-lg">{isEn ? "Contact Details" : "פרטי קשר"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Phone:" : "טלפון:"}</span>
                <span className="break-words font-medium">{safeText(student?.phone)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Email:" : "אימייל:"}</span>
                <span className="break-words font-medium">{safeText(student?.email)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Additional Phone:" : "טלפון נוסף:"}</span>
                <span className="break-words font-medium">{safeText(student?.additionalPhone)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Parent Info Card */}
          <Card className="overflow-hidden border-2">
            <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">{isEn ? "Parents" : "פרטי הורים"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Father:" : "שם האב:"}</span>
                <span className="break-words font-medium">{safeText(student?.father)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Mother:" : "שם האם:"}</span>
                <span className="break-words font-medium">{safeText(student?.mother)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Parent Phone:" : "טלפון הורה:"}</span>
                <span className="break-words font-medium">{safeText(student?.additionalPhone)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Medical Info Card */}
          <Card className="overflow-hidden border-2">
            <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4 bg-red-50/50 dark:bg-red-950/20">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="h-5 w-5 text-red-600" />
              </div>
              <CardTitle className="text-lg">{isEn ? "Medical Info" : "מידע רפואי"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Health Fund:" : "קופת חולים:"}</span>
                <span className="break-words font-medium">{safeText(student?.healthFund)}</span>
              </div>
              <div className="flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                <span className="text-muted-foreground">{isEn ? "Allergies:" : "רגישויות ואלרגיות:"}</span>
                <span className="break-words font-medium">{safeText(student?.allergies)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Courses Card */}
        <Card className="overflow-hidden border-2">
          <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4 bg-purple-50/50 dark:bg-purple-950/20">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
              <CardTitle className="text-lg">{isEn ? "Assigned Courses" : "קורסים משויכים"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {enrolledCourseNames.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {enrolledCourseNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-sm py-1.5 px-4 bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{isEn ? "No assigned courses" : "לא משויך לקורסים"}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      )}

      {showGeneral && (
      <TabsContent value="general" className="space-y-4 mt-6">
        <Card className="p-3 sm:p-5">
          <div className="text-sm text-muted-foreground">{tx("סיכום מהיר","Quick Summary","ملخص سريع")}</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">{isEn ? "Active Courses" : "קורסים פעילים"}</div>
              <div className="text-2xl font-bold">{enrollments.length}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">{isEn ? "Paid" : "שולם"}</div>
              <div className="text-2xl font-bold">{paymentsSummary.paid.toLocaleString()} ₪</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">{isEn ? "Attendance" : "נוכחות"}</div>
              <div className="text-2xl font-bold">{attendanceSummary.percent}%</div>
            </div>
          </div>
        </Card>
      </TabsContent>
      )}

      {showCourses && (
      <TabsContent value="courses" className="space-y-4 mt-6">
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-lg">{tx("קורסים רשומים","Registered Courses","الدورات المسجّلة")}</h4>

          {enrollments.length > 0 ? (
            <Card className="overflow-hidden border-2">
              <div className="overflow-x-auto">
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Course" : "שם הקורס"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Joined At" : "תאריך הצטרפות"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Price" : "מחיר"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Paid" : "שולם"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Balance" : "יתרה"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Total Sessions" : "סה״כ מפגשים"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Sessions Left" : "יתרת מפגשים"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Status" : "סטטוס"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Created By" : "בוצע על ידי"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enr) => {
                    const courseId = enr.courseId || enr.courseIdRef
                    const totalSessions = enr.courseDuration || 0
                    const remainingSessions = getRemainingSessions(courseId, totalSessions)
                    const coursePrice = Number(enr.coursePrice || 0)
                    const paidAmount = getPaidForCourse(coursePrice)
                    const balance = coursePrice - paidAmount
                    
                    return (
                      <TableRow key={enr.id} className="hover:bg-muted/30">
                        <TableCell className="max-w-[12rem] break-words font-semibold sm:max-w-none">{enr.courseName || (isEn ? "Unknown Course" : "קורס לא ידוע")}</TableCell>
                        <TableCell>{formatDate(enr.enrollmentDate || enr.joinedAt, localeTag)}</TableCell>
                        <TableCell className="font-medium">{coursePrice.toLocaleString()} ₪</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {paidAmount.toLocaleString()} ₪
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            balance > 0 
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          }`}>
                            {balance.toLocaleString()} ₪
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{totalSessions}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {remainingSessions}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            enr.status === "active" 
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                          }`}>
                            {enr.status === "active" ? (isEn ? "Active" : "פעיל") : enr.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{enr.createdByUserName || "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center sm:p-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">{isEn ? "Student is not enrolled in any course right now" : "התלמיד אינו רשום לאף קורס כרגע"}</p>
            </Card>
          )}
        </div>
      </TabsContent>
      )}

      {showPayments && (
      <TabsContent value="payments" className="space-y-4 mt-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="relative bg-green-50 p-4 dark:bg-green-950/20">
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 left-2 h-8 w-8 rounded-full bg-green-100 hover:bg-green-200 text-green-700"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{tx("הוספת תשלום חדש","Add New Payment","إضافة دفعة جديدة")}</DialogTitle>
                  <DialogDescription>{tx("הזן את פרטי התשלום","Enter payment details","أدخل تفاصيل الدفعة")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Payment Type Selection */}
                  <div className="space-y-2">
                    <Label>{tx("סוג פעולה","Action Type","نوع العملية")}</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={paymentType === "payment" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentType("payment")}
                        className={paymentType === "payment" ? "" : "bg-transparent"}
                      >
                        {tx("תשלום","Payment","دفعة")}
                      </Button>
                      <Button
                        type="button"
                        variant={paymentType === "discount" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentType("discount")}
                        disabled={!canAddDiscount}
                        className={paymentType === "discount" ? "bg-orange-500 hover:bg-orange-600" : "bg-transparent"}
                        title={!canAddDiscount ? "נדרשת הרשאה 'הנחה (תשלומים)' בדף משתמשים" : ""}
                      >
                        {tx("הנחה","Discount","خصم")}
                        {!canAddDiscount && <span className="mr-1 text-xs">(הרשאה)</span>}
                      </Button>
                      <Button
                        type="button"
                        variant={paymentType === "credit" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentType("credit")}
                        disabled={!canAddCredit}
                        className={paymentType === "credit" ? "bg-purple-500 hover:bg-purple-600" : "bg-transparent"}
                        title={!canAddCredit ? "נדרשת הרשאה 'זיכוי (תשלומים)' בדף משתמשים" : ""}
                      >
                        {tx("זיכוי","Credit","إشعار دائن")}
                        {!canAddCredit && <span className="mr-1 text-xs">(הרשאה)</span>}
                      </Button>
                    </div>
                    {((paymentType === "discount" && !canAddDiscount) || (paymentType === "credit" && !canAddCredit)) && (
                      <p className="text-xs text-red-500">ניתן להעניק הרשאות הנחה/זיכוי בדף משתמשים → עריכת משתמש → הרשאות (קופה)</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">{tx("סכום *","Amount *","المبلغ *")}</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      placeholder="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-date">{tx("תאריך","Date","التاريخ")}</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>

                  {paymentType === "payment" && (
                    <div className="space-y-2">
                      <Label htmlFor="payment-method">{tx("אמצעי תשלום","Payment Method","طريقة الدفع")}</Label>
                      <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                        <SelectTrigger id="payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{isEn ? "Cash" : "מזומן"}</SelectItem>
                          <SelectItem value="credit">{isEn ? "Credit Card" : "אשראי"}</SelectItem>
                          <SelectItem value="transfer">{isEn ? "Bank Transfer" : "העברה בנקאית"}</SelectItem>
                          <SelectItem value="check">{isEn ? "Check" : "שיק"}</SelectItem>
                          <SelectItem value="bit">{isEn ? "Bit" : "ביט"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {paymentType === "payment" && canApplySiblingDiscount && (
                    <div className="space-y-2 rounded-md border p-3">
                      <label className="flex flex-row-reverse items-center justify-end gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={applySiblingDiscount}
                          onChange={(e) => setApplySiblingDiscount(e.target.checked)}
                        />
                        החל חבילת הנחת אחים על התשלום הזה
                      </label>
                      {applySiblingDiscount && (
                        <div className="space-y-2">
                          <Select value={selectedSiblingPackageId} onValueChange={setSelectedSiblingPackageId}>
                            <SelectTrigger>
                              <SelectValue placeholder="בחר חבילת אחים פעילה" />
                            </SelectTrigger>
                            <SelectContent>
                              {siblingPackages.map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {pkg.name} (1: ₪{pkg.firstAmount}, 2: ₪{pkg.secondAmount}, 3+: ₪{pkg.thirdAmount})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedSiblingPackageId && (
                            <div className="rounded-md bg-muted/50 p-2 text-xs">
                              {isLoadingSiblingPreview ? (
                                <span>מחשב הנחת אחים...</span>
                              ) : siblingPreview ? (
                                <>
                                  <div>סדר אחאות: {siblingPreview.rank ?? "לא משויך"}</div>
                                  <div>מחיר לילד ראשון: ₪{siblingPreview.firstAmount}</div>
                                  <div>מחיר מחושב לתלמיד זה: ₪{siblingPreview.amountForRank ?? "—"}</div>
                                  <div>גובה הנחה: ₪{siblingPreview.discountAmount ?? 0}</div>
                                </>
                              ) : (
                                <span>לא ניתן לחשב כרגע הנחת אחים לתלמיד זה.</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {paymentType === "payment" && paymentMethod === "credit" && (
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

                  {paymentType === "payment" && (paymentMethod === "transfer" || paymentMethod === "check") && (
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
                      <Label htmlFor="payment-description">{tx("תיאור","Description","الوصف")}</Label>
                    <Input
                      id="payment-description"
                      placeholder={isEn ? "Payment description (optional)" : "תיאור התשלום (אופציונלי)"}
                      value={paymentDescription}
                      onChange={(e) => setPaymentDescription(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleAddPayment}
                    disabled={
                      isAddingPayment ||
                      !paymentAmount ||
                      (paymentType === "discount" && !canAddDiscount) ||
                      (paymentType === "credit" && !canAddCredit) ||
                      (paymentType === "payment" && applySiblingDiscount && !selectedSiblingPackageId)
                    }
                    className={`w-full ${paymentType === "discount" ? "bg-orange-500 hover:bg-orange-600" : paymentType === "credit" ? "bg-purple-500 hover:bg-purple-600" : ""}`}
                  >
                    {isAddingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        {isEn ? "Saving..." : "שומר..."}
                      </>
                    ) : (
                      paymentType === "payment" ? (isEn ? "Add Payment" : "הוסף תשלום") : paymentType === "discount" ? (isEn ? "Add Discount" : "הוסף הנחה") : (isEn ? "Add Credit" : "הוסף זיכוי")
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 font-bold">₪</span>
              <p className="text-xs text-green-700 dark:text-green-400">{isEn ? "Paid" : "שולם"}</p>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{paymentsSummary.paid.toLocaleString()} ₪</p>
          </Card>

          <Card className="p-4 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-600 font-bold">₪</span>
              <p className="text-xs text-orange-700 dark:text-orange-400">{isEn ? "Charges" : "חיובים"}</p>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{paymentsSummary.charges.toLocaleString()} ₪</p>
          </Card>

          <Card className={`p-4 ${paymentsSummary.balance > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-bold ${paymentsSummary.balance > 0 ? "text-red-600" : "text-green-600"}`}>₪</span>
              <p className={`text-xs ${paymentsSummary.balance > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{isEn ? "Remaining Balance" : "יתרה לתשלום"}</p>
            </div>
            <p className={`text-2xl font-bold ${paymentsSummary.balance > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
              {paymentsSummary.balance.toLocaleString()} ₪
            </p>
          </Card>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-lg">{tx("היסטוריית תשלומים","Payment History","سجل الدفعات")}</h4>

          {payments.length > 0 ? (
            <Card className="overflow-hidden border-2">
              <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Date" : "תאריך"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Type" : "סוג"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Amount" : "סכום"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Method" : "אמצעי תשלום"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Note" : "הערה"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Status" : "סטטוס"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Created By" : "בוצע על ידי"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const isDiscount = p.paymentType === "discount"
                    const isCredit = p.paymentType === "credit"
                    const typeLabel = isDiscount ? (isEn ? "Discount" : "הנחה") : isCredit ? (isEn ? "Credit" : "זיכוי") : (isEn ? "Payment" : "תשלום")
                    const typeStyle = isDiscount 
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      : isCredit 
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{formatDate(p.paymentDate, localeTag)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${typeStyle}`}>
                            {typeLabel}
                          </span>
                        </TableCell>
                        <TableCell className={`font-bold ${isDiscount || isCredit ? "text-orange-600" : "text-primary"}`}>
                          {Number(p.amount).toLocaleString()} ₪
                        </TableCell>
                        <TableCell>{isDiscount || isCredit ? "—" : paymentMethodLabel(p.paymentType, isEn)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.description || "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {isDiscount ? (isEn ? "Approved" : "אושר") : isCredit ? (isEn ? "Credited" : "זוכה") : paymentStatusLabel(p.status, isEn)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.createdByUserName || "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center sm:p-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">{isEn ? "No payments for this student yet" : "אין תשלומים לתלמיד הזה עדיין"}</p>
            </Card>
          )}
        </div>
      </TabsContent>
      )}

      {showAttendance && (
      <TabsContent value="attendance" className="space-y-4 mt-6">
        {/* Course Selection Dropdown */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-sm text-muted-foreground">{tx("סנן לפי קורס:","Filter by course:","تصفية حسب الدورة:")}</span>
          <Select 
            value={selectedCourseId || "all"} 
            onValueChange={(value) => setSelectedCourseId(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={isEn ? "All courses" : "כל הקורסים"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All courses" : "כל הקורסים"}</SelectItem>
              {enrollments.map((enr: any) => {
                const courseId = enr.courseId || enr.courseIdRef
                return (
                  <SelectItem key={courseId || enr.id} value={courseId || enr.id}>
                    {enr.courseName || (isEn ? "Course" : "קורס")}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Course Info Header */}
        {selectedCourse && (
          <Card className="p-4 bg-primary/5 border-primary/20 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="break-words font-semibold text-primary">{selectedCourse.name}</h4>
                <p className="text-sm text-muted-foreground">{isEn ? "Course sessions:" : "מספר מפגשים בקורס:"} {selectedCourse.duration || 0}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="bg-green-50 p-4 dark:bg-green-950/20">
            <div className="mb-2 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-green-600" />
              <p className="text-xs text-green-700 dark:text-green-400">{isEn ? "Attendance" : "נוכחות"}</p>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{attendanceSummary.percent}%</p>
          </Card>

          <Card className="bg-blue-50 p-4 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-blue-700 dark:text-blue-400">{isEn ? "Sessions" : "מפגשים"}</p>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {attendanceSummary.present}/{attendanceSummary.totalSessions}
            </p>
          </Card>

          <Card className="p-4 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="h-4 w-4 text-orange-600" />
              <p className="text-xs text-orange-700 dark:text-orange-400">{isEn ? "Sessions Left" : "יתרת מפגשים"}</p>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{attendanceSummary.remaining}</p>
          </Card>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-lg">{tx("רשומות נוכחות","Attendance Records","سجلات الحضور")}</h4>

          {filteredAttendances.length > 0 ? (
            <Card className="overflow-hidden border-2">
              <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Date" : "תאריך"}</TableHead>
                    {!selectedCourseId && <TableHead className="text-right font-bold text-foreground">{isEn ? "Course" : "קורס"}</TableHead>}
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Note" : "הערה"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Status" : "סטטוס"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Created By" : "בוצע על ידי"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendances.map((a) => {
                    const isPresent = a.status === "present" || a.status === "PRESENT"
                    const statusStyle = isPresent
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : a.status === "sick"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : a.status === "vacation"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    
                    return (
                      <TableRow key={a.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{formatDateTime(a.date, localeTag)}</TableCell>
                        {!selectedCourseId && <TableCell>{a.courseName || "—"}</TableCell>}
                        <TableCell className="text-muted-foreground">{a.note || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle}`}>
                            {attendanceStatusLabel(a.status, isEn)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.createdByUserName || "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center sm:p-8">
              <CalendarCheck className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">{isEn ? "No attendance records for this student yet" : "אין נוכחות לתלמיד הזה עדיין"}</p>
            </Card>
          )}
        </div>
      </TabsContent>
      )}

      {showSessionFeedback && (
        <TabsContent value="sessionFeedback" className="space-y-4 mt-6">
          {sessionFeedbackRows.length > 0 ? (
            <Card className="overflow-hidden border-2">
              <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Date" : "תאריך"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Course" : "קורס"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "General Topic" : "נושא כללי"}</TableHead>
                    <TableHead className="text-right font-bold text-foreground">{isEn ? "Teacher Feedback" : "משוב מורה"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionFeedbackRows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.sessionDate, localeTag)}</TableCell>
                      <TableCell>{r.courseName || "—"}</TableCell>
                      <TableCell>{r.generalTopic || "—"}</TableCell>
                      <TableCell>{r.feedbackText || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center sm:p-8">
              <p className="text-muted-foreground">{isEn ? "No session feedback yet" : "אין משוב מפגשים עדיין"}</p>
            </Card>
          )}
        </TabsContent>
      )}
    </Tabs>
  )
}
