"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ArrowRight, Pencil, Loader2, BookOpen, Calendar, Users, BarChart3, CalendarCheck, Check, X, Thermometer, Plane, CalendarRange, Printer } from "lucide-react"
import { courseTimeToDisplayValue } from "@/lib/course-db-fields"
import { useLanguage } from "@/lib/i18n/context"

interface Course {
  id: string
  name: string
  description: string | null
  level: string | null
  duration: number | null
  price: number | null
  status: string
  courseType?: string | null
  startDate: string | null
  endDate: string | null
  startTime: string | null
  endTime: string | null
  daysOfWeek: string[] | null
  teacherIds: string[] | null
  createdAt: string
  updatedAt: string
}

interface Teacher {
  id: string
  name: string
}

interface Enrollment {
  id: string
  studentId: string
  courseId: string
  studentName: string
  status: string
  enrollmentDate: string
  campGroupLabel?: string | null
  createdByUserId?: string | null
  createdByUserName?: string | null
  siblingDiscountPackageName?: string | null
  siblingDiscountPackageSource?: "course" | "student" | null
  siblingRank?: number | null
  siblingRankLabel?: string | null
}

interface CourseSessionFeedback {
  id: string
  studentId: string
  feedbackText: string | null
}

interface CourseSessionItem {
  id: string
  sessionDate: string
  generalTopic: string | null
  teacherName?: string | null
  feedback: CourseSessionFeedback[]
}

interface CoursePaymentRow {
  id: string
  studentId: string | null
  studentName: string
  paymentDate: string
  paymentType: string | null
  amount: number
  description: string | null
  siblingDiscountPackageName: string | null
}

const levelLabels: Record<string, Record<"he" | "en" | "ar", string>> = {
  beginner: { he: "מתחילים", en: "Beginner", ar: "مبتدئ" },
  intermediate: { he: "מתקדמים", en: "Intermediate", ar: "متوسط" },
  advanced: { he: "מומחים", en: "Advanced", ar: "متقدم" },
}

const dayLabels: Record<string, Record<"he" | "en" | "ar", string>> = {
  sunday: { he: "ראשון", en: "Sunday", ar: "الأحد" },
  monday: { he: "שני", en: "Monday", ar: "الاثنين" },
  tuesday: { he: "שלישי", en: "Tuesday", ar: "الثلاثاء" },
  wednesday: { he: "רביעי", en: "Wednesday", ar: "الأربعاء" },
  thursday: { he: "חמישי", en: "Thursday", ar: "الخميس" },
  friday: { he: "שישי", en: "Friday", ar: "الجمعة" },
  saturday: { he: "שבת", en: "Saturday", ar: "السبت" },
}

import { useCurrentUser } from "@/lib/auth-context"
import { hasPermission, hasFullAccessRole } from "@/lib/permissions"
import { getCourseStatusPresentation } from "@/lib/course-status"
import { HEBREW_GROUP_LETTERS, isCampCourseType } from "@/lib/camp-kaytana"
import { CourseCampTab } from "./course-camp-tab"

