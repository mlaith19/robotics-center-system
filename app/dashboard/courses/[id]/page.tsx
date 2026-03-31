"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Pencil, Loader2, BookOpen, Calendar, Users, BarChart3, CalendarCheck, Check, X, Thermometer, Plane } from "lucide-react"
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
  createdByUserName?: string | null
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
  const [attendanceList, setAttendanceList] = useState<{ id: string; studentId: string | null; teacherId: string | null; date: string; status: string; notes?: string | null; createdByUserName?: string | null }[]>([])
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0])
  const [attendanceByStudent, setAttendanceByStudent] = useState<Record<string, string>>({})
  const [savingByStudent, setSavingByStudent] = useState<Record<string, boolean>>({})
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
        const [courseRes, teachersRes, enrollmentsRes] = await Promise.all([
          fetch(`/api/courses/${id}`),
          fetch("/api/teachers"),
          fetch(`/api/enrollments?courseId=${id}`)
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
    return <div className="p-6 text-center">{tr.notFound}</div>
  }

  const courseTeachers = teachers.filter(t => 
    course.teacherIds && course.teacherIds.includes(t.id)
  )

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

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="container mx-auto max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/courses">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{tr.courseDetails}</h1>
            <p className="text-muted-foreground mt-1">
              <Link href="/dashboard/courses" className="hover:underline">{tr.courses}</Link>
              {" > "}
              {course.name}
            </p>
          </div>
        </div>

        {!isStudentUser && canEditCourses && (
          <Link href={`/dashboard/courses/${course.id}/edit`}>
            <Button className="gap-2">
              <Pencil className="h-4 w-4" />
              {tr.editCourse}
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs - לפי הרשאות טאב בכרטסת קורס */}
      <Tabs defaultValue={canTabGeneral ? "general" : !isStudentUser && canTabStudents ? "students" : canTabPayments ? "payments" : canTabAttendanceStudents ? "attendance-students" : "attendance-teachers"} className="w-full" dir={isRtl ? "rtl" : "ltr"}>
        <TabsList className="grid w-full mb-6" style={{ gridTemplateColumns: `repeat(${[canTabGeneral, canTabStudents, canTabPayments, canTabAttendanceStudents, canTabAttendanceTeachers].filter(Boolean).length}, 1fr)` }} dir={isRtl ? "rtl" : "ltr"}>
          {canTabGeneral && <TabsTrigger value="general">{tr.general}</TabsTrigger>}
          {!isStudentUser && canTabStudents && <TabsTrigger value="students">{tr.linkedStudents}</TabsTrigger>}
          {!isStudentUser && canTabPayments && <TabsTrigger value="payments">{tr.costPayments}</TabsTrigger>}
          {canTabAttendanceStudents && <TabsTrigger value="attendance-students">{tr.studentAttendance}</TabsTrigger>}
          {canTabAttendanceTeachers && <TabsTrigger value="attendance-teachers">{tr.teacherAttendance}</TabsTrigger>}
        </TabsList>

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

        {!isStudentUser && canTabStudents && (
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">תלמידים רשומים לקורס ({enrollments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">תלמיד</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">תאריך רישום</TableHead>
                        <TableHead className="text-right">בוצע על ידי</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium text-right">{enrollment.studentName || "תלמיד לא ידוע"}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={enrollment.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {enrollment.status === "active" ? "פעיל" : enrollment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {enrollment.enrollmentDate ? new Date(enrollment.enrollmentDate).toLocaleDateString("he-IL") : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{enrollment.createdByUserName || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  אין תלמידים רשומים לקורס זה
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {!isStudentUser && canTabPayments && (
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              פרטי עלות ותשלומים יוצגו כאן
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canTabAttendanceStudents && (
        <TabsContent value="attendance-students" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CalendarCheck className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg">נוכחות תלמידים בקורס</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">תאריך:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-md border overflow-x-auto mb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">תלמיד</TableHead>
                      <TableHead className="text-right">סטטוס נוכחות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.length > 0 ? enrollments.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="text-right font-medium">{enrollment.studentName || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {attendanceStatusButton(enrollment.studentId, "present", "נוכח", Check)}
                            {attendanceStatusButton(enrollment.studentId, "absent", "לא נוכח", X)}
                            {attendanceStatusButton(enrollment.studentId, "sick", "חולה", Thermometer)}
                            {attendanceStatusButton(enrollment.studentId, "vacation", "חופש", Plane)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground" colSpan={2}>
                          אין תלמידים משויכים לקורס זה
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                const studentAttendance = attendanceList.filter((a) => a.studentId != null)
                return studentAttendance.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">תלמיד</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">הערה</TableHead>
                          <TableHead className="text-right">מי ביצע</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentAttendance.map((a) => {
                          const enrollment = enrollments.find((e) => e.studentId === a.studentId)
                          const studentName = enrollment?.studentName ?? "—"
                          const statusLabel = a.status === "present" || a.status === "PRESENT" ? "נוכח" : a.status === "absent" || a.status === "ABSENT" ? "נעדר" : a.status
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="text-right">{new Date(a.date).toLocaleDateString("he-IL")}</TableCell>
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
                  <p className="text-center text-muted-foreground py-6">אין עדיין רשומות נוכחות תלמידים לקורס זה.</p>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canTabAttendanceTeachers && (
        <TabsContent value="attendance-teachers" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row-reverse items-center justify-start gap-2 pb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CalendarCheck className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg">נוכחות מורים בקורס</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const teacherAttendance = attendanceList.filter((a) => a.teacherId != null)
                return teacherAttendance.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">מורה</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                          <TableHead className="text-right">הערה</TableHead>
                          <TableHead className="text-right">מי ביצע</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherAttendance.map((a) => {
                          const teacher = teachers.find((t) => t.id === a.teacherId)
                          const teacherName = teacher?.name ?? "—"
                          const statusLabel = a.status === "present" || a.status === "PRESENT" ? "נוכח" : a.status === "absent" || a.status === "ABSENT" ? "נעדר" : a.status
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="text-right">{new Date(a.date).toLocaleDateString("he-IL")}</TableCell>
                              <TableCell className="text-right">{teacherName}</TableCell>
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
                  <p className="text-center text-muted-foreground py-6">אין רשומות נוכחות מורים לקורס זה.</p>
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
