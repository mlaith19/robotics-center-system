"use client"

import { Fragment, useState, useEffect, useMemo } from "react"
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
import { ArrowRight, Pencil, Loader2, BookOpen, Calendar, Users, BarChart3, CalendarCheck, Check, X, Thermometer, Plane, CalendarRange, Printer, Layers, Trash2, Clock } from "lucide-react"
import { courseTimeToDisplayValue, normalizeCourseCalendarYmd } from "@/lib/course-db-fields"
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
  /** קבוצת אחים מ־Student — למיון רציף ברשימת נוכחות */
  siblingGroupId?: string | null
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

const JS_DAY_TO_KEY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

function formatCourseSessionDateOption(ymd: string, locale: "he" | "en" | "ar"): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return ymd
  const tag = locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "he-IL"
  const cal = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(dt)
  const key = JS_DAY_TO_KEY[dt.getDay()]
  const dayName = dayLabels[key]?.[locale] || key
  return `${cal} · ${dayName}`
}

function attendanceSlotTimeDisplay(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (!s) return "—"
  const hm = /^(\d{1,2}):(\d{2})/.exec(s)
  if (hm) {
    const h = hm[1]!.padStart(2, "0")
    return `${h}:${hm[2]}`
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  }
  return "—"
}

function attendanceHoursFromSlots(
  hours: unknown,
  slotStart: unknown,
  slotEnd: unknown,
  courseStart: string | null | undefined,
  courseEnd: string | null | undefined,
): string {
  if (hours != null && hours !== "") {
    const n = Number(hours)
    if (!Number.isNaN(n) && n >= 0) return n.toFixed(1)
  }
  const parseHM = (t: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(t)
    return m ? Number(m[1]) + Number(m[2]) / 60 : 0
  }
  let sd = attendanceSlotTimeDisplay(slotStart)
  let ed = attendanceSlotTimeDisplay(slotEnd)
  if (sd === "—" || ed === "—") {
    sd = courseTimeToDisplayValue(courseStart) || "—"
    ed = courseTimeToDisplayValue(courseEnd) || "—"
  }
  if (sd !== "—" && ed !== "—") {
    const total = Math.max(0, parseHM(ed) - parseHM(sd))
    return total > 0 ? total.toFixed(1) : "—"
  }
  return "—"
}

function attendanceHoursToNumber(
  hours: unknown,
  slotStart: unknown,
  slotEnd: unknown,
  courseStart: string | null | undefined,
  courseEnd: string | null | undefined,
): number {
  const str = attendanceHoursFromSlots(hours, slotStart, slotEnd, courseStart, courseEnd)
  if (str === "—") return 0
  const n = Number(str)
  return Number.isNaN(n) || n < 0 ? 0 : n
}

const TEACHER_HOURS_CHIP_STYLES = [
  "border-violet-300/80 bg-gradient-to-br from-violet-50 to-violet-100/90 text-violet-950 shadow-sm",
  "border-sky-300/80 bg-gradient-to-br from-sky-50 to-sky-100/90 text-sky-950 shadow-sm",
  "border-amber-300/80 bg-gradient-to-br from-amber-50 to-amber-100/90 text-amber-950 shadow-sm",
  "border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-emerald-100/90 text-emerald-950 shadow-sm",
  "border-rose-300/80 bg-gradient-to-br from-rose-50 to-rose-100/90 text-rose-950 shadow-sm",
  "border-indigo-300/80 bg-gradient-to-br from-indigo-50 to-indigo-100/90 text-indigo-950 shadow-sm",
] as const

/** פס צבע לשורה בטבלת נוכחות מורה — תואם לסדר הצבעים בכרטיסי הסיכום; ! כדי לנצח hover:bg-muted/50 של TableRow */
const TEACHER_ROW_ACCENT_STYLES = [
  "border-s-[3px] border-s-violet-500 !bg-violet-100/85 hover:!bg-violet-100 data-[state=selected]:!bg-violet-100",
  "border-s-[3px] border-s-sky-500 !bg-sky-100/85 hover:!bg-sky-100 data-[state=selected]:!bg-sky-100",
  "border-s-[3px] border-s-amber-500 !bg-amber-100/85 hover:!bg-amber-100 data-[state=selected]:!bg-amber-100",
  "border-s-[3px] border-s-emerald-500 !bg-emerald-100/85 hover:!bg-emerald-100 data-[state=selected]:!bg-emerald-100",
  "border-s-[3px] border-s-rose-500 !bg-rose-100/85 hover:!bg-rose-100 data-[state=selected]:!bg-rose-100",
  "border-s-[3px] border-s-indigo-500 !bg-indigo-100/85 hover:!bg-indigo-100 data-[state=selected]:!bg-indigo-100",
] as const

function attendanceDateYmdForSort(raw: string): string {
  const head = String(raw ?? "").trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : String(raw ?? "")
}

/** תואם ל־DB (עברית «נוכח») ולערכים באנגלית */
function isTeacherAttendancePresentStatus(status: unknown): boolean {
  const s = String(status ?? "").trim()
  if (!s) return false
  if (s === "נוכח") return true
  const low = s.toLowerCase()
  return low === "present"
}

function slotStartDecimalForSort(
  campSlotStart: unknown,
  courseStart: string | null | undefined,
): number {
  const disp = attendanceSlotTimeDisplay(campSlotStart)
  if (disp !== "—") {
    const m = /^(\d{1,2}):(\d{2})$/.exec(disp)
    if (m) return Number(m[1]) + Number(m[2]) / 60
  }
  const cv = courseTimeToDisplayValue(courseStart) || ""
  const m2 = /^(\d{1,2}):(\d{2})$/.exec(cv)
  return m2 ? Number(m2[1]) + Number(m2[2]) / 60 : 0
}

type TeacherAttRow = {
  id: string
  teacherId: string | null
  date: string
  campSlotStart?: string | null
  [k: string]: unknown
}

function compareTeacherAttendanceRows(
  a: TeacherAttRow,
  b: TeacherAttRow,
  courseStart: string | null | undefined,
  nameOf: (teacherId: string | null) => string,
): number {
  const da = attendanceDateYmdForSort(a.date)
  const db = attendanceDateYmdForSort(b.date)
  const dc = da.localeCompare(db)
  if (dc !== 0) return dc
  const na = nameOf(a.teacherId)
  const nb = nameOf(b.teacherId)
  const nc = na.localeCompare(nb, "he", { sensitivity: "base" })
  if (nc !== 0) return nc
  const ta = slotStartDecimalForSort(a.campSlotStart, courseStart)
  const tb = slotStartDecimalForSort(b.campSlotStart, courseStart)
  if (ta !== tb) return ta - tb
  return String(a.id).localeCompare(String(b.id))
}