export default function CourseViewPage() {
  const { locale } = useLanguage()
  const isRtl = locale !== "en"
  const localeTag = locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "he-IL"
  const tr = {
    notFound: locale === "ar" ? "لم يتم العثور على الدورة" : locale === "en" ? "Course not found" : "לא נמצא קורס",
    courseDetails: locale === "ar" ? "تفاصيل الدورة" : locale === "en" ? "Course Details" : "פרטי קורס",
    courses: locale === "ar" ? "الدورات" : locale === "en" ? "Courses" : "קורסים",
    editCourse: locale === "ar" ? "تعديل الدورة" : locale === "en" ? "Edit Course" : "ערוך קורס",
    general: locale === "ar" ? "عام" : locale === "en" ? "General" : "כללי",
    linkedStudents: locale === "ar" ? "الطلاب المرتبطون" : locale === "en" ? "Linked Students" : "ילדים משויכים",
    costPayments: locale === "ar" ? "التكلفة والمدفوعات" : locale === "en" ? "Cost & Payments" : "עלות ותשלומים",
    studentAttendance: locale === "ar" ? "حضور الطلاب" : locale === "en" ? "Student Attendance" : "נוכחות תלמיד",
    teacherAttendance: locale === "ar" ? "حضور المعلمين" : locale === "en" ? "Teacher Attendance" : "נוכחות מורה",
    courseInfo: locale === "ar" ? "معلومات الدورة" : locale === "en" ? "Course Info" : "פרטי הקורס",
    level: locale === "ar" ? "المستوى" : locale === "en" ? "Level" : "רמה",
    duration: locale === "ar" ? "المدة" : locale === "en" ? "Duration" : "משך",
    weeks: locale === "ar" ? "أسابيع" : locale === "en" ? "weeks" : "שבועות",
    status: locale === "ar" ? "الحالة" : locale === "en" ? "Status" : "סטטוס",
    totalCoursePrice: locale === "ar" ? "السعر الإجمالي للدورة" : locale === "en" ? "Total Course Price" : "מחיר כולל לקורס",
    pricePerStudent: locale === "ar" ? "السعر لكل طالب" : locale === "en" ? "Price Per Student" : "מחיר לתלמיד",
    dateTime: locale === "ar" ? "التواريخ والأوقات" : locale === "en" ? "Dates & Times" : "תאריכים ושעות",
    startDate: locale === "ar" ? "تاريخ البدء" : locale === "en" ? "Start Date" : "תאריך התחלה",
    endDate: locale === "ar" ? "تاريخ الانتهاء" : locale === "en" ? "End Date" : "תאריך סיום",
    startTime: locale === "ar" ? "وقت البدء" : locale === "en" ? "Start Time" : "שעות התחלה",
    endTime: locale === "ar" ? "وقت الانتهاء" : locale === "en" ? "End Time" : "שעות סיום",
    weekdays: locale === "ar" ? "أيام الأسبوع" : locale === "en" ? "Weekdays" : "ימי שבוע",
    stats: locale === "ar" ? "إحصائيات" : locale === "en" ? "Statistics" : "סטטיסטיקות",
    totalStudents: locale === "ar" ? "إجمالي الطلاب" : locale === "en" ? "Total Students" : "סה\"כ תלמידים",
    teachers: locale === "ar" ? "المعلمون" : locale === "en" ? "Teachers" : "מורים",
    noTeachers: locale === "ar" ? "لا يوجد معلمون مرتبطون" : locale === "en" ? "No teachers assigned" : "לא משויכים מורים",
    enrolledStudents: locale === "ar" ? "الطلاب المسجلون في الدورة" : locale === "en" ? "Students Enrolled In Course" : "תלמידים רשומים לקורס",
    student: locale === "ar" ? "الطالب" : locale === "en" ? "Student" : "תלמיד",
    enrollmentDate: locale === "ar" ? "تاريخ التسجيل" : locale === "en" ? "Enrollment Date" : "תאריך רישום",
    siblingPackage: locale === "ar" ? "حزمة خصم إخوة" : locale === "en" ? "Sibling Discount Package" : "חבילת הנחת אחים",
    siblingRank: locale === "ar" ? "ترتيب الأخ" : locale === "en" ? "Sibling Order" : "סדר אחאות",
    packageSource: locale === "ar" ? "מקור חבילה" : locale === "en" ? "Package Source" : "מקור חבילה",
    sourceCourse: locale === "ar" ? "من الدورة" : locale === "en" ? "From Course" : "מהקורס",
    sourceStudent: locale === "ar" ? "من الطالب" : locale === "en" ? "From Student" : "מהתלמיד",
    performedBy: locale === "ar" ? "تم بواسطة" : locale === "en" ? "Performed By" : "בוצע על ידי",
    noneStudents: locale === "ar" ? "لا يوجد طلاب مسجلون في هذه الدورة" : locale === "en" ? "No students enrolled in this course" : "אין תלמידים רשומים לקורס זה",
    paymentInfoPlaceholder: locale === "ar" ? "سيتم عرض معلومات التكلفة والمدفوعات هنا" : locale === "en" ? "Cost and payment details will be shown here" : "פרטי עלות ותשלומים יוצגו כאן",
    studentAttendanceTitle: locale === "ar" ? "حضور الطلاب في الدورة" : locale === "en" ? "Course Student Attendance" : "נוכחות תלמידים בקורס",
    teacherAttendanceTitle: locale === "ar" ? "حضور المعلمين في الدورة" : locale === "en" ? "Course Teacher Attendance" : "נוכחות מורים בקורס",
    date: locale === "ar" ? "التاريخ" : locale === "en" ? "Date" : "תאריך",
    note: locale === "ar" ? "ملاحظة" : locale === "en" ? "Note" : "הערה",
    attendanceStatus: locale === "ar" ? "حالة الحضور" : locale === "en" ? "Attendance Status" : "סטטוס נוכחות",
    present: locale === "ar" ? "حاضر" : locale === "en" ? "Present" : "נוכח",
    absent: locale === "ar" ? "غائب" : locale === "en" ? "Absent" : "לא נוכח",
    sick: locale === "ar" ? "مريض" : locale === "en" ? "Sick" : "חולה",
    vacation: locale === "ar" ? "إجازة" : locale === "en" ? "Vacation" : "חופש",
    noLinkedStudents: locale === "ar" ? "لا يوجد طلاب مرتبطون بهذه الدورة" : locale === "en" ? "No students linked to this course" : "אין תלמידים משויכים לקורס זה",
    noStudentAttendance: locale === "ar" ? "لا توجد سجلات حضور طلاب لهذه الدورة بعد." : locale === "en" ? "No student attendance records for this course yet." : "אין עדיין רשומות נוכחות תלמידים לקורס זה.",
    noTeacherAttendance: locale === "ar" ? "لا توجد سجلات حضور معلمين لهذه الدورة." : locale === "en" ? "No teacher attendance records for this course." : "אין רשומות נוכחות מורים לקורס זה.",
    sessionsFeedback: locale === "ar" ? "الجلسات والملاحظات" : locale === "en" ? "Sessions & Feedback" : "מפגשים ומשוב",
    newSession: locale === "ar" ? "מפגש חדש" : locale === "en" ? "New Session" : "מפגש חדש",
    sessionDate: locale === "ar" ? "تاريخ الجلسة" : locale === "en" ? "Session Date" : "תאריך מפגש",
    generalTopic: locale === "ar" ? "الموضوع العام" : locale === "en" ? "General Topic" : "נושא כללי",
    addSession: locale === "ar" ? "إضافة جلسة" : locale === "en" ? "Add Session" : "הוסף מפגש",
    saveFeedback: locale === "ar" ? "حفظ الملاحظات" : locale === "en" ? "Save Feedback" : "שמור משוב",
    noSessionsYet: locale === "ar" ? "لا توجد جلسات بعد" : locale === "en" ? "No sessions yet" : "אין מפגשים עדיין",
    feedbackForStudent: locale === "ar" ? "ملاحظة للطالب" : locale === "en" ? "Feedback for student" : "משוב לתלמיד",
    yourFeedback: locale === "ar" ? "ملاحظتك" : locale === "en" ? "Your feedback" : "המשוב שלך",
  }
  const params = useParams()
  const id = params.id as string
  const [course, setCourse] = useState<Course | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [isStudentUser, setIsStudentUser] = useState(false)

  const currentUser = useCurrentUser()
  const roleKey = (currentUser?.roleKey || currentUser?.role)?.toString().toLowerCase()
  const isAdmin =
    hasFullAccessRole(currentUser?.roleKey) ||
    hasFullAccessRole(currentUser?.role) ||
    roleKey === "admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "אדמין" ||
    currentUser?.role === "מנהל"
  const userPerms = currentUser?.permissions || []
  const canEditCourses = isAdmin || hasPermission(userPerms, "courses.edit")
  const canTabGeneral = isAdmin || hasPermission(userPerms, "courses.tab.general")
  const canTabStudents = isAdmin || hasPermission(userPerms, "courses.tab.students")
  const canTabPayments = isAdmin || hasPermission(userPerms, "courses.tab.payments")
  const canTabAttendanceStudents = isAdmin || hasPermission(userPerms, "courses.tab.attendance.students")
  const canTabAttendanceTeachers = isAdmin || hasPermission(userPerms, "courses.tab.attendance.teachers")
  const canTabSessionsFeedback = isAdmin || hasPermission(userPerms, "courses.tab.feedback") || hasPermission(userPerms, "courses.tab.attendance.students")
  const isCampCourse = !!(course && isCampCourseType(course.courseType))
  const canTabCamp = isCampCourse && (isAdmin || hasPermission(userPerms, "courses.tab.camp"))
  const [centerName, setCenterName] = useState("")
  const [centerLogo, setCenterLogo] = useState("")
  const [attendanceList, setAttendanceList] = useState<{ id: string; studentId: string | null; teacherId: string | null; date: string; status: string; notes?: string | null; createdByUserName?: string | null }[]>([])
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0])
  const [attendanceByStudent, setAttendanceByStudent] = useState<Record<string, string>>({})
  const [savingByStudent, setSavingByStudent] = useState<Record<string, boolean>>({})
  const [sessions, setSessions] = useState<CourseSessionItem[]>([])
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().split("T")[0])
  const [newSessionTopic, setNewSessionTopic] = useState("")
  const [savingSession, setSavingSession] = useState(false)
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, Record<string, string>>>({})
  const [savingFeedbackBySession, setSavingFeedbackBySession] = useState<Record<string, boolean>>({})
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
  const [payStudentId, setPayStudentId] = useState("")
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState<"cash" | "credit" | "transfer" | "check" | "bit">("cash")
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0])
  const [payDescription, setPayDescription] = useState("")
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [paidStudentIds, setPaidStudentIds] = useState<string[]>([])
  const [paymentsForCourse, setPaymentsForCourse] = useState<CoursePaymentRow[]>([])
  const campGroups = HEBREW_GROUP_LETTERS

  useEffect(() => {
    if (!currentUser?.id) return
    fetch(`/api/students/by-user/${currentUser.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setIsStudentUser(true) })
      .catch(() => {})
  }, [currentUser?.id])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseRes, teachersRes, enrollmentsRes, settingsRes] = await Promise.all([
          fetch(`/api/courses/${id}`),
          fetch("/api/teachers"),
          fetch(`/api/enrollments?courseId=${id}`),
          fetch("/api/settings"),
        ])
        if (courseRes.ok) {
          const data = await courseRes.json()
          setCourse(data)
        }
        if (teachersRes.ok) {
          const data = await teachersRes.json()
          setTeachers(Array.isArray(data) ? data : [])
        }
        if (enrollmentsRes.ok) {
          const data = await enrollmentsRes.json()
          setEnrollments(Array.isArray(data) ? data : [])
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json()
          setCenterName(String(s.center_name || ""))
          setCenterLogo(String(s.logo || ""))
        }
      } catch (err) {
        console.error("Failed to fetch data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  useEffect(() => {
    if ((!canTabAttendanceStudents && !canTabAttendanceTeachers) || !id) return
    fetch(`/api/attendance?courseId=${id}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setAttendanceList(Array.isArray(data) ? data : []))
      .catch(() => setAttendanceList([]))
  }, [id, canTabAttendanceStudents, canTabAttendanceTeachers])

  useEffect(() => {
    if (!canTabAttendanceStudents || !id || !attendanceDate) return
    fetch(`/api/attendance?courseId=${id}&date=${attendanceDate}`)
      .then((res) => res.ok ? res.json() : [])
      .then((rows) => {
        const next: Record<string, string> = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r: any) => {
          if (r?.studentId) next[String(r.studentId)] = String(r.status || "")
        })
        setAttendanceByStudent(next)
      })
      .catch(() => setAttendanceByStudent({}))
  }, [id, attendanceDate, canTabAttendanceStudents])

  async function loadCoursePayments() {
    if (!canTabPayments) return
    if (!enrollments.length) {
      setPaidStudentIds([])
      setPaymentsForCourse([])
      return
    }
    try {
      const res = await fetch("/api/payments")
      if (!res.ok) {
        setPaidStudentIds([])
        setPaymentsForCourse([])
        return
      }
      const rows = await res.json()
      const enrolledByStudentId = new Map(enrollments.map((e) => [e.studentId, e]))
      const paymentRows: CoursePaymentRow[] = []
      const paidSet = new Set<string>()
      for (const row of Array.isArray(rows) ? rows : []) {
        const sid = row?.studentId ? String(row.studentId) : ""
        const enr = sid ? enrolledByStudentId.get(sid) : undefined
        if (!sid || !enr) continue
        paidSet.add(sid)
        paymentRows.push({
          id: String(row.id || crypto.randomUUID()),
          studentId: sid,
          studentName: String(row.studentName || enr.studentName || "—"),
          paymentDate: String(row.paymentDate || ""),
          paymentType: row.paymentType ? String(row.paymentType) : null,
          amount: Number(row.amount || 0),
          description: row.description ? String(row.description) : null,
          siblingDiscountPackageName: enr.siblingDiscountPackageName || null,
        })
      }
      setPaidStudentIds(Array.from(paidSet))
      setPaymentsForCourse(paymentRows)
    } catch {
      setPaidStudentIds([])
      setPaymentsForCourse([])
    }
  }

  useEffect(() => {
    loadCoursePayments()
  }, [canTabPayments, enrollments])

  useEffect(() => {
    if (!id || !canTabSessionsFeedback) return
    fetch(`/api/course-sessions?courseId=${id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setSessions(list)
        const next: Record<string, Record<string, string>> = {}
        for (const s of list as CourseSessionItem[]) {
          const byStudent: Record<string, string> = {}
          for (const f of s.feedback || []) byStudent[String(f.studentId)] = String(f.feedbackText || "")
          next[String(s.id)] = byStudent
        }
        setFeedbackDrafts(next)
      })
      .catch(() => setSessions([]))
  }, [id, canTabSessionsFeedback])

  async function handleAddSession() {
    if (!newSessionDate || !id || savingSession) return
    setSavingSession(true)
    try {
      const res = await fetch("/api/course-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: id, sessionDate: newSessionDate, generalTopic: newSessionTopic }),
      })
      if (!res.ok) throw new Error("failed")
      const listRes = await fetch(`/api/course-sessions?courseId=${id}`)
      const list = listRes.ok ? await listRes.json() : []
      setSessions(Array.isArray(list) ? list : [])
      setNewSessionTopic("")
    } catch {
      // ignore
    } finally {
      setSavingSession(false)
    }
  }

  async function handleSaveSessionFeedback(sessionId: string) {
    if (!id || savingFeedbackBySession[sessionId]) return
    const byStudent = feedbackDrafts[sessionId] || {}
    const payload = Object.entries(byStudent).map(([studentId, feedbackText]) => ({ studentId, feedbackText }))
    setSavingFeedbackBySession((p) => ({ ...p, [sessionId]: true }))
    try {
      const res = await fetch(`/api/course-sessions/${sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbacks: payload }),
      })
      if (!res.ok) throw new Error("failed")
    } catch {
      // ignore
    } finally {
      setSavingFeedbackBySession((p) => ({ ...p, [sessionId]: false }))
    }
  }

  async function saveEnrollmentCampGroup(enrollmentId: string, campGroupLabel: string) {
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campGroupLabel: campGroupLabel || null }),
      })
      if (!res.ok) return
      const enrollmentsRes = await fetch(`/api/enrollments?courseId=${id}`)
      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json()
        setEnrollments(Array.isArray(data) ? data : [])
      }
    } catch {
      // ignore
    }
  }

  async function saveStudentAttendance(studentId: string, status: "present" | "absent" | "sick" | "vacation") {
    const prev = attendanceByStudent[studentId]
    setAttendanceByStudent((p) => ({ ...p, [studentId]: status }))
    setSavingByStudent((p) => ({ ...p, [studentId]: true }))
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          courseId: id,
          date: attendanceDate,
          status,
        }),
      })
      if (!res.ok) throw new Error("Failed to save attendance")
      const allRes = await fetch(`/api/attendance?courseId=${id}`)
      const allRows = allRes.ok ? await allRes.json() : []
      setAttendanceList(Array.isArray(allRows) ? allRows : [])
    } catch {
      setAttendanceByStudent((p) => ({ ...p, [studentId]: prev }))
    } finally {
      setSavingByStudent((p) => ({ ...p, [studentId]: false }))
    }
  }

  async function addCoursePayment() {
    if (!payStudentId || !payAmount || Number(payAmount) <= 0) return
    setIsAddingPayment(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: payStudentId,
          amount: Number(payAmount),
          date: payDate,
          paymentMethod: payMethod,
          description: payDescription.trim() || `תשלום לקורס: ${course?.name || ""}`,
        }),
      })
      if (!res.ok) throw new Error("Failed to create payment")
      await loadCoursePayments()
      setIsAddPaymentOpen(false)
      setPayStudentId("")
      setPayAmount("")
      setPayMethod("cash")
      setPayDate(new Date().toISOString().split("T")[0])
      setPayDescription("")
    } catch {
      // keep silent as existing page style
    } finally {
      setIsAddingPayment(false)
    }
  }

  function attendanceStatusButton(studentId: string, status: "present" | "absent" | "sick" | "vacation", label: string, Icon: any) {
    const isActive = attendanceByStudent[studentId] === status
    const isSaving = !!savingByStudent[studentId]
    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        className={`gap-1 min-h-[40px] text-xs px-2 ${
          isActive
            ? status === "present"
              ? "bg-green-600 hover:bg-green-700"
              : status === "absent"
                ? "bg-red-600 hover:bg-red-700"
                : status === "sick"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-blue-600 hover:bg-blue-700"
            : "bg-transparent"
        }`}
        disabled={isSaving}
        onClick={() => saveStudentAttendance(studentId, status)}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!course) {
    return <div className="p-3 text-center sm:p-6">{tr.notFound}</div>
  }

  const enrollmentsWithPayments = enrollments.filter((e) => paidStudentIds.includes(e.studentId))
  const paymentTypeLabel = (type: string | null | undefined) => {
    if (type === "cash") return "מזומן"
    if (type === "credit") return "אשראי"
    if (type === "transfer") return "העברה בנקאית"
    if (type === "check") return "שיק"
    if (type === "bit") return "ביט"
    return "—"
  }

  const courseTeachers = teachers.filter(t => 
    course.teacherIds && course.teacherIds.includes(t.id)
  )
  const expectedTotalByEnrollments = enrollments.reduce((sum, e) => sum + Number((e as any).coursePrice || 0), 0)

  const daysOfWeek = Array.isArray(course.daysOfWeek) ? course.daysOfWeek : []
  const isTotalPriceMode =
    typeof (course as any).courseType === "string" &&
    (
      (course as any).courseType.endsWith("_total") ||
      (course as any).courseType.endsWith("_session") ||
      (course as any).courseType.endsWith("_hour")
    )
  const statusPres = getCourseStatusPresentation({
    status: course.status,
    endDate: course.endDate,
  })

  const visibleTabCount = [
    canTabGeneral,
    canTabSessionsFeedback,
    !isStudentUser && canTabStudents,
    canTabCamp,
    !isStudentUser && canTabPayments,
    canTabAttendanceStudents,
    canTabAttendanceTeachers,
  ].filter(Boolean).length

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="container mx-auto max-w-[1400px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/courses">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold sm:text-3xl">{tr.courseDetails}</h1>
            <p className="mt-1 break-words text-sm text-muted-foreground sm:text-base">
              <Link href="/dashboard/courses" className="hover:underline">{tr.courses}</Link>
              {" > "}
              <span className="font-medium text-foreground">{course.name}</span>
            </p>
          </div>
        </div>

        {!isStudentUser && canEditCourses && (
          <Link href={`/dashboard/courses/${course.id}/edit`} className="w-full shrink-0 sm:w-auto">
            <Button className="w-full gap-2 sm:w-auto">
              <Pencil className="h-4 w-4" />
              {tr.editCourse}
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs - לפי הרשאות טאב בכרטסת קורס */}
      <Tabs defaultValue={canTabGeneral ? "general" : canTabSessionsFeedback ? "sessions-feedback" : !isStudentUser && canTabStudents ? "students" : canTabCamp ? "camp" : !isStudentUser && canTabPayments ? "payments" : canTabAttendanceStudents ? "attendance-students" : "attendance-teachers"} className="w-full" dir={isRtl ? "rtl" : "ltr"}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <TabsList
            className="mb-4 flex h-auto min-h-10 w-max min-w-full max-w-none flex-nowrap justify-start gap-1 overflow-x-auto p-[3px] sm:mb-6 md:grid md:w-full md:max-w-full md:overflow-visible"
            style={
              visibleTabCount > 0
                ? { gridTemplateColumns: `repeat(${visibleTabCount}, minmax(0, 1fr))` }
                : undefined
            }
            dir={isRtl ? "rtl" : "ltr"}
          >
            {canTabGeneral && (
              <TabsTrigger value="general" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.general}
              </TabsTrigger>
            )}
            {canTabSessionsFeedback && (
              <TabsTrigger value="sessions-feedback" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.sessionsFeedback}
              </TabsTrigger>
            )}
            {!isStudentUser && canTabStudents && (
              <TabsTrigger value="students" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.linkedStudents}
              </TabsTrigger>
            )}
            {canTabCamp && (
              <TabsTrigger value="camp" className="shrink-0 gap-1 px-2 text-xs sm:text-sm md:min-w-0">
                <CalendarRange className="h-3.5 w-3.5 opacity-70" />
                {locale === "ar" ? "مخيم" : locale === "en" ? "Camp" : "קייטנה"}
              </TabsTrigger>
            )}
            {!isStudentUser && canTabPayments && (
              <TabsTrigger value="payments" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.costPayments}
              </TabsTrigger>
            )}
            {canTabAttendanceStudents && (
              <TabsTrigger value="attendance-students" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.studentAttendance}
              </TabsTrigger>
            )}
            {canTabAttendanceTeachers && (
              <TabsTrigger value="attendance-teachers" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.teacherAttendance}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {canTabGeneral && (
        <TabsContent value="general" className="space-y-6">
          {/* First Row - Course Details & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
            {/* Course Details Card */}
            <Card>
              <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg">{tr.courseInfo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.level}:</span>
                  <span className="font-medium">{levelLabels[course.level || "beginner"]?.[locale] || course.level || "-"}</span>
                </div>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.duration}:</span>
                  <span className="font-medium">{course.duration || 0} {tr.weeks}</span>
                </div>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.status}:</span>
                  <Badge className={statusPres.badgeClassName}>
                    {locale === "ar" ? statusPres.labelAr : locale === "en" ? statusPres.labelEn : statusPres.labelHe}
                  </Badge>
                </div>
                {!isStudentUser && currentUser?.role?.toLowerCase?.() === "admin" && (
                  <div className="flex flex-row-reverse justify-between items-center">
                    <span className="text-muted-foreground">{isTotalPriceMode ? `${tr.totalCoursePrice}:` : `${tr.pricePerStudent}:`}</span>
                    <span className="font-medium text-blue-600 text-xl">₪{course.price || 0}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dates & Times Card */}
            <Card>
              <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <CardTitle className="text-lg">{tr.dateTime}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.startDate}:</span>
                  <span className="font-medium">{course.startDate ? new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(course.startDate)) : "-"}</span>
                </div>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.endDate}:</span>
                  <span className="font-medium">{course.endDate ? new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(course.endDate)) : "-"}</span>
                </div>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.startTime}:</span>
                  <span className="font-medium">{courseTimeToDisplayValue(course.startTime) || "-"}</span>
                </div>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.endTime}:</span>
                  <span className="font-medium">{courseTimeToDisplayValue(course.endTime) || "-"}</span>
                </div>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.weekdays}:</span>
                  <div className="flex gap-1 flex-wrap flex-row-reverse">
                    {daysOfWeek.length > 0 ? daysOfWeek.map(day => (
                      <Badge key={day} variant="outline" className="text-xs">
                        {dayLabels[day]?.[locale] || day}
                      </Badge>
                    )) : "-"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row - Statistics & Teachers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
            {/* Statistics Card */}
            <Card>
              <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-gray-600" />
                </div>
                <CardTitle className="text-lg">{tr.stats}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-row-reverse justify-between items-center">
                  <span className="text-muted-foreground">{tr.totalStudents}:</span>
                  <span className="font-bold text-2xl text-blue-600">{enrollments.length}</span>
                </div>
                <div className="mt-3 flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                  <span className="break-words text-sm text-muted-foreground sm:text-base">עלות משוערת אחרי הנחות אחים:</span>
                  <span className="shrink-0 font-bold text-xl text-emerald-600">₪{expectedTotalByEnrollments.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Teachers Card */}
            <Card>
              <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="h-5 w-5 text-gray-600" />
                </div>
                <CardTitle className="text-lg">{tr.teachers}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap flex-row-reverse justify-start">
                  {courseTeachers.length > 0 ? courseTeachers.map(teacher => (
                    <Badge key={teacher.id} variant="outline" className="text-sm py-2 px-4">
                      {teacher.name}
                    </Badge>
                  )) : (
                    <span className="text-muted-foreground">{tr.noTeachers}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        )}

        {canTabSessionsFeedback && (
          <TabsContent value="sessions-feedback" className="space-y-4">
            {!isStudentUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{tr.newSession}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{tr.sessionDate}</div>
                      <input
                        type="date"
                        value={newSessionDate}
                        onChange={(e) => setNewSessionDate(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{tr.generalTopic}</div>
                      <Textarea value={newSessionTopic} onChange={(e) => setNewSessionTopic(e.target.value)} rows={2} />
                    </div>
                  </div>
                  <Button onClick={handleAddSession} disabled={savingSession}>
                    {savingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : tr.addSession}
                  </Button>
                </CardContent>
              </Card>
            )}

            {sessions.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground">{tr.noSessionsYet}</CardContent></Card>
            ) : sessions.map((s) => {
              const ownFeedback = (s.feedback || [])[0]?.feedbackText || ""
              return (
                <Card key={s.id}>
                  <CardHeader>
                    <CardTitle className="break-words text-base leading-snug">
                      {new Date(s.sessionDate).toLocaleDateString(localeTag)} - {s.generalTopic || "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isStudentUser ? (
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">{tr.yourFeedback}</div>
                        <div className="rounded-md border p-3">{ownFeedback || "—"}</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {enrollments.map((enr) => (
                          <div key={`${s.id}-${enr.studentId}`}>
                            <div className="text-sm mb-1">{enr.studentName}</div>
                            <Textarea
                              rows={2}
                              value={feedbackDrafts[s.id]?.[enr.studentId] ?? ""}
                              onChange={(e) =>
                                setFeedbackDrafts((prev) => ({
                                  ...prev,
                                  [s.id]: { ...(prev[s.id] || {}), [enr.studentId]: e.target.value },
                                }))
                              }
                              placeholder={tr.feedbackForStudent}
                            />
                          </div>
                        ))}
                        <Button onClick={() => handleSaveSessionFeedback(s.id)} disabled={savingFeedbackBySession[s.id]}>
                          {savingFeedbackBySession[s.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : tr.saveFeedback}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        )}

        {!isStudentUser && canTabStudents && (
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tr.enrolledStudents} ({enrollments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">{tr.student}</TableHead>
                        <TableHead className="text-right">{tr.status}</TableHead>
                        <TableHead className="text-right">{tr.enrollmentDate}</TableHead>
                        <TableHead className="text-right">{tr.siblingPackage}</TableHead>
                        <TableHead className="text-right">{tr.siblingRank}</TableHead>
                        <TableHead className="text-right">{tr.packageSource}</TableHead>
                        <TableHead className="text-right">{tr.performedBy}</TableHead>
                        {isCampCourse && (
                          <TableHead className="text-right">
                            {locale === "ar" ? "المجموعة" : locale === "en" ? "Camp group" : "קבוצת קייטנה"}
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium text-right">{enrollment.studentName || (locale === "en" ? "Unknown student" : locale === "ar" ? "طالب غير معروف" : "תלמיד לא ידוע")}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={enrollment.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {enrollment.status === "active" ? (locale === "en" ? "Active" : locale === "ar" ? "نشط" : "פעיל") : enrollment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {enrollment.enrollmentDate ? new Date(enrollment.enrollmentDate).toLocaleDateString(localeTag) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{enrollment.siblingDiscountPackageName || "—"}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{enrollment.siblingRankLabel || "—"}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {enrollment.siblingDiscountPackageSource === "course"
                              ? tr.sourceCourse
                              : enrollment.siblingDiscountPackageSource === "student"
                                ? tr.sourceStudent
                                : "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {enrollment.createdByUserName || enrollment.createdByUserId || "—"}
                          </TableCell>
                          {isCampCourse && (
                            <TableCell className="text-right">
                              {canEditCourses && !isStudentUser ? (
                                <Select
                                  value={enrollment.campGroupLabel || "__none__"}
                                  onValueChange={(v) =>
                                    saveEnrollmentCampGroup(enrollment.id, v === "__none__" ? "" : v)
                                  }
                                >
                                  <SelectTrigger className="w-[min(100%,200px)]">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {campGroups.map((g) => (
                                      <SelectItem key={g} value={g}>
                                        {g}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground">
                                  {enrollment.campGroupLabel || "—"}
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {tr.noneStudents}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canTabCamp && (
          <TabsContent value="camp" className="space-y-4">
            <CourseCampTab courseId={id} canEdit={!isStudentUser && canEditCourses} />
          </TabsContent>
        )}

        {!isStudentUser && canTabPayments && (
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-end">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setIsAddPaymentOpen(true)}
                  >
                    + הוספת תשלום
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => {
                    const w = window.open("", "_blank")
                    if (!w) return
                    const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>עלות ותשלומים - ${course?.name || ""}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:980px;margin:0 auto}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}.header h1{font-size:22px;color:#1e40af;margin-top:6px}.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}.summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 16px}.box{border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;padding:10px 12px}.label{font-size:12px;color:#1e40af}.val{font-size:18px;font-weight:700;color:#1f2937;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}td{border:1px solid #d1d5db;padding:8px 10px;text-align:center;vertical-align:middle}tr:nth-child(even) td{background:#f9fafb}@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}}</style></head><body>`)
                    w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${course.name}</h2>` : ""}<h2>דוח עלות ותשלומים</h2></div>`)
                    w.document.write(`<div class="summary"><div class="box"><div class="label">מספר תלמידים משויכים</div><div class="val">${enrollments.length}</div></div><div class="box"><div class="label">מחיר קורס לתלמיד</div><div class="val">₪${Number(course?.price || 0).toLocaleString()}</div></div></div>`)
                    w.document.write(`<table><thead><tr><th>#</th><th>שם תלמיד</th><th>תאריך תשלום</th><th>שיטת תשלום</th><th>סכום תשלום</th><th>הערות</th><th>חבילת הנחות</th></tr></thead><tbody>`)
                    paymentsForCourse.forEach((p, idx) => {
                      const d = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString(localeTag) : "—"
                      w.document.write(`<tr><td>${idx + 1}</td><td>${p.studentName || "—"}</td><td>${d}</td><td>${paymentTypeLabel(p.paymentType)}</td><td>₪${Number(p.amount || 0).toLocaleString()}</td><td>${p.description || "—"}</td><td>${p.siblingDiscountPackageName || "—"}</td></tr>`)
                    })
                    w.document.write(`</tbody></table></body></html>`)
                    w.document.close()
                    setTimeout(() => w.print(), 300)
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    הדפסת עלות ותשלומים
                  </Button>
                </div>
              </div>
              <div className="text-center text-muted-foreground">
                {tr.paymentInfoPlaceholder}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">שם תלמיד</TableHead>
                      <TableHead className="text-right">תאריך תשלום</TableHead>
                      <TableHead className="text-right">שיטת תשלום</TableHead>
                      <TableHead className="text-right">סכום תשלום</TableHead>
                      <TableHead className="text-right">הערות</TableHead>
                      <TableHead className="text-right">חבילת הנחות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsForCourse.length > 0 ? paymentsForCourse.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-right">{p.studentName || "—"}</TableCell>
                        <TableCell className="text-right">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString(localeTag) : "—"}</TableCell>
                        <TableCell className="text-right">{paymentTypeLabel(p.paymentType)}</TableCell>
                        <TableCell className="text-right">₪{Number(p.amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{p.description || "—"}</TableCell>
                        <TableCell className="text-right">{p.siblingDiscountPackageName || "—"}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground" colSpan={6}>
                          אין תלמידים עם תשלומים בקורס זה
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>הוספת תשלום לקורס</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">תלמיד משויך</div>
                  <Select value={payStudentId} onValueChange={setPayStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר תלמיד" />
                    </SelectTrigger>
                    <SelectContent>
                      {enrollments.map((e) => (
                        <SelectItem key={e.studentId} value={e.studentId}>
                          {e.studentName || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">שיטת תשלום</div>
                    <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                      <SelectTrigger>
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
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">סכום</div>
                    <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">תאריך</div>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">תיאור</div>
                  <Input value={payDescription} onChange={(e) => setPayDescription(e.target.value)} placeholder={`תשלום לקורס: ${course?.name || ""}`} />
                </div>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={addCoursePayment} disabled={isAddingPayment}>
                  {isAddingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  שמירת תשלום
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
        )}

        {canTabAttendanceStudents && (
        <TabsContent value="attendance-students" className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CalendarCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-lg">{tr.studentAttendanceTitle}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{tr.date}:</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => {
                      const w = window.open("", "_blank")
                      if (!w) return
                      const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                      const dateStr = new Date(attendanceDate).toLocaleDateString(localeTag)
                      w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>רשימת נוכחות - ${course?.name || ""}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:900px;margin:0 auto}
.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}
.header h1{font-size:22px;color:#1e40af;margin-top:6px}
.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}
td{border:1px solid #d1d5db;padding:8px 10px;text-align:center;vertical-align:middle}
tr:nth-child(even) td{background:#f9fafb}
.status-present{color:#166534;font-weight:600}
.status-absent{color:#991b1b;font-weight:600}
.status-sick{color:#9a3412;font-weight:600}
.status-vacation{color:#1e40af;font-weight:600}
@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}}
</style></head><body>`)
                      w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${course.name}</h2>` : ""}<h2>רשימת נוכחות - ${dateStr}</h2></div>`)
                      w.document.write(`<table><thead><tr><th>#</th><th>שם תלמיד</th><th>קבוצה</th><th>סטטוס</th><th>חתימה</th></tr></thead><tbody>`)
                      enrollments.forEach((e, idx) => {
                        const st = attendanceByStudent[e.studentId] || ""
                        const statusText = st === "present" || st === "PRESENT" ? tr.present : st === "absent" || st === "ABSENT" ? tr.absent : st === "sick" || st === "SICK" ? tr.sick : st === "vacation" || st === "VACATION" ? tr.vacation : "—"
                        const statusClass = st === "present" || st === "PRESENT" ? "status-present" : st === "absent" || st === "ABSENT" ? "status-absent" : st === "sick" || st === "SICK" ? "status-sick" : st === "vacation" || st === "VACATION" ? "status-vacation" : ""
                        w.document.write(`<tr><td>${idx + 1}</td><td>${e.studentName || "—"}</td><td>${e.campGroupLabel ? "קבוצה " + e.campGroupLabel : "—"}</td><td class="${statusClass}">${statusText}</td><td style="min-width:80px"></td></tr>`)
                      })
                      w.document.write(`</tbody></table></body></html>`)
                      w.document.close()
                      setTimeout(() => w.print(), 300)
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    הדפסה
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const vals = Object.values(attendanceByStudent)
                const total = enrollments.length
                const present = vals.filter((s) => s === "present" || s === "PRESENT").length
                const absent = vals.filter((s) => s === "absent" || s === "ABSENT").length
                const sick = vals.filter((s) => s === "sick" || s === "SICK").length
                const vacation = vals.filter((s) => s === "vacation" || s === "VACATION").length
                const unmarked = total - present - absent - sick - vacation
                return total > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-3 text-sm">
                    <span className="rounded-md bg-green-100 text-green-800 px-3 py-1 font-medium">{tr.present}: {present}</span>
                    <span className="rounded-md bg-red-100 text-red-800 px-3 py-1 font-medium">{tr.absent}: {absent}</span>
                    <span className="rounded-md bg-orange-100 text-orange-800 px-3 py-1 font-medium">{tr.sick}: {sick}</span>
                    <span className="rounded-md bg-blue-100 text-blue-800 px-3 py-1 font-medium">{tr.vacation}: {vacation}</span>
                    {unmarked > 0 && <span className="rounded-md bg-gray-100 text-gray-600 px-3 py-1 font-medium">טרם סומן: {unmarked}</span>}
                  </div>
                ) : null
              })()}
              <div className="mb-6 overflow-x-auto rounded-md border">
                <Table className="min-w-0">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="max-w-[40%] text-right sm:max-w-none">{tr.student}</TableHead>
                      <TableHead className="text-right">{tr.attendanceStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.length > 0 ? enrollments.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="max-w-[40%] break-words text-right font-medium sm:max-w-none">{enrollment.studentName || "—"}</TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-2">
                            {attendanceStatusButton(enrollment.studentId, "present", tr.present, Check)}
                            {attendanceStatusButton(enrollment.studentId, "absent", tr.absent, X)}
                            {attendanceStatusButton(enrollment.studentId, "sick", tr.sick, Thermometer)}
                            {attendanceStatusButton(enrollment.studentId, "vacation", tr.vacation, Plane)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground" colSpan={2}>
                          {tr.noLinkedStudents}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                const studentAttendance = attendanceList.filter((a) => a.studentId != null)
                return studentAttendance.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right">{tr.date}</TableHead>
                          <TableHead className="text-right">{tr.student}</TableHead>
                          <TableHead className="text-right">{tr.status}</TableHead>
                          <TableHead className="text-right">{tr.note}</TableHead>
                          <TableHead className="text-right">{tr.performedBy}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentAttendance.map((a) => {
                          const enrollment = enrollments.find((e) => e.studentId === a.studentId)
                          const studentName = enrollment?.studentName ?? "—"
                          const statusLabel = a.status === "present" || a.status === "PRESENT" ? tr.present : a.status === "absent" || a.status === "ABSENT" ? tr.absent : a.status
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="text-right">{new Date(a.date).toLocaleDateString(localeTag)}</TableCell>
                              <TableCell className="text-right">{studentName}</TableCell>
                              <TableCell className="text-right">{statusLabel}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{a.notes ?? "—"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{a.createdByUserName || "—"}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">{tr.noStudentAttendance}</p>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canTabAttendanceTeachers && (
        <TabsContent value="attendance-teachers" className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CalendarCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-lg">{tr.teacherAttendanceTitle}</CardTitle>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    const teacherAtt = attendanceList.filter((a) => a.teacherId != null)
                    const w = window.open("", "_blank")
                    if (!w) return
                    const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                    const startDisp = courseTimeToDisplayValue(course?.startTime) || "—"
                    const endDisp = courseTimeToDisplayValue(course?.endTime) || "—"
                    const parseHM = (t: string) => { const m = /^(\d{2}):(\d{2})$/.exec(t); return m ? Number(m[1]) + Number(m[2]) / 60 : 0 }
                    const totalH = startDisp !== "—" && endDisp !== "—" ? Math.max(0, parseHM(endDisp) - parseHM(startDisp)) : 0
                    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>נוכחות מורים - ${course?.name || ""}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:900px;margin:0 auto}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}.header h1{font-size:22px;color:#1e40af;margin-top:6px}.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}td{border:1px solid #d1d5db;padding:8px 10px;text-align:center;vertical-align:middle}tr:nth-child(even) td{background:#f9fafb}.status-present{color:#166534;font-weight:600}.status-absent{color:#991b1b;font-weight:600}@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}}</style></head><body>`)
                    w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${course.name}</h2>` : ""}<h2>נוכחות מורים</h2></div>`)
                    w.document.write(`<table><thead><tr><th>#</th><th>תאריך</th><th>מורה</th><th>משעה</th><th>עד שעה</th><th>סה"כ שעות</th><th>סטטוס</th><th>הערה</th></tr></thead><tbody>`)
                    teacherAtt.forEach((a, idx) => {
                      const teacher = teachers.find((t) => t.id === a.teacherId)
                      const statusLabel = a.status === "present" || a.status === "PRESENT" ? "נוכח" : a.status === "absent" || a.status === "ABSENT" ? "חיסור" : a.status
                      const cls = a.status === "present" || a.status === "PRESENT" ? "status-present" : "status-absent"
                      w.document.write(`<tr><td>${idx + 1}</td><td>${new Date(a.date).toLocaleDateString("he-IL")}</td><td>${teacher?.name || "—"}</td><td>${startDisp}</td><td>${endDisp}</td><td>${totalH > 0 ? totalH.toFixed(1) : "—"}</td><td class="${cls}">${statusLabel}</td><td>${a.notes || "—"}</td></tr>`)
                    })
                    w.document.write(`</tbody></table></body></html>`)
                    w.document.close()
                    setTimeout(() => w.print(), 300)
                  }}
                >
                  <Printer className="h-4 w-4" />
                  הדפסה
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const teacherAttendance = attendanceList.filter((a) => a.teacherId != null)
                return teacherAttendance.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[660px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right">{tr.date}</TableHead>
                          <TableHead className="text-right">{tr.teachers}</TableHead>
                          <TableHead className="text-center">משעה</TableHead>
                          <TableHead className="text-center">עד שעה</TableHead>
                          <TableHead className="text-center">סה&quot;כ שעות</TableHead>
                          <TableHead className="text-right">{tr.status}</TableHead>
                          <TableHead className="text-right">{tr.note}</TableHead>
                          <TableHead className="text-right">{tr.performedBy}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const startDisp = courseTimeToDisplayValue(course?.startTime) || "—"
                          const endDisp = courseTimeToDisplayValue(course?.endTime) || "—"
                          const parseHM = (t: string) => { const m = /^(\d{2}):(\d{2})$/.exec(t); return m ? Number(m[1]) + Number(m[2]) / 60 : 0 }
                          const totalH = startDisp !== "—" && endDisp !== "—" ? Math.max(0, parseHM(endDisp) - parseHM(startDisp)) : 0
                          return teacherAttendance.map((a) => {
                            const teacher = teachers.find((t) => t.id === a.teacherId)
                            const teacherName = teacher?.name ?? "—"
                            const statusLabel = a.status === "present" || a.status === "PRESENT" ? tr.present : a.status === "absent" || a.status === "ABSENT" ? tr.absent : a.status
                            return (
                              <TableRow key={a.id}>
                                <TableCell className="text-right">{new Date(a.date).toLocaleDateString(localeTag)}</TableCell>
                                <TableCell className="text-right">{teacherName}</TableCell>
                                <TableCell className="text-center">{startDisp}</TableCell>
                                <TableCell className="text-center">{endDisp}</TableCell>
                                <TableCell className="text-center font-medium">{totalH > 0 ? totalH.toFixed(1) : "—"}</TableCell>
                                <TableCell className="text-right">{statusLabel}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{a.notes ?? "—"}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{a.createdByUserName || "—"}</TableCell>
                              </TableRow>
                            )
                          })
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">{tr.noTeacherAttendance}</p>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