import { useCurrentUser } from "@/lib/auth-context"
import {
  hasPermission,
  hasFullAccessRole,
  canDeleteTeacherAttendanceRecord,
  campCourseTabCan,
} from "@/lib/permissions"
import { getCourseStatusPresentation } from "@/lib/course-status"
import { HEBREW_GROUP_LETTERS, isCampCourseType, listCampSessionDates } from "@/lib/camp-kaytana"
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
    campGroupsTab: locale === "ar" ? "المجموعات" : locale === "en" ? "Groups" : "קבוצות",
    campGroupsTabTitle:
      locale === "ar" ? "الطلاب حسب مجموعة المخيّم" : locale === "en" ? "Students by camp group" : "תלמידים לפי קבוצת קייטנה",
    studentsInGroup:
      locale === "ar" ? "عدد الطلاب في المجموعة" : locale === "en" ? "Students in this group" : "תלמידים בקבוצה",
    unassignedCampGroup:
      locale === "ar" ? "بدون مجموعة" : locale === "en" ? "Unassigned" : "ללא קבוצה",
    noCampGroupAssignments:
      locale === "ar"
        ? "لا يوجد طلاب مخصصون لمجموعات بعد."
        : locale === "en"
          ? "No students are assigned to a camp group yet."
          : "אין עדיין תלמידים משויכים לקבוצות. ניתן לשבץ בטאב «ילדים משויכים».",
    costPayments: locale === "ar" ? "المدفوعات" : locale === "en" ? "Payments" : "תשלומים",
    debtors: locale === "ar" ? "المدينون" : locale === "en" ? "Debtors" : "חייבים",
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
    campLessonCol: locale === "ar" ? "الدرس" : locale === "en" ? "Lesson" : "שיעור",
    campNoTeacherSlots:
      locale === "ar"
        ? "لا يوجد حصص مخصصة لك في جدول المخيم لهذا التاريخ."
        : locale === "en"
          ? "No camp slots are assigned to you on this date."
          : "אין שיבוץ שלך בלוח המפגשים לתאריך זה.",
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
    teacherHoursGrandTotal:
      locale === "ar"
        ? "الإجمالي العام"
        : locale === "en"
          ? "General total"
          : "סה״כ כללי",
    hoursShort: locale === "ar" ? "س" : locale === "en" ? "h" : "ש׳",
    actions: locale === "ar" ? "إجراءات" : locale === "en" ? "Actions" : "פעולות",
    deleteTeacherAttendanceConfirm:
      locale === "ar"
        ? "حذف سجل حضور المعلم؟"
        : locale === "en"
          ? "Delete this teacher attendance record?"
          : "למחוק את רשומת נוכחות המורה?",
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
  const isCampCourse = !!(course && isCampCourseType(course.courseType))
  const campTab = (tab: Parameters<typeof campCourseTabCan>[1], level: "view" | "edit" | "delete") =>
    campCourseTabCan(userPerms, tab, level, { isCampCourse: true })

  const canTabGeneral =
    isAdmin ||
    (isCampCourse ? campTab("general", "view") : hasPermission(userPerms, "courses.tab.general"))
  const canTabStudents =
    isAdmin ||
    (isCampCourse ? campTab("students", "view") : hasPermission(userPerms, "courses.tab.students"))
  const canTabPayments =
    isAdmin ||
    (isCampCourse ? campTab("payments", "view") : hasPermission(userPerms, "courses.tab.payments"))
  const canTabAttendanceStudents =
    isAdmin ||
    (isCampCourse
      ? campTab("attendanceStudents", "view")
      : hasPermission(userPerms, "courses.tab.attendance.students"))
  const canTabAttendanceTeachers =
    isAdmin ||
    (isCampCourse
      ? campTab("attendanceTeachers", "view")
      : hasPermission(userPerms, "courses.tab.attendance.teachers"))
  const canTabSessionsFeedback =
    isAdmin ||
    (isCampCourse
      ? campTab("feedback", "view")
      : hasPermission(userPerms, "courses.tab.feedback") ||
        hasPermission(userPerms, "courses.tab.attendance.students"))
  const canTabDebtors =
    isCampCourse ? isAdmin || campTab("debtors", "view") : canTabPayments
  const canSeeCourseFinancial = isAdmin || hasPermission(userPerms, "courses.financial")
  const canTabCamp = isCampCourse && (isAdmin || campTab("campPlan", "view"))
  /** טאב קבוצות קייטנה — הרשאה נפרדת בקייטנה; אחרת נשען על טאב תלמידים */
  const canTabCampGroups =
    isCampCourse && !isStudentUser && (isAdmin || campTab("campGroups", "view"))
  const canEditCourseFromGeneralTab =
    isAdmin || (isCampCourse ? campTab("general", "edit") : canEditCourses)
  const canEditEnrollmentCampGroup = isCampCourse ? isAdmin || campTab("campGroups", "edit") : canEditCourses
  const canEditCampPlanTab = isCampCourse && (isAdmin || campTab("campPlan", "edit"))
  const canEditSessionsFeedbackTab =
    !isStudentUser &&
    (isCampCourse ? campTab("feedback", "edit") : canTabSessionsFeedback && canEditCourses)
  const canEditPaymentsTab =
    isAdmin || (isCampCourse ? campTab("payments", "edit") : canTabPayments)
  const canEditAttendanceStudentsTab =
    isAdmin || (isCampCourse ? campTab("attendanceStudents", "edit") : canTabAttendanceStudents)
  const canDeleteTeacherAttendanceRow =
    isAdmin ||
    (isCampCourse
      ? campTab("attendanceTeachers", "delete")
      : canDeleteTeacherAttendanceRecord({
          roleKey: currentUser?.roleKey,
          role: currentUser?.role,
          permissions: userPerms,
        }))

  const canLoadCampScheduleApi = useMemo(() => {
    if (!isCampCourse) return false
    return (
      isAdmin ||
      campCourseTabCan(userPerms, "campPlan", "view", { isCampCourse: true }) ||
      campCourseTabCan(userPerms, "attendanceStudents", "view", { isCampCourse: true })
    )
  }, [isCampCourse, isAdmin, userPerms])

  const [centerName, setCenterName] = useState("")
  const [centerLogo, setCenterLogo] = useState("")
  const [attendanceList, setAttendanceList] = useState<
    {
      id: string
      studentId: string | null
      teacherId: string | null
      date: string
      status: string
      notes?: string | null
      createdByUserName?: string | null
      campMeetingCellId?: string | null
      campLessonTitle?: string | null
      campSlotStart?: string | null
      campSlotEnd?: string | null
      hours?: number | string | null
    }[]
  >([])
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0])
  const [attendanceByStudent, setAttendanceByStudent] = useState<Record<string, string>>({})
  const [savingByStudent, setSavingByStudent] = useState<Record<string, boolean>>({})
  const [deletingTeacherAttendanceId, setDeletingTeacherAttendanceId] = useState<string | null>(null)
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
  /** רשימת תלמידים מסוננת לפי שיבוץ מורה בקייטנה (טאב נוכחות בלבד) */
  const [campAttendanceEnrollments, setCampAttendanceEnrollments] = useState<Enrollment[] | null>(null)
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null)
  const [campScheduleMeetings, setCampScheduleMeetings] = useState<Array<Record<string, unknown>>>([])
  const [selectedCampCellId, setSelectedCampCellId] = useState("")
  const campGroups = HEBREW_GROUP_LETTERS

  const campGroupTabsData = useMemo(() => {
    if (!isCampCourse) return [] as { label: string; members: Enrollment[] }[]
    const byLabel = new Map<string, Enrollment[]>()
    for (const e of enrollments) {
      const g = String(e.campGroupLabel || "").trim()
      if (!g) continue
      if (!byLabel.has(g)) byLabel.set(g, [])
      byLabel.get(g)!.push(e)
    }
    const order = new Map(HEBREW_GROUP_LETTERS.map((l, i) => [l, i]))
    return [...byLabel.keys()]
      .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b, "he"))
      .map((label) => ({ label, members: byLabel.get(label) || [] }))
  }, [isCampCourse, enrollments])

  const campUnassignedEnrollments = useMemo(() => {
    if (!isCampCourse) return []
    return enrollments.filter((e) => !String(e.campGroupLabel || "").trim())
  }, [isCampCourse, enrollments])

  const campGroupsInnerDefault = useMemo(() => {
    if (campGroupTabsData.length > 0) return campGroupTabsData[0].label
    return "__unassigned__"
  }, [campGroupTabsData])

  const allowedAttendanceDates = useMemo(() => {
    if (!course) return []
    const start = normalizeCourseCalendarYmd(course.startDate)
    const end = normalizeCourseCalendarYmd(course.endDate)
    const days = Array.isArray(course.daysOfWeek) && course.daysOfWeek.length > 0 ? course.daysOfWeek : []
    if (!start || !end || days.length === 0) return []
    return listCampSessionDates(start, end, days)
  }, [course?.startDate, course?.endDate, course?.daysOfWeek])

  const attendanceDateBounds = useMemo(() => {
    if (!course) return { min: "", max: "" }
    return {
      min: normalizeCourseCalendarYmd(course.startDate) || "",
      max: normalizeCourseCalendarYmd(course.endDate) || "",
    }
  }, [course?.startDate, course?.endDate])

  /** תאריך נוכחות אפקטיבי ל-API/UI כשיש רשימת מפגשים — מונע ערך שלא קיים ב-Select */
  const attendanceDateForApi = useMemo(() => {
    if (allowedAttendanceDates.length === 0) return attendanceDate
    return allowedAttendanceDates.includes(attendanceDate) ? attendanceDate : allowedAttendanceDates[0]
  }, [allowedAttendanceDates.join("|"), attendanceDate])

  const campMeetingForSelectedDate = useMemo(() => {
    if (!attendanceDateForApi) return null
    const toYmd = (v: unknown) => {
      const head = String(v ?? "").trim().slice(0, 10)
      return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ""
    }
    const hit = campScheduleMeetings.find((row) => toYmd((row as { sessionDate?: string }).sessionDate) === attendanceDateForApi)
    return hit ?? null
  }, [campScheduleMeetings, attendanceDateForApi])

  const teacherCampCells = useMemo(() => {
    if (!campMeetingForSelectedDate || !myTeacherId || !course) return [] as { cellId: string; label: string }[]
    const out: { cellId: string; label: string }[] = []
    const slots = Array.isArray((campMeetingForSelectedDate as { slots?: unknown[] }).slots)
      ? ((campMeetingForSelectedDate as { slots: unknown[] }).slots as Array<{
          isBreak?: boolean
          startTime?: string
          endTime?: string
          cells?: Array<{ id?: string; lessonTitle?: string; teacherIds?: string[] }>
        }>)
      : []
    for (const slot of slots) {
      if (slot.isBreak) continue
      const st = String(slot.startTime || "").slice(0, 5)
      const et = String(slot.endTime || "").slice(0, 5)
      for (const cell of Array.isArray(slot.cells) ? slot.cells : []) {
        const tids = Array.isArray(cell.teacherIds) ? cell.teacherIds.map((x) => String(x)) : []
        if (!tids.includes(myTeacherId)) continue
        const lesson = String(cell.lessonTitle || course.name || "שיעור").trim()
        out.push({ cellId: String(cell.id || ""), label: `${lesson} · ${st}–${et}` })
      }
    }
    return out.filter((c) => c.cellId)
  }, [campMeetingForSelectedDate, myTeacherId, course])

  const teacherCampAttendanceMode = Boolean(
    isCampCourse && !isAdmin && !!myTeacherId && teacherCampCells.length > 0,
  )

  const teacherCampDayNoSlots = Boolean(
    isCampCourse &&
      !isAdmin &&
      !!myTeacherId &&
      !!campMeetingForSelectedDate &&
      teacherCampCells.length === 0 &&
      canTabAttendanceStudents,
  )

  useEffect(() => {
    if (teacherCampCells.length === 0) {
      setSelectedCampCellId("")
      return
    }
    setSelectedCampCellId((prev) =>
      teacherCampCells.some((c) => c.cellId === prev) ? prev : teacherCampCells[0]!.cellId,
    )
  }, [teacherCampCells])

  useEffect(() => {
    if (isAdmin || !currentUser?.id) {
      setMyTeacherId(null)
      return
    }
    fetch(`/api/teachers/by-user/${currentUser.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMyTeacherId(d?.id ? String(d.id) : null))
      .catch(() => setMyTeacherId(null))
  }, [isAdmin, currentUser?.id])

  useEffect(() => {
    if (!canLoadCampScheduleApi || !id) {
      setCampScheduleMeetings([])
      return
    }
    fetch(`/api/courses/${id}/camp`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCampScheduleMeetings(Array.isArray(d?.meetings) ? d.meetings : []))
      .catch(() => setCampScheduleMeetings([]))
  }, [id, canLoadCampScheduleApi])

  /** מורה בקייטנה: לא ליפול לרשימת כל הרישומים כש־API נכשל או לפני סינון */
  const enrollmentsForAttendanceTab = useMemo(() => {
    if (isCampCourse && !isAdmin && canTabAttendanceStudents) {
      return campAttendanceEnrollments ?? []
    }
    return campAttendanceEnrollments ?? enrollments
  }, [isCampCourse, isAdmin, canTabAttendanceStudents, campAttendanceEnrollments, enrollments])

  /** נוכחים קודם, אחר כך שאר הסטטוסים; אחים מאותה siblingGroupId רצופים (לפי סדר אח) */
  const sortedEnrollmentsForAttendanceTab = useMemo(() => {
    const list = enrollmentsForAttendanceTab
    const isPresent = (e: Enrollment) => {
      const st = attendanceByStudent[e.studentId]
      return st === "present" || st === "PRESENT"
    }
    const sibRank = (e: Enrollment) =>
      e.siblingRank != null && Number(e.siblingRank) > 0 ? Number(e.siblingRank) : 9999
    const groupKey = (e: Enrollment) => {
      const g = String(e.siblingGroupId ?? "").trim()
      return g.length > 0 ? g : `__solo_${e.studentId}`
    }
    const sortBlock = (block: Enrollment[]) => {
      const byGroup = new Map<string, Enrollment[]>()
      for (const e of block) {
        const k = groupKey(e)
        if (!byGroup.has(k)) byGroup.set(k, [])
        byGroup.get(k)!.push(e)
      }
      for (const arr of byGroup.values()) {
        arr.sort(
          (a, b) =>
            sibRank(a) - sibRank(b) ||
            (a.studentName || "").localeCompare(b.studentName || "", "he", { sensitivity: "base" }),
        )
      }
      const keys = [...byGroup.keys()].sort((ka, kb) => {
        const a0 = byGroup.get(ka)![0]!
        const b0 = byGroup.get(kb)![0]!
        return (a0.studentName || "").localeCompare(b0.studentName || "", "he", { sensitivity: "base" })
      })
      return keys.flatMap((k) => byGroup.get(k)!)
    }
    const present = list.filter(isPresent)
    const rest = list.filter((e) => !isPresent(e))
    return [...sortBlock(present), ...sortBlock(rest)]
  }, [enrollmentsForAttendanceTab, attendanceByStudent])

  /** מורה רואה רק נוכחות מורה של עצמו; מנהלים — הכל */
  const courseTeacherAttendanceList = useMemo(() => {
    const rows = attendanceList.filter((a) => a.teacherId != null)
    if (isAdmin) return rows
    if (myTeacherId) return rows.filter((a) => String(a.teacherId) === String(myTeacherId))
    return []
  }, [attendanceList, isAdmin, myTeacherId])

  /** אינדקס צבע לפי מורה — סדר אחיד עם שורות הטבלה (לפי שם מורה בעברית) */
  const teacherAttendanceColorIndexById = useMemo(() => {
    const ids = [...new Set(courseTeacherAttendanceList.map((a) => String(a.teacherId || "")))].filter(Boolean)
    const decorated = ids.map((id) => ({
      id,
      name: teachers.find((t) => t.id === id)?.name ?? "\uFFFF",
    }))
    decorated.sort(
      (x, y) =>
        x.name.localeCompare(y.name, "he", { sensitivity: "base" }) || x.id.localeCompare(y.id),
    )
    const m = new Map<string, number>()
    decorated.forEach((d, i) => m.set(d.id, i))
    return m
  }, [courseTeacherAttendanceList, teachers])

  /** סיכום שעות הוראה מצטברות לפי מורה (רק רשומות «נוכח») — לתצוגה ליד הדפסה */
  const teacherAttendanceHoursSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of courseTeacherAttendanceList) {
      if (!a.teacherId) continue
      if (!isTeacherAttendancePresentStatus(a.status)) continue
      const add = attendanceHoursToNumber(
        a.hours,
        a.campSlotStart,
        a.campSlotEnd,
        course?.startTime,
        course?.endTime,
      )
      const id = String(a.teacherId)
      map.set(id, (map.get(id) || 0) + add)
    }
    return [...map.entries()]
      .map(([teacherId, hours]) => ({
        teacherId,
        name: teachers.find((t) => t.id === teacherId)?.name ?? "—",
        hours,
      }))
      .filter((x) => x.hours > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "he", { sensitivity: "base" }))
  }, [courseTeacherAttendanceList, teachers, course?.startTime, course?.endTime])

  const teacherAttendanceHoursGrandTotal = useMemo(
    () => teacherAttendanceHoursSummary.reduce((sum, row) => sum + row.hours, 0),
    [teacherAttendanceHoursSummary],
  )

  /** תאריך ישן→חדש, אז מורה, אז שעת התחלה, אז id */
  const sortedCourseTeacherAttendanceList = useMemo(() => {
    const nameOf = (tid: string | null) => (tid ? teachers.find((t) => t.id === tid)?.name ?? "" : "")
    return [...courseTeacherAttendanceList].sort((a, b) =>
      compareTeacherAttendanceRows(
        a as TeacherAttRow,
        b as TeacherAttRow,
        course?.startTime ?? null,
        nameOf,
      ),
    )
  }, [courseTeacherAttendanceList, teachers, course?.startTime])

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
    if (!id || !course) return
    if (!isCampCourse || isAdmin || !canTabAttendanceStudents || !attendanceDateForApi) {
      setCampAttendanceEnrollments(null)
      return
    }
    if (teacherCampDayNoSlots) {
      setCampAttendanceEnrollments([])
      return
    }
    if (teacherCampAttendanceMode && !selectedCampCellId) {
      setCampAttendanceEnrollments([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        let url = `/api/enrollments?courseId=${id}&forCampAttendanceDate=${encodeURIComponent(attendanceDateForApi)}`
        if (teacherCampAttendanceMode && selectedCampCellId) {
          url += `&forCampMeetingCellId=${encodeURIComponent(selectedCampCellId)}`
        }
        const res = await fetch(url)
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setCampAttendanceEnrollments(Array.isArray(data) ? data : [])
        } else if (!cancelled) {
          setCampAttendanceEnrollments([])
        }
      } catch {
        if (!cancelled) setCampAttendanceEnrollments([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    id,
    course?.id,
    isCampCourse,
    isAdmin,
    canTabAttendanceStudents,
    attendanceDateForApi,
    teacherCampAttendanceMode,
    teacherCampDayNoSlots,
    selectedCampCellId,
  ])

  useEffect(() => {
    if ((!canTabAttendanceStudents && !canTabAttendanceTeachers) || !id) return
    fetch(`/api/attendance?courseId=${id}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setAttendanceList(Array.isArray(data) ? data : []))
      .catch(() => setAttendanceList([]))
  }, [id, canTabAttendanceStudents, canTabAttendanceTeachers])

  useEffect(() => {
    if (!canTabAttendanceStudents || !id || !attendanceDateForApi) return
    if (teacherCampAttendanceMode && !selectedCampCellId) {
      setAttendanceByStudent({})
      return
    }
    let url = `/api/attendance?courseId=${id}&date=${attendanceDateForApi}`
    if (teacherCampAttendanceMode && selectedCampCellId) {
      url += `&campMeetingCellId=${encodeURIComponent(selectedCampCellId)}`
    }
    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        const next: Record<string, string> = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r: any) => {
          if (r?.studentId) next[String(r.studentId)] = String(r.status || "")
        })
        setAttendanceByStudent(next)
      })
      .catch(() => setAttendanceByStudent({}))
  }, [
    id,
    attendanceDateForApi,
    canTabAttendanceStudents,
    teacherCampAttendanceMode,
    selectedCampCellId,
  ])

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
    if (!canEditSessionsFeedbackTab || !newSessionDate || !id || savingSession) return
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
    if (!canEditSessionsFeedbackTab || !id || savingFeedbackBySession[sessionId]) return
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
    if (!canEditAttendanceStudentsTab) return
    const prev = attendanceByStudent[studentId]
    setAttendanceByStudent((p) => ({ ...p, [studentId]: status }))
    setSavingByStudent((p) => ({ ...p, [studentId]: true }))
    try {
      const body: Record<string, unknown> = {
        studentId,
        courseId: id,
        date: attendanceDateForApi,
        status,
      }
      if (teacherCampAttendanceMode && selectedCampCellId) {
        body.campMeetingCellId = selectedCampCellId
      }
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        const msg =
          errBody && typeof errBody === "object" && "error" in errBody
            ? String((errBody as { error?: string }).error || "")
            : ""
        throw new Error(msg || "Failed to save attendance")
      }
      const allRes = await fetch(`/api/attendance?courseId=${id}`)
      const allRows = allRes.ok ? await allRes.json() : []
      setAttendanceList(Array.isArray(allRows) ? allRows : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg) window.alert(msg)
      setAttendanceByStudent((p) => ({ ...p, [studentId]: prev }))
    } finally {
      setSavingByStudent((p) => ({ ...p, [studentId]: false }))
    }
  }

  async function deleteTeacherAttendanceRecord(recordId: string) {
    if (!canDeleteTeacherAttendanceRow) return
    if (!window.confirm(tr.deleteTeacherAttendanceConfirm)) return
    setDeletingTeacherAttendanceId(recordId)
    try {
      const res = await fetch(`/api/attendance?id=${encodeURIComponent(recordId)}`, { method: "DELETE" })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        const msg =
          errBody && typeof errBody === "object" && "error" in errBody
            ? String((errBody as { error?: string }).error || "")
            : ""
        throw new Error(msg || "Failed to delete")
      }
      const allRes = await fetch(`/api/attendance?courseId=${id}`)
      const allRows = allRes.ok ? await allRes.json() : []
      setAttendanceList(Array.isArray(allRows) ? allRows : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg) window.alert(msg)
    } finally {
      setDeletingTeacherAttendanceId(null)
    }
  }

  async function addCoursePayment() {
    if (!canEditPaymentsTab || !payStudentId || !payAmount || Number(payAmount) <= 0) return
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
        disabled={isSaving || !canEditAttendanceStudentsTab}
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
  const paymentTypeBadgeClass = (type: string) => {
    if (type === "cash") return "border-emerald-200 bg-emerald-50 text-emerald-700"
    if (type === "credit") return "border-sky-200 bg-sky-50 text-sky-700"
    if (type === "transfer") return "border-violet-200 bg-violet-50 text-violet-700"
    if (type === "check") return "border-amber-200 bg-amber-50 text-amber-700"
    if (type === "bit") return "border-pink-200 bg-pink-50 text-pink-700"
    return "border-slate-200 bg-slate-50 text-slate-700"
  }
  const paymentMethodOrder: Array<"cash" | "credit" | "transfer" | "check" | "bit"> = ["cash", "credit", "transfer", "check", "bit"]
  const paymentTotalsByMethod = paymentMethodOrder.map((method) => ({
    method,
    label: paymentTypeLabel(method),
    total: paymentsForCourse
      .filter((p) => (p.paymentType || "").toLowerCase() === method)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  }))
  const paymentGrandTotal = paymentsForCourse.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const paidByStudent = new Map<string, number>()
  for (const p of paymentsForCourse) {
    if (!p.studentId) continue
    paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) || 0) + Number(p.amount || 0))
  }
  const debtRows = enrollments
    .map((e) => {
      const totalDue = Number((e as any).coursePrice ?? course?.price ?? 0)
      const paid = paidByStudent.get(e.studentId) || 0
      const balance = Math.max(0, totalDue - paid)
      return {
        enrollmentId: e.id,
        studentId: e.studentId,
        studentName: e.studentName || "—",
        totalDue,
        paid,
        balance,
      }
    })
    .filter((r) => r.balance > 0.009)
  const debtRowsTotalDue = debtRows.reduce((sum, r) => sum + r.totalDue, 0)
  const debtRowsTotalPaid = debtRows.reduce((sum, r) => sum + r.paid, 0)
  const totalDebtAmount = debtRows.reduce((sum, r) => sum + r.balance, 0)

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
    !isStudentUser && canTabCampGroups,
    canTabCamp,
    !isStudentUser && canTabPayments,
    !isStudentUser && canTabDebtors,
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

        {!isStudentUser && canEditCourseFromGeneralTab && (
          <Link href={`/dashboard/courses/${course.id}/edit`} className="w-full shrink-0 sm:w-auto">
            <Button className="w-full gap-2 sm:w-auto">
              <Pencil className="h-4 w-4" />
              {tr.editCourse}
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs - לפי הרשאות טאב בכרטסת קורס */}
      <Tabs defaultValue={canTabGeneral ? "general" : canTabSessionsFeedback ? "sessions-feedback" : !isStudentUser && canTabStudents ? "students" : !isStudentUser && canTabCampGroups ? "camp-groups" : canTabCamp ? "camp" : !isStudentUser && canTabPayments ? "payments" : !isStudentUser && canTabDebtors ? "debtors" : canTabAttendanceStudents ? "attendance-students" : "attendance-teachers"} className="w-full" dir={isRtl ? "rtl" : "ltr"}>
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
            {!isStudentUser && canTabCampGroups && (
              <TabsTrigger value="camp-groups" className="shrink-0 gap-1 px-2 text-xs sm:text-sm md:min-w-0">
                <Layers className="h-3.5 w-3.5 opacity-70" />
                {tr.campGroupsTab}
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
            {!isStudentUser && canTabDebtors && (
              <TabsTrigger value="debtors" className="shrink-0 px-2 text-xs sm:text-sm md:min-w-0">
                {tr.debtors}
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
                {canSeeCourseFinancial && (
                  <div className="mt-3 flex flex-col gap-1 text-right sm:flex-row sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-0">
                    <span className="break-words text-sm text-muted-foreground sm:text-base">עלות משוערת אחרי הנחות אחים:</span>
                    <span className="shrink-0 font-bold text-xl text-emerald-600">₪{expectedTotalByEnrollments.toLocaleString()}</span>
                  </div>
                )}
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
            {!isStudentUser && canEditSessionsFeedbackTab && (
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
                              readOnly={!canEditSessionsFeedbackTab}
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
                        {canEditSessionsFeedbackTab ? (
                          <Button onClick={() => handleSaveSessionFeedback(s.id)} disabled={savingFeedbackBySession[s.id]}>
                            {savingFeedbackBySession[s.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : tr.saveFeedback}
                          </Button>
                        ) : null}
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
                              {canEditEnrollmentCampGroup && !isStudentUser ? (
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

        {!isStudentUser && canTabCampGroups && (
          <TabsContent value="camp-groups" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{tr.campGroupsTabTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {campGroupTabsData.length === 0 && campUnassignedEnrollments.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">{tr.noCampGroupAssignments}</p>
                ) : (
                  <Tabs
                    key={campGroupsInnerDefault}
                    defaultValue={campGroupsInnerDefault}
                    className="w-full"
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    <div className="-mx-1 overflow-x-auto px-1 pb-2 sm:mx-0 sm:px-0">
                      <TabsList className="inline-flex h-auto min-h-9 w-max max-w-full flex-wrap justify-start gap-1 p-1">
                        {campGroupTabsData.map(({ label, members }) => (
                          <TabsTrigger
                            key={label}
                            value={label}
                            className="gap-1.5 px-3 py-2 data-[state=active]:shadow-sm"
                          >
                            <span className="font-medium">
                              {locale === "en" ? `Group ${label}` : locale === "ar" ? `مجموعة ${label}` : `קבוצה ${label}`}
                            </span>
                            <Badge variant="secondary" className="tabular-nums">
                              {members.length}
                            </Badge>
                          </TabsTrigger>
                        ))}
                        {campUnassignedEnrollments.length > 0 && (
                          <TabsTrigger
                            value="__unassigned__"
                            className="gap-1.5 px-3 py-2 data-[state=active]:shadow-sm"
                          >
                            <span className="font-medium">{tr.unassignedCampGroup}</span>
                            <Badge variant="secondary" className="tabular-nums">
                              {campUnassignedEnrollments.length}
                            </Badge>
                          </TabsTrigger>
                        )}
                      </TabsList>
                    </div>

                    {campGroupTabsData.map(({ label, members }) => (
                      <TabsContent key={label} value={label} className="mt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {tr.studentsInGroup}:{" "}
                          <span className="font-semibold text-foreground">{members.length}</span>
                        </p>
                        {members.length === 0 ? (
                          <p className="text-center text-muted-foreground py-6">—</p>
                        ) : (
                          <div className="overflow-x-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="text-right">{tr.student}</TableHead>
                                  <TableHead className="text-right">{tr.status}</TableHead>
                                  <TableHead className="text-right">{tr.enrollmentDate}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {members.map((enrollment) => (
                                  <TableRow key={enrollment.id}>
                                    <TableCell className="text-right font-medium">
                                      <Link
                                        href={`/dashboard/students/${enrollment.studentId}`}
                                        className="text-primary hover:underline"
                                      >
                                        {enrollment.studentName ||
                                          (locale === "en" ? "Unknown" : locale === "ar" ? "—" : "לא ידוע")}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge
                                        className={
                                          enrollment.status === "active"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-800"
                                        }
                                      >
                                        {enrollment.status === "active"
                                          ? locale === "en"
                                            ? "Active"
                                            : locale === "ar"
                                              ? "نشط"
                                              : "פעיל"
                                          : enrollment.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {enrollment.enrollmentDate
                                        ? new Date(enrollment.enrollmentDate).toLocaleDateString(localeTag)
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </TabsContent>
                    ))}

                    {campUnassignedEnrollments.length > 0 && (
                      <TabsContent value="__unassigned__" className="mt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {tr.studentsInGroup}:{" "}
                          <span className="font-semibold text-foreground">
                            {campUnassignedEnrollments.length}
                          </span>
                        </p>
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-right">{tr.student}</TableHead>
                                <TableHead className="text-right">{tr.status}</TableHead>
                                <TableHead className="text-right">{tr.enrollmentDate}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {campUnassignedEnrollments.map((enrollment) => (
                                <TableRow key={enrollment.id}>
                                  <TableCell className="text-right font-medium">
                                    <Link
                                      href={`/dashboard/students/${enrollment.studentId}`}
                                      className="text-primary hover:underline"
                                    >
                                      {enrollment.studentName ||
                                        (locale === "en" ? "Unknown" : locale === "ar" ? "—" : "לא ידוע")}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge
                                      className={
                                        enrollment.status === "active"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-gray-100 text-gray-800"
                                      }
                                    >
                                      {enrollment.status === "active"
                                        ? locale === "en"
                                          ? "Active"
                                          : locale === "ar"
                                            ? "نشط"
                                            : "פעיל"
                                        : enrollment.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {enrollment.enrollmentDate
                                      ? new Date(enrollment.enrollmentDate).toLocaleDateString(localeTag)
                                      : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canTabCamp && (
          <TabsContent value="camp" className="space-y-4">
            <CourseCampTab courseId={id} canEdit={!isStudentUser && !!canEditCampPlanTab} />
          </TabsContent>
        )}

        {!isStudentUser && canTabPayments && (
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {paymentTotalsByMethod.map((item) => (
                    <Badge
                      key={item.method}
                      variant="outline"
                      className={`text-xs sm:text-sm border font-semibold ${paymentTypeBadgeClass(item.method)}`}
                    >
                      {item.label}: ₪{item.total.toLocaleString()}
                    </Badge>
                  ))}
                  <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 text-xs sm:text-sm font-semibold shadow-sm">
                    סה&quot;כ כללי: ₪{paymentGrandTotal.toLocaleString()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!canEditPaymentsTab}
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

        {!isStudentUser && canTabDebtors && (
        <TabsContent value="debtors">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-rose-100 p-2">
                    <BarChart3 className="h-5 w-5 text-rose-600" />
                  </div>
                  <CardTitle className="text-lg font-bold tracking-tight text-rose-700">
                    {tr.debtors}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 text-xs sm:text-sm font-semibold shadow-sm">
                    סה&quot;כ לתשלום: ₪{debtRowsTotalDue.toLocaleString()}
                  </Badge>
                  <Badge className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 text-xs sm:text-sm font-semibold shadow-sm">
                    שולם: ₪{debtRowsTotalPaid.toLocaleString()}
                  </Badge>
                  <Badge className="bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-700 hover:to-red-700 text-xs sm:text-sm font-semibold shadow-sm">
                    סה&quot;כ חוב: ₪{totalDebtAmount.toLocaleString()}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => {
                      const w = window.open("", "_blank")
                      if (!w) return
                      const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                      w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>דוח חייבים - ${course?.name || ""}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:980px;margin:0 auto}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}.header h1{font-size:22px;color:#1e40af;margin-top:6px}.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}.totals{display:flex;justify-content:center;margin:12px 0 16px}.total-box{border:1px solid #fecaca;background:#fff1f2;border-radius:10px;padding:10px 14px;text-align:center}.total-label{font-size:12px;color:#9f1239}.total-val{font-size:22px;font-weight:700;color:#be123c;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}td{border:1px solid #d1d5db;padding:8px 10px;text-align:center;vertical-align:middle}tr:nth-child(even) td{background:#f9fafb}.paid{color:#166534;font-weight:600}.debt{color:#b91c1c;font-weight:700}@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}}</style></head><body>`)
                      w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${course.name}</h2>` : ""}<h2>דוח חייבים</h2></div>`)
                      w.document.write(`<div class="totals"><div class="total-box"><div class="total-label">סה"כ חוב בקורס</div><div class="total-val">₪${totalDebtAmount.toLocaleString()}</div></div></div>`)
                      w.document.write(`<table><thead><tr><th>#</th><th>שם תלמיד</th><th>סה"כ לתשלום</th><th>שולם</th><th>יתרה</th></tr></thead><tbody>`)
                      debtRows.forEach((r, idx) => {
                        w.document.write(`<tr><td>${idx + 1}</td><td>${r.studentName}</td><td>₪${r.totalDue.toLocaleString()}</td><td class="paid">₪${r.paid.toLocaleString()}</td><td class="debt">₪${r.balance.toLocaleString()}</td></tr>`)
                      })
                      w.document.write(`</tbody></table></body></html>`)
                      w.document.close()
                      setTimeout(() => w.print(), 300)
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    הדפסה
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      const w = window.open("", "_blank")
                      if (!w) return
                      const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                      const datesForReport = [...allowedAttendanceDates].sort((a, b) => a.localeCompare(b))
                      const studentsForReport = [...sortedEnrollmentsForAttendanceTab]
                      const pickStatusForStudentDate = (studentId: string, date: string): string => {
                        const rows = attendanceList.filter((r) => String(r.studentId || "") === String(studentId) && toYmd(r.date) === date)
                        if (rows.length === 0) return ""
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "present")) return "present"
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "sick")) return "sick"
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "vacation")) return "vacation"
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "absent")) return "absent"
                        return ""
                      }
                      const statusLabel = (status: string): string => {
                        if (status === "present") return "נוכח"
                        if (status === "absent") return "לא נכח"
                        if (status === "sick") return "חולה"
                        if (status === "vacation") return "חופש"
                        return "—"
                      }
                      const presentByDate = new Map<string, number>()
                      const notPresentByDate = new Map<string, number>()
                      datesForReport.forEach((d) => {
                        let present = 0
                        let notPresent = 0
                        studentsForReport.forEach((e) => {
                          const st = pickStatusForStudentDate(e.studentId, d)
                          if (st === "present") present += 1
                          else notPresent += 1
                        })
                        presentByDate.set(d, present)
                        notPresentByDate.set(d, notPresent)
                      })
                      w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>דוח נוכחות מלא - ${course?.name || ""}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#1f2937}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #4f46e5}.header h1{font-size:22px;color:#3730a3}.header h2{font-size:14px;color:#4b5563;font-weight:500}.note{font-size:12px;color:#64748b;text-align:center;margin-bottom:10px}.table-wrap{overflow:auto;border:1px solid #cbd5e1;border-radius:10px}table{border-collapse:collapse;min-width:1200px;width:max-content;background:#fff}th{background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;padding:8px 10px;text-align:center;font-size:12px;white-space:nowrap}td{border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-size:12px;white-space:nowrap}tr:nth-child(even) td{background:#f8fafc}.name-col{position:sticky;right:0;background:#fff;font-weight:600;text-align:right;min-width:170px}.idx-col{position:sticky;right:170px;background:#fff;min-width:52px}.total-col{font-weight:700;background:#ecfeff}.present{color:#166534;font-weight:700}.not-present{color:#991b1b;font-weight:700}.summary-row td{background:#f1f5f9 !important;font-weight:700}@media print{@page{size:landscape;margin:12mm}body{padding:0}.table-wrap{border:none}}</style></head><body>`)
                      w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2>${course.name}</h2>` : ""}<h2>דוח נוכחות מלא לתלמידים</h2></div>`)
                      if (datesForReport.length > 0) {
                        const firstDate = new Date(datesForReport[0]).toLocaleDateString("he-IL")
                        const lastDate = new Date(datesForReport[datesForReport.length - 1]).toLocaleDateString("he-IL")
                        w.document.write(`<div class="note">טווח תאריכים: ${firstDate} - ${lastDate}</div>`)
                      }
                      w.document.write(`<div class="table-wrap"><table><thead><tr><th class="idx-col">מס'</th><th class="name-col">שם תלמיד</th>`)
                      datesForReport.forEach((d) => w.document.write(`<th>${new Date(d).toLocaleDateString("he-IL")}</th>`))
                      w.document.write(`<th class="total-col">סה"כ נוכחות</th></tr></thead><tbody>`)
                      studentsForReport.forEach((e, idx) => {
                        let presentCount = 0
                        w.document.write(`<tr><td class="idx-col">${idx + 1}</td><td class="name-col">${(e.studentName || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
                        datesForReport.forEach((d) => {
                          const st = pickStatusForStudentDate(e.studentId, d)
                          if (st === "present") presentCount += 1
                          const cls = st === "present" ? "present" : st ? "not-present" : ""
                          w.document.write(`<td class="${cls}">${statusLabel(st)}</td>`)
                        })
                        w.document.write(`<td class="total-col present">${presentCount}</td></tr>`)
                      })
                      w.document.write(`<tr class="summary-row"><td class="idx-col" colspan="2">סה"כ נוכחים</td>`)
                      datesForReport.forEach((d) => w.document.write(`<td class="present">${presentByDate.get(d) || 0}</td>`))
                      w.document.write(`<td class="total-col present">${datesForReport.reduce((sum, d) => sum + (presentByDate.get(d) || 0), 0)}</td></tr>`)
                      w.document.write(`<tr class="summary-row"><td class="idx-col" colspan="2">סה"כ לא נכחו</td>`)
                      datesForReport.forEach((d) => w.document.write(`<td class="not-present">${notPresentByDate.get(d) || 0}</td>`))
                      w.document.write(`<td class="total-col not-present">${datesForReport.reduce((sum, d) => sum + (notPresentByDate.get(d) || 0), 0)}</td></tr>`)
                      w.document.write(`</tbody></table></div></body></html>`)
                      w.document.close()
                      setTimeout(() => w.print(), 400)
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    הדפסת כל הנוכחות
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                מוצגים רק תלמידים עם יתרה לתשלום. תלמיד שסיים לשלם לא יופיע ברשימה.
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">{tr.student}</TableHead>
                      <TableHead className="text-right">סה&quot;כ לתשלום</TableHead>
                      <TableHead className="text-right">שולם</TableHead>
                      <TableHead className="text-right">יתרה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debtRows.length > 0 ? debtRows.map((r) => (
                      <TableRow key={r.enrollmentId}>
                        <TableCell className="text-right">{r.studentName}</TableCell>
                        <TableCell className="text-right">₪{r.totalDue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-emerald-700 font-medium">₪{r.paid.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">₪{r.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground" colSpan={4}>
                          אין תלמידים עם חוב בקורס זה
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
                <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">{tr.date}:</span>
                  {allowedAttendanceDates.length > 0 ? (
                    <Select value={attendanceDateForApi} onValueChange={setAttendanceDate}>
                      <SelectTrigger className="h-9 w-full min-w-[200px] max-w-[min(100vw-2rem,320px)]" dir={isRtl ? "rtl" : "ltr"}>
                        <SelectValue placeholder={tr.date} />
                      </SelectTrigger>
                      <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                        {allowedAttendanceDates.map((d) => (
                          <SelectItem key={d} value={d}>
                            {formatCourseSessionDateOption(d, locale === "ar" ? "ar" : locale === "en" ? "en" : "he")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      min={attendanceDateBounds.min || undefined}
                      max={attendanceDateBounds.max || undefined}
                      className="flex h-9 w-full min-w-0 max-w-[min(100vw-2rem,200px)] rounded-md border border-input bg-background px-3 py-1 text-sm"
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => {
                      const w = window.open("", "_blank")
                      if (!w) return
                      const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                      const dateStr = new Date(attendanceDateForApi).toLocaleDateString(localeTag)
                      const slotLine =
                        teacherCampAttendanceMode && selectedCampCellId
                          ? teacherCampCells.find((c) => c.cellId === selectedCampCellId)?.label || ""
                          : ""
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
                      const slotEsc = slotLine
                        ? slotLine.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                        : ""
                      w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${course.name}</h2>` : ""}<h2>רשימת נוכחות - ${dateStr}</h2>${slotEsc ? `<p style="margin-top:8px;font-size:14px;color:#374151">${slotEsc}</p>` : ""}</div>`)
                      w.document.write(`<table><thead><tr><th>#</th><th>שם תלמיד</th><th>קבוצה</th><th>סטטוס</th><th>חתימה</th></tr></thead><tbody>`)
                      sortedEnrollmentsForAttendanceTab.forEach((e, idx) => {
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
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      const w = window.open("", "_blank")
                      if (!w) return
                      const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                      const datesForReport = [...allowedAttendanceDates].sort((a, b) => a.localeCompare(b))
                      const studentsForReport = [...sortedEnrollmentsForAttendanceTab]
                      const statusAt = (studentId: string, date: string): string => {
                        const rows = attendanceList.filter((r) => String(r.studentId || "") === studentId && toYmd(r.date) === date)
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "present")) return "present"
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "sick")) return "sick"
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "vacation")) return "vacation"
                        if (rows.some((r) => String(r.status || "").toLowerCase() === "absent")) return "absent"
                        return ""
                      }
                      const lbl = (s: string) => (s === "present" ? "נוכח" : s === "absent" ? "לא נכח" : s === "sick" ? "חולה" : s === "vacation" ? "חופש" : "—")
                      const presentByDate = new Map<string, number>()
                      const notPresentByDate = new Map<string, number>()
                      datesForReport.forEach((d) => {
                        let p = 0
                        let n = 0
                        studentsForReport.forEach((e) => {
                          const st = statusAt(String(e.studentId), d)
                          if (st === "present") p += 1
                          else n += 1
                        })
                        presentByDate.set(d, p)
                        notPresentByDate.set(d, n)
                      })
                      w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>דוח נוכחות מלא - ${course?.name || ""}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#1f2937}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #4f46e5}.header h1{font-size:22px;color:#3730a3}.header h2{font-size:14px;color:#4b5563;font-weight:500}.note{font-size:12px;color:#64748b;text-align:center;margin-bottom:10px}.table-wrap{overflow:auto;border:1px solid #cbd5e1;border-radius:10px}table{border-collapse:collapse;min-width:1200px;width:max-content;background:#fff}th{background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;padding:8px 10px;text-align:center;font-size:12px;white-space:nowrap}td{border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-size:12px;white-space:nowrap}tr:nth-child(even) td{background:#f8fafc}.name-col{position:sticky;right:0;background:#fff;font-weight:600;text-align:right;min-width:170px}.idx-col{position:sticky;right:170px;background:#fff;min-width:52px}.total-col{font-weight:700;background:#ecfeff}.present{color:#166534;font-weight:700}.not-present{color:#991b1b;font-weight:700}.summary-row td{background:#f1f5f9 !important;font-weight:700}@media print{@page{size:landscape;margin:12mm}body{padding:0}.table-wrap{border:none}}</style></head><body>`)
                      w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2>${course.name}</h2>` : ""}<h2>דוח נוכחות מלא לתלמידים</h2></div>`)
                      if (datesForReport.length > 0) w.document.write(`<div class="note">טווח תאריכים: ${new Date(datesForReport[0]).toLocaleDateString("he-IL")} - ${new Date(datesForReport[datesForReport.length - 1]).toLocaleDateString("he-IL")}</div>`)
                      w.document.write(`<div class="table-wrap"><table><thead><tr><th class="idx-col">מס'</th><th class="name-col">שם תלמיד</th>`)
                      datesForReport.forEach((d) => w.document.write(`<th>${new Date(d).toLocaleDateString("he-IL")}</th>`))
                      w.document.write(`<th class="total-col">סה"כ נוכחות</th></tr></thead><tbody>`)
                      studentsForReport.forEach((e, i) => {
                        let presentCount = 0
                        w.document.write(`<tr><td class="idx-col">${i + 1}</td><td class="name-col">${(e.studentName || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
                        datesForReport.forEach((d) => {
                          const st = statusAt(String(e.studentId), d)
                          if (st === "present") presentCount += 1
                          w.document.write(`<td class="${st === "present" ? "present" : st ? "not-present" : ""}">${lbl(st)}</td>`)
                        })
                        w.document.write(`<td class="total-col present">${presentCount}</td></tr>`)
                      })
                      w.document.write(`<tr class="summary-row"><td class="idx-col" colspan="2">סה"כ נוכחים</td>`)
                      datesForReport.forEach((d) => w.document.write(`<td class="present">${presentByDate.get(d) || 0}</td>`))
                      w.document.write(`<td class="total-col present">${datesForReport.reduce((s, d) => s + (presentByDate.get(d) || 0), 0)}</td></tr>`)
                      w.document.write(`<tr class="summary-row"><td class="idx-col" colspan="2">סה"כ לא נכחו</td>`)
                      datesForReport.forEach((d) => w.document.write(`<td class="not-present">${notPresentByDate.get(d) || 0}</td>`))
                      w.document.write(`<td class="total-col not-present">${datesForReport.reduce((s, d) => s + (notPresentByDate.get(d) || 0), 0)}</td></tr>`)
                      w.document.write(`</tbody></table></div></body></html>`)
                      w.document.close()
                      setTimeout(() => w.print(), 400)
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    הדפסת כל הנוכחות
                  </Button>
                </div>
              </div>
              {teacherCampAttendanceMode && teacherCampCells.length > 0 ? (
                <div className="mt-3 flex w-full flex-wrap gap-2 border-t border-border/60 pt-3">
                  {teacherCampCells.map((c) => (
                    <Button
                      key={c.cellId}
                      type="button"
                      size="sm"
                      variant={selectedCampCellId === c.cellId ? "default" : "outline"}
                      className={
                        selectedCampCellId === c.cellId
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "border-purple-200"
                      }
                      onClick={() => setSelectedCampCellId(c.cellId)}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {teacherCampDayNoSlots ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {tr.campNoTeacherSlots}
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              {(() => {
                const total = enrollmentsForAttendanceTab.length
                const present = enrollmentsForAttendanceTab.filter((e) => {
                  const st = attendanceByStudent[e.studentId]
                  return st === "present" || st === "PRESENT"
                }).length
                const absent = enrollmentsForAttendanceTab.filter((e) => {
                  const st = attendanceByStudent[e.studentId]
                  return st === "absent" || st === "ABSENT"
                }).length
                const sick = enrollmentsForAttendanceTab.filter((e) => {
                  const st = attendanceByStudent[e.studentId]
                  return st === "sick" || st === "SICK"
                }).length
                const vacation = enrollmentsForAttendanceTab.filter((e) => {
                  const st = attendanceByStudent[e.studentId]
                  return st === "vacation" || st === "VACATION"
                }).length
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
                    {sortedEnrollmentsForAttendanceTab.length > 0 ? sortedEnrollmentsForAttendanceTab.map((enrollment) => (
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
                          {teacherCampDayNoSlots ? tr.campNoTeacherSlots : tr.noLinkedStudents}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                const scopeIds = new Set(enrollmentsForAttendanceTab.map((e) => e.studentId))
                const studentAttendance =
                  isCampCourse && !isAdmin
                    ? attendanceList.filter((a) => {
                        if (a.studentId == null || !scopeIds.has(String(a.studentId))) return false
                        if (teacherCampAttendanceMode && selectedCampCellId) {
                          return String(a.campMeetingCellId || "") === selectedCampCellId
                        }
                        return true
                      })
                    : attendanceList.filter((a) => a.studentId != null)
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
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CalendarCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-lg">{tr.teacherAttendanceTitle}</CardTitle>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                  {teacherAttendanceHoursSummary.length > 0 ? (
                    <div
                      className={
                        isCampCourse
                          ? "flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-purple-200/90 bg-gradient-to-l from-fuchsia-50/90 via-purple-50/80 to-violet-50/50 px-3 py-2 shadow-sm ring-1 ring-purple-100/60"
                          : "flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
                      }
                      dir={isRtl ? "rtl" : "ltr"}
                    >
                      <div
                        className={`flex min-w-[6.5rem] flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 sm:flex-row sm:items-baseline sm:gap-2 ${
                          isCampCourse
                            ? "border-purple-200/80 bg-white/80 text-purple-950 shadow-sm"
                            : "border-border bg-background/90 text-foreground shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Clock
                            className={`h-4 w-4 shrink-0 ${isCampCourse ? "text-purple-600" : "text-muted-foreground"}`}
                          />
                          <span
                            className={`text-[11px] font-semibold leading-tight sm:text-xs ${isCampCourse ? "text-purple-900" : "text-muted-foreground"}`}
                          >
                            {tr.teacherHoursGrandTotal}
                          </span>
                        </div>
                        <span className="text-base font-bold tabular-nums leading-tight sm:ms-auto">
                          {teacherAttendanceHoursGrandTotal.toFixed(1)}
                          <span className="ms-0.5 text-xs font-semibold opacity-80">{tr.hoursShort}</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-stretch gap-2">
                        {teacherAttendanceHoursSummary.map((row) => {
                          const chipIdx = teacherAttendanceColorIndexById.get(row.teacherId) ?? 0
                          return (
                          <div
                            key={row.teacherId}
                            className={`flex min-w-[7.5rem] flex-col rounded-lg border px-2.5 py-1.5 ${
                              isCampCourse
                                ? TEACHER_HOURS_CHIP_STYLES[chipIdx % TEACHER_HOURS_CHIP_STYLES.length]
                                : "border-border bg-background/90 text-foreground shadow-sm"
                            }`}
                          >
                            <span className="line-clamp-2 text-[11px] font-medium leading-snug opacity-90">{row.name}</span>
                            <span className="text-base font-bold tabular-nums leading-tight">
                              {row.hours.toFixed(1)}
                              <span className="ms-0.5 text-xs font-semibold opacity-80">{tr.hoursShort}</span>
                            </span>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => {
                    const teacherAtt = sortedCourseTeacherAttendanceList
                    const w = window.open("", "_blank")
                    if (!w) return
                    const logoHtml = centerLogo ? `<img src="${centerLogo}" style="max-height:60px;max-width:160px;object-fit:contain" />` : ""
                    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>נוכחות מורים - ${course?.name || ""}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:32px 40px;color:#1f2937;max-width:900px;margin:0 auto}.header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #3b82f6}.header h1{font-size:22px;color:#1e40af;margin-top:6px}.header h2{font-size:15px;color:#4b5563;font-weight:400;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}th{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:8px 10px;text-align:center;font-weight:600}td{border:1px solid #d1d5db;padding:8px 10px;text-align:center;vertical-align:middle}tr:nth-child(even) td{background:#f9fafb}.status-present{color:#166534;font-weight:600}.status-absent{color:#991b1b;font-weight:600}@media print{body{padding:20px 28px;max-width:100%}@page{margin:20mm 15mm}}</style></head><body>`)
                    w.document.write(`<div class="header">${logoHtml}<h1>${centerName || "מרכז"}</h1>${course?.name ? `<h2 style="font-size:17px;color:#1f2937;font-weight:600;margin-top:4px">${course.name}</h2>` : ""}<h2>נוכחות מורים</h2></div>`)
                    w.document.write(`<table><thead><tr><th>#</th><th>תאריך</th><th>מורה</th><th>שיעור</th><th>משעה</th><th>עד שעה</th><th>סה"כ שעות</th><th>סטטוס</th><th>הערה</th></tr></thead><tbody>`)
                    teacherAtt.forEach((a, idx) => {
                      const teacher = teachers.find((t) => t.id === a.teacherId)
                      const statusLabel = isTeacherAttendancePresentStatus(a.status)
                        ? "נוכח"
                        : a.status === "absent" || a.status === "ABSENT"
                          ? "חיסור"
                          : String(a.status ?? "—")
                      const cls = isTeacherAttendancePresentStatus(a.status) ? "status-present" : "status-absent"
                      const rs = attendanceSlotTimeDisplay(a.campSlotStart)
                      const re = attendanceSlotTimeDisplay(a.campSlotEnd)
                      const useCrs = rs === "—" || re === "—"
                      const startDisp = useCrs ? courseTimeToDisplayValue(course?.startTime) || "—" : rs
                      const endDisp = useCrs ? courseTimeToDisplayValue(course?.endTime) || "—" : re
                      const totalH = attendanceHoursFromSlots(a.hours, a.campSlotStart, a.campSlotEnd, course?.startTime, course?.endTime)
                      const lessonEsc = String(a.campLessonTitle || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                      w.document.write(`<tr><td>${idx + 1}</td><td>${new Date(a.date).toLocaleDateString("he-IL")}</td><td>${teacher?.name || "—"}</td><td>${lessonEsc}</td><td>${startDisp}</td><td>${endDisp}</td><td>${totalH}</td><td class="${cls}">${statusLabel}</td><td>${(a.notes || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td></tr>`)
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
                const teacherAttendance = sortedCourseTeacherAttendanceList
                return teacherAttendance.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[880px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right">{tr.date}</TableHead>
                          <TableHead className="text-right">{tr.teachers}</TableHead>
                          <TableHead className="text-right">{tr.campLessonCol}</TableHead>
                          <TableHead className="text-center">משעה</TableHead>
                          <TableHead className="text-center">עד שעה</TableHead>
                          <TableHead className="text-center">סה&quot;כ שעות</TableHead>
                          <TableHead className="text-right">{tr.status}</TableHead>
                          <TableHead className="text-right">{tr.note}</TableHead>
                          <TableHead className="text-right">{tr.performedBy}</TableHead>
                          {canDeleteTeacherAttendanceRow ? (
                            <TableHead className="w-12 text-center">{tr.actions}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          return teacherAttendance.map((a, idx) => {
                            const teacher = teachers.find((t) => t.id === a.teacherId)
                            const teacherName = teacher?.name ?? "—"
                            const statusLabel = isTeacherAttendancePresentStatus(a.status)
                              ? tr.present
                              : a.status === "absent" || a.status === "ABSENT"
                                ? tr.absent
                                : String(a.status ?? "—")
                            const busy = deletingTeacherAttendanceId === a.id
                            const rs = attendanceSlotTimeDisplay(a.campSlotStart)
                            const re = attendanceSlotTimeDisplay(a.campSlotEnd)
                            const useCrs = rs === "—" || re === "—"
                            const startDisp = useCrs ? courseTimeToDisplayValue(course?.startTime) || "—" : rs
                            const endDisp = useCrs ? courseTimeToDisplayValue(course?.endTime) || "—" : re
                            const hoursDisp = attendanceHoursFromSlots(
                              a.hours,
                              a.campSlotStart,
                              a.campSlotEnd,
                              course?.startTime,
                              course?.endTime,
                            )
                            const lessonDisp = String(a.campLessonTitle || "").trim() || "—"
                            const tid = a.teacherId ? String(a.teacherId) : ""
                            const colorIdx = tid ? teacherAttendanceColorIndexById.get(tid) ?? 0 : 0
                            const rowAccent =
                              TEACHER_ROW_ACCENT_STYLES[colorIdx % TEACHER_ROW_ACCENT_STYLES.length]
                            const aTeacherId = String(a.teacherId || "")
                            const aDateKey = String(a.date || "")
                            const next = teacherAttendance[idx + 1]
                            const nextTeacherId = next ? String(next.teacherId || "") : ""
                            const nextDateKey = next ? String(next.date || "") : ""
                            const isEndOfTeacherDayGroup = !next || nextTeacherId !== aTeacherId || nextDateKey !== aDateKey
                            const dayTeacherTotalHours = isEndOfTeacherDayGroup
                              ? teacherAttendance
                                  .filter(
                                    (row) =>
                                      String(row.teacherId || "") === aTeacherId &&
                                      String(row.date || "") === aDateKey &&
                                      isTeacherAttendancePresentStatus(row.status),
                                  )
                                  .reduce(
                                    (sum, row) =>
                                      sum +
                                      attendanceHoursToNumber(
                                        row.hours,
                                        row.campSlotStart,
                                        row.campSlotEnd,
                                        course?.startTime,
                                        course?.endTime,
                                      ),
                                    0,
                                  )
                              : 0
                            return (
                              <Fragment key={a.id}>
                                <TableRow className={rowAccent}>
                                  <TableCell className="text-right">{new Date(a.date).toLocaleDateString(localeTag)}</TableCell>
                                  <TableCell className="text-right">{teacherName}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{lessonDisp}</TableCell>
                                  <TableCell className="text-center">{startDisp}</TableCell>
                                  <TableCell className="text-center">{endDisp}</TableCell>
                                  <TableCell className="text-center font-medium">{hoursDisp}</TableCell>
                                  <TableCell className="text-right">{statusLabel}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{a.notes ?? "—"}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{a.createdByUserName || "—"}</TableCell>
                                  {canDeleteTeacherAttendanceRow ? (
                                    <TableCell className="text-center p-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        disabled={busy}
                                        aria-label={locale === "en" ? "Delete attendance" : locale === "ar" ? "حذف" : "מחיקת נוכחות"}
                                        onClick={() => deleteTeacherAttendanceRecord(a.id)}
                                      >
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                      </Button>
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                                {isEndOfTeacherDayGroup ? (
                                  <TableRow className="bg-amber-50/70">
                                    <TableCell
                                      className="text-right font-semibold text-amber-900"
                                      colSpan={canDeleteTeacherAttendanceRow ? 10 : 9}
                                    >
                                      סה&quot;כ נוכחות לתאריך {new Date(a.date).toLocaleDateString("he-IL")} - {teacherName}: {dayTeacherTotalHours.toFixed(1)} {tr.hoursShort}
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </Fragment>
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
